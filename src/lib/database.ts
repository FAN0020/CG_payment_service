import Database from 'better-sqlite3'
import { SubscriptionOrder, PaymentEvent, DatabaseError, ActivationCode } from '../types/index.js'
import { logger } from './logger.js'
import { getEncryptionManager } from './encryption.js'

export class PaymentDatabase {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.initializeTables()
  }

  /**
   * Decrypt sensitive fields in order data
   */
  private decryptOrderData(order: any): SubscriptionOrder {
    const encryption = getEncryptionManager()
    return {
      ...order,
      user_id: encryption.decryptUserId(order.user_id),
      stripe_customer_email: order.stripe_customer_email ? encryption.decryptEmail(order.stripe_customer_email) : undefined,
      amount: encryption.decryptAmount(order.amount)
    }
  }

  /**
   * Encrypt sensitive fields in order data for storage
   */
  private encryptOrderDataForStorage(order: Omit<SubscriptionOrder, 'created_at' | 'updated_at'>): any {
    const encryption = getEncryptionManager()
    return {
      ...order,
      user_id: encryption.encryptUserId(order.user_id),
      stripe_customer_email: order.stripe_customer_email ? encryption.encryptEmail(order.stripe_customer_email) : undefined,
      amount: encryption.encryptAmount(order.amount)
    }
  }

  private initializeTables(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL')

    // Create subscription_orders table with proper column handling
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscription_orders (
        order_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        stripe_session_id TEXT,
        stripe_subscription_id TEXT UNIQUE,
        stripe_customer_id TEXT,
        stripe_customer_email TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'canceled', 'expired', 'incomplete')),
        plan TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        payment_method TEXT,
        platform TEXT,
        client_ref TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );
    `)

    // Add missing columns if they don't exist
    try {
      // Check if column exists first
      const tableInfo = this.db.prepare("PRAGMA table_info(subscription_orders)").all()
      const hasRequestIdColumn = tableInfo.some((col: any) => col.name === 'request_id')
      
      if (!hasRequestIdColumn) {
        this.db.exec(`ALTER TABLE subscription_orders ADD COLUMN request_id TEXT;`)
        logger.info('Added request_id column to subscription_orders')
      } else {
        logger.info('request_id column already exists in subscription_orders')
      }
    } catch (e) {
      logger.error('Failed to add request_id column:', { error: e })
      throw e
    }
    
    try {
      this.db.exec(`ALTER TABLE subscription_orders ADD COLUMN ad_source TEXT;`)
    } catch (e) {
      // Column already exists, ignore
    }
    
    try {
      this.db.exec(`ALTER TABLE subscription_orders ADD COLUMN campaign_id TEXT;`)
    } catch (e) {
      // Column already exists, ignore
    }
    
    try {
      this.db.exec(`ALTER TABLE subscription_orders ADD COLUMN request_expires_at INTEGER;`)
    } catch (e) {
      // Column already exists, ignore
    }
    
    // TODO: Remove after testing period - Activation code columns
    try {
      this.db.exec(`ALTER TABLE subscription_orders ADD COLUMN test_activated BOOLEAN DEFAULT FALSE;`)
    } catch (e) {
      // Column already exists, ignore
    }
    
    try {
      this.db.exec(`ALTER TABLE subscription_orders ADD COLUMN activation_code TEXT;`)
    } catch (e) {
      // Column already exists, ignore
    }

    // TODO: Remove after testing period - Activation codes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activation_codes (
        code TEXT PRIMARY KEY,
        is_used BOOLEAN DEFAULT FALSE,
        used_by TEXT,
        created_at INTEGER NOT NULL,
        used_at INTEGER
      );
    `)

    // Create indexes after all columns are added
    try {
      // Verify request_id column exists before creating index
      const tableInfo = this.db.prepare("PRAGMA table_info(subscription_orders)").all()
      logger.info('subscription_orders table structure:', tableInfo)
      
      const hasRequestIdColumn = tableInfo.some((col: any) => col.name === 'request_id')
      logger.info('request_id column exists:', { exists: hasRequestIdColumn })
      
      if (hasRequestIdColumn) {
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_orders_user_id ON subscription_orders(user_id);
          CREATE INDEX IF NOT EXISTS idx_orders_stripe_sub ON subscription_orders(stripe_subscription_id);
          CREATE INDEX IF NOT EXISTS idx_orders_status ON subscription_orders(status);
          CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON subscription_orders(stripe_session_id);
          CREATE INDEX IF NOT EXISTS idx_orders_request_id ON subscription_orders(request_id);
          CREATE INDEX IF NOT EXISTS idx_orders_request_expires ON subscription_orders(request_expires_at);
        `)
        logger.info('Created indexes for subscription_orders table')
      } else {
        logger.error('request_id column not found, skipping index creation')
        throw new Error('request_id column not found')
      }
    } catch (e) {
      logger.error('Failed to create indexes for subscription_orders:', { error: e })
      throw e
    }

    // Create payment_events table for webhook idempotency
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payment_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        processed_at INTEGER NOT NULL,
        order_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_events_type ON payment_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_order ON payment_events(order_id);
    `)

    // Create client_idempotency table for API request idempotency
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS client_idempotency (
        idempotency_key TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_idempotency_user ON client_idempotency(user_id);
      CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON client_idempotency(expires_at);
    `)

    // Create concurrency_locks table for lightweight locking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS concurrency_locks (
        lock_key TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        request_id TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_locks_user_product ON concurrency_locks(user_id, product_id);
      CREATE INDEX IF NOT EXISTS idx_locks_expires ON concurrency_locks(expires_at);
    `)

    // Create active_payments table for timeout-window enforcement
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS active_payments (
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        session_url TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, product_id)
      );

      CREATE INDEX IF NOT EXISTS idx_active_payments_expires ON active_payments(expires_at);
      CREATE INDEX IF NOT EXISTS idx_active_payments_user_product ON active_payments(user_id, product_id);
    `)

    // TODO: Remove after testing period
    // Create activation_codes table for internal testing
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activation_codes (
        code TEXT PRIMARY KEY,
        is_used BOOLEAN DEFAULT FALSE,
        used_by TEXT,
        created_at INTEGER NOT NULL,
        used_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_activation_codes_used_by ON activation_codes(used_by);
      CREATE INDEX IF NOT EXISTS idx_activation_codes_is_used ON activation_codes(is_used);
    `)

    // TODO: Remove after testing period
    // Add test_activated and activation_code columns to subscription_orders
    try {
      this.db.exec(`ALTER TABLE subscription_orders ADD COLUMN test_activated BOOLEAN DEFAULT FALSE;`)
    } catch (e) {
      // Column already exists, ignore
    }
    
    try {
      this.db.exec(`ALTER TABLE subscription_orders ADD COLUMN activation_code TEXT;`)
    } catch (e) {
      // Column already exists, ignore
    }

    // Add promo_code column to subscription_orders
    try {
      this.db.exec(`ALTER TABLE subscription_orders ADD COLUMN promo_code TEXT;`)
    } catch (e) {
      // Column already exists, ignore
    }

    // Create promo_codes table for production promo codes
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS promo_codes (
          code TEXT PRIMARY KEY,
          plan_type TEXT NOT NULL,
          plan_amount REAL NOT NULL,
          plan_currency TEXT NOT NULL,
          is_used BOOLEAN DEFAULT FALSE,
          used_by TEXT,
          created_at INTEGER NOT NULL,
          used_at INTEGER,
          expires_at INTEGER
        );
      `)
      logger.info('Promo codes table created successfully')
    } catch (e) {
      logger.error('Failed to create promo_codes table:', { error: e })
      throw e
    }

    // Create user_credits table for credits-based ad integration
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_credits (
          user_id TEXT PRIMARY KEY,
          credits_balance INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `)
      logger.info('User credits table created successfully')
    } catch (e) {
      logger.error('Failed to create user_credits table:', { error: e })
      throw e
    }

    // Create credit_transactions table for transaction history
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS credit_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          reason TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `)
      logger.info('Credit transactions table created successfully')
    } catch (e) {
      logger.error('Failed to create credit_transactions table:', { error: e })
      throw e
    }

    // Verify table structure before creating indexes
    try {
      const tableInfo = this.db.prepare("PRAGMA table_info(promo_codes)").all()
      logger.info('Promo codes table structure:', tableInfo)
      
      // Check if used_by column exists
      const hasUsedByColumn = tableInfo.some((col: any) => col.name === 'used_by')
      if (!hasUsedByColumn) {
        logger.error('used_by column not found in promo_codes table')
        throw new Error('used_by column not found')
      }
    } catch (e) {
      logger.error('Failed to verify table structure:', { error: e })
      throw e
    }

    // Create indexes after table creation
    try {
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_promo_codes_used_by ON promo_codes(used_by);
        CREATE INDEX IF NOT EXISTS idx_promo_codes_is_used ON promo_codes(is_used);
        CREATE INDEX IF NOT EXISTS idx_promo_codes_expires ON promo_codes(expires_at);
        CREATE INDEX IF NOT EXISTS idx_user_credits_balance ON user_credits(credits_balance);
        CREATE INDEX IF NOT EXISTS idx_user_credits_updated ON user_credits(updated_at);
      `)
      logger.info('Promo codes and user credits indexes created successfully')
    } catch (e) {
      logger.error('Failed to create promo_codes and user_credits indexes:', { error: e })
      throw e
    }

    logger.info('Database initialized successfully')
  }

  // ============================================================================
  // Subscription Order Methods
  // ============================================================================

  createOrder(order: Omit<SubscriptionOrder, 'created_at' | 'updated_at'>): SubscriptionOrder {
    const now = Date.now()
    
    // Encrypt sensitive data before storage
    const encryptedOrder = this.encryptOrderDataForStorage(order)
    
    const fullOrder: SubscriptionOrder = {
      stripe_session_id: undefined,
      stripe_subscription_id: undefined,
      stripe_customer_id: undefined,
      stripe_customer_email: undefined,
      payment_method: undefined,
      platform: undefined,
      client_ref: undefined,
      request_id: undefined,
      ad_source: undefined,
      campaign_id: undefined,
      expires_at: undefined,
      request_expires_at: undefined,
      ...encryptedOrder,
      created_at: now,
      updated_at: now
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO subscription_orders (
          order_id, user_id, stripe_session_id, stripe_subscription_id,
          stripe_customer_id, stripe_customer_email, status, plan, amount, currency,
          payment_method, platform, client_ref, request_id, ad_source, campaign_id,
          created_at, updated_at, expires_at, request_expires_at, promo_code
        ) VALUES (
          @order_id, @user_id, @stripe_session_id, @stripe_subscription_id,
          @stripe_customer_id, @stripe_customer_email, @status, @plan, @amount, @currency,
          @payment_method, @platform, @client_ref, @request_id, @ad_source, @campaign_id,
          @created_at, @updated_at, @expires_at, @request_expires_at, @promo_code
        )
      `)

      stmt.run(fullOrder)
      return fullOrder
    } catch (error: any) {
      throw new DatabaseError(`Failed to create order: ${error.message}`)
    }
  }

  updateOrder(orderId: string, updates: Partial<Omit<SubscriptionOrder, 'order_id' | 'created_at'>>): SubscriptionOrder | null {
    const now = Date.now()
    const updatesWithTimestamp = { ...updates, updated_at: now }

    try {
      const setClauses = Object.keys(updatesWithTimestamp)
        .map(key => `${key} = @${key}`)
        .join(', ')

      const stmt = this.db.prepare(`
        UPDATE subscription_orders
        SET ${setClauses}
        WHERE order_id = @order_id
      `)

      const result = stmt.run({ ...updatesWithTimestamp, order_id: orderId })

      if (result.changes === 0) {
        return null
      }

      return this.getOrderById(orderId)
    } catch (error: any) {
      throw new DatabaseError(`Failed to update order: ${error.message}`)
    }
  }

  getOrderById(orderId: string): SubscriptionOrder | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM subscription_orders WHERE order_id = ?')
      const order = stmt.get(orderId) as SubscriptionOrder | undefined || null
      
      if (!order) return null
      
      // Decrypt sensitive data before returning
      return this.decryptOrderData(order)
    } catch (error: any) {
      throw new DatabaseError(`Failed to get order: ${error.message}`)
    }
  }

  getOrderByStripeSessionId(sessionId: string): SubscriptionOrder | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM subscription_orders WHERE stripe_session_id = ?')
      const order = stmt.get(sessionId) as SubscriptionOrder | undefined || null
      
      if (!order) return null
      
      // Decrypt sensitive data before returning
      return this.decryptOrderData(order)
    } catch (error: any) {
      throw new DatabaseError(`Failed to get order by session: ${error.message}`)
    }
  }

  // Alias for API consistency
  getOrderBySessionId(sessionId: string): SubscriptionOrder | null {
    return this.getOrderByStripeSessionId(sessionId)
  }

  getOrderByStripeSubscriptionId(subscriptionId: string): SubscriptionOrder | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM subscription_orders WHERE stripe_subscription_id = ?')
      return stmt.get(subscriptionId) as SubscriptionOrder | undefined || null
    } catch (error: any) {
      throw new DatabaseError(`Failed to get order by subscription: ${error.message}`)
    }
  }

  getActiveSubscriptionByUserId(userId: string): SubscriptionOrder | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM subscription_orders
        WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY created_at DESC
        LIMIT 1
      `)
      return stmt.get(userId, Date.now()) as SubscriptionOrder | undefined || null
    } catch (error: any) {
      throw new DatabaseError(`Failed to get active subscription: ${error.message}`)
    }
  }

  // Alias for compatibility with credits API
  getActiveSubscription(userId: string): SubscriptionOrder | null {
    return this.getActiveSubscriptionByUserId(userId)
  }

  getOrdersByUserId(userId: string): SubscriptionOrder[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM subscription_orders WHERE user_id = ? ORDER BY created_at DESC')
      return stmt.all(userId) as SubscriptionOrder[]
    } catch (error: any) {
      throw new DatabaseError(`Failed to get orders by user ID: ${error.message}`)
    }
  }

  getOrderByRequestId(requestId: string): SubscriptionOrder | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM subscription_orders WHERE request_id = ?')
      return stmt.get(requestId) as SubscriptionOrder | undefined || null
    } catch (error: any) {
      throw new DatabaseError(`Failed to get order by request ID: ${error.message}`)
    }
  }

  cleanExpiredRequestIds(): number {
    try {
      const stmt = this.db.prepare('DELETE FROM subscription_orders WHERE request_expires_at < ? AND request_expires_at IS NOT NULL')
      const result = stmt.run(Date.now())
      return result.changes
    } catch (error: any) {
      throw new DatabaseError(`Failed to clean expired request IDs: ${error.message}`)
    }
  }

  // ============================================================================
  // Payment Event Methods (Idempotency)
  // ============================================================================

  isEventProcessed(eventId: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM payment_events WHERE event_id = ?')
      return stmt.get(eventId) !== undefined
    } catch (error: any) {
      throw new DatabaseError(`Failed to check event: ${error.message}`)
    }
  }

  recordEvent(event: Omit<PaymentEvent, 'processed_at'>): PaymentEvent {
    const now = Date.now()
    const fullEvent: PaymentEvent = {
      ...event,
      processed_at: now
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO payment_events (event_id, event_type, processed_at, order_id)
        VALUES (@event_id, @event_type, @processed_at, @order_id)
      `)

      stmt.run(fullEvent)
      return fullEvent
    } catch (error: any) {
      // If duplicate event_id, return existing
      if (error.message.includes('UNIQUE constraint failed')) {
        const existing = this.db.prepare('SELECT * FROM payment_events WHERE event_id = ?').get(event.event_id) as PaymentEvent
        return existing
      }
      throw new DatabaseError(`Failed to record event: ${error.message}`)
    }
  }

  // ============================================================================
  // Client Idempotency Methods (Prevent duplicate API calls)
  // ============================================================================

  checkIdempotency(idempotencyKey: string, userId: string): string | null {
    try {
      const stmt = this.db.prepare(`
        SELECT order_id FROM client_idempotency
        WHERE idempotency_key = ? AND user_id = ? AND expires_at > ?
      `)
      const record = stmt.get(idempotencyKey, userId, Date.now()) as { order_id: string } | undefined
      return record?.order_id || null
    } catch (error: any) {
      throw new DatabaseError(`Failed to check idempotency: ${error.message}`)
    }
  }

  recordIdempotency(idempotencyKey: string, userId: string, orderId: string, ttlHours: number = 24): void {
    const now = Date.now()
    const expiresAt = now + (ttlHours * 60 * 60 * 1000)

    try {
      const stmt = this.db.prepare(`
        INSERT INTO client_idempotency (idempotency_key, user_id, order_id, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      stmt.run(idempotencyKey, userId, orderId, now, expiresAt)
    } catch (error: any) {
      // If duplicate key, that's fine - the check already passed
      if (!error.message.includes('UNIQUE constraint failed')) {
        throw new DatabaseError(`Failed to record idempotency: ${error.message}`)
      }
    }
  }

  cleanExpiredIdempotencyRecords(): number {
    try {
      const stmt = this.db.prepare('DELETE FROM client_idempotency WHERE expires_at < ?')
      const result = stmt.run(Date.now())
      return result.changes
    } catch (error: any) {
      throw new DatabaseError(`Failed to clean expired idempotency records: ${error.message}`)
    }
  }

  // ============================================================================
  // Concurrency Lock Methods (Prevent concurrent checkout for same user/product)
  // ============================================================================

  /**
   * Try to acquire a concurrency lock for a user/product combination
   * Returns true if lock was acquired, false if already locked
   */
  tryAcquireLock(userId: string, productId: string, requestId: string, ttlSeconds: number = 10): boolean {
    const now = Date.now()
    const expiresAt = now + (ttlSeconds * 1000)
    const lockKey = `lock:user:${userId}:product:${productId}`

    try {
      // Clean expired locks first
      this.cleanExpiredLocks()

      // Try to insert new lock
      const stmt = this.db.prepare(`
        INSERT INTO concurrency_locks (lock_key, user_id, product_id, created_at, expires_at, request_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      
      stmt.run(lockKey, userId, productId, now, expiresAt, requestId)
      return true
    } catch (error: any) {
      // If unique constraint failed, lock already exists
      if (error.message.includes('UNIQUE constraint failed')) {
        return false
      }
      throw new DatabaseError(`Failed to acquire lock: ${error.message}`)
    }
  }

  /**
   * Release a concurrency lock
   */
  releaseLock(userId: string, productId: string, requestId: string): boolean {
    const lockKey = `lock:user:${userId}:product:${productId}`

    try {
      const stmt = this.db.prepare(`
        DELETE FROM concurrency_locks 
        WHERE lock_key = ? AND request_id = ?
      `)
      
      const result = stmt.run(lockKey, requestId)
      return result.changes > 0
    } catch (error: any) {
      throw new DatabaseError(`Failed to release lock: ${error.message}`)
    }
  }

  /**
   * Check if a lock exists for user/product combination
   */
  hasActiveLock(userId: string, productId: string): boolean {
    const lockKey = `lock:user:${userId}:product:${productId}`

    try {
      const stmt = this.db.prepare(`
        SELECT 1 FROM concurrency_locks 
        WHERE lock_key = ? AND expires_at > ?
      `)
      
      return stmt.get(lockKey, Date.now()) !== undefined
    } catch (error: any) {
      throw new DatabaseError(`Failed to check lock: ${error.message}`)
    }
  }

  /**
   * Clean expired locks
   */
  cleanExpiredLocks(): number {
    try {
      const stmt = this.db.prepare('DELETE FROM concurrency_locks WHERE expires_at < ?')
      const result = stmt.run(Date.now())
      return result.changes
    } catch (error: any) {
      throw new DatabaseError(`Failed to clean expired locks: ${error.message}`)
    }
  }

  // ============================================================================
  // Active Payment Methods (Timeout-window enforcement)
  // ============================================================================

  /**
   * Find active payment for user/product combination
   */
  findActivePayment(userId: string, productId: string): { 
    idempotency_key: string, 
    session_url: string | null, 
    created_at: number, 
    expires_at: number 
  } | null {
    try {
      const stmt = this.db.prepare(`
        SELECT idempotency_key, session_url, created_at, expires_at 
        FROM active_payments 
        WHERE user_id = ? AND product_id = ? AND expires_at > ?
      `)
      const result = stmt.get(userId, productId, Date.now()) as {
        idempotency_key: string,
        session_url: string | null,
        created_at: number,
        expires_at: number
      } | undefined
      
      return result || null
    } catch (error: any) {
      throw new DatabaseError(`Failed to find active payment: ${error.message}`)
    }
  }

  /**
   * Record active payment - throws error if already exists (for concurrency control)
   */
  recordActivePayment(
    userId: string, 
    productId: string, 
    idempotencyKey: string, 
    sessionUrl: string | null,
    timeoutMs: number = 60000
  ): void {
    const now = Date.now()
    const expiresAt = now + timeoutMs

    try {
      // Clean expired records first
      this.cleanExpiredActivePayments()
      
      const stmt = this.db.prepare(`
        INSERT INTO active_payments 
        (user_id, product_id, idempotency_key, session_url, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      
      stmt.run(userId, productId, idempotencyKey, sessionUrl, now, expiresAt)
    } catch (error: any) {
      // If unique constraint failed, that means there's already an active payment
      if (error.message.includes('UNIQUE constraint failed') || error.message.includes('PRIMARY KEY constraint failed')) {
        throw new DatabaseError(`Active payment already exists for user ${userId} and product ${productId}`)
      }
      throw new DatabaseError(`Failed to record active payment: ${error.message}`)
    }
  }

  /**
   * Update active payment session URL (after Stripe session creation)
   */
  updateActivePaymentSessionUrl(
    userId: string, 
    productId: string, 
    sessionUrl: string
  ): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE active_payments 
        SET session_url = ?
        WHERE user_id = ? AND product_id = ? AND expires_at > ?
      `)
      
      const result = stmt.run(sessionUrl, userId, productId, Date.now())
      return result.changes > 0
    } catch (error: any) {
      throw new DatabaseError(`Failed to update active payment session URL: ${error.message}`)
    }
  }

  /**
   * Remove active payment (mark as inactive)
   */
  removeActivePayment(userId: string, productId: string): boolean {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM active_payments 
        WHERE user_id = ? AND product_id = ?
      `)
      
      const result = stmt.run(userId, productId)
      return result.changes > 0
    } catch (error: any) {
      throw new DatabaseError(`Failed to remove active payment: ${error.message}`)
    }
  }

  /**
   * Clean expired active payments
   */
  cleanExpiredActivePayments(): number {
    try {
      // Log active payments count before cleanup
      const countBeforeStmt = this.db.prepare('SELECT COUNT(*) as count FROM active_payments')
      const countBefore = countBeforeStmt.get() as { count: number }
      
      const stmt = this.db.prepare('DELETE FROM active_payments WHERE expires_at < ?')
      const result = stmt.run(Date.now())
      
      // Log active payments count after cleanup
      const countAfterStmt = this.db.prepare('SELECT COUNT(*) as count FROM active_payments')
      const countAfter = countAfterStmt.get() as { count: number }
      
      if (result.changes > 0) {
        console.log(`[payment-service] active_payments cleanup: removed ${result.changes} expired records (${countBefore.count} → ${countAfter.count})`)
      }
      
      return result.changes
    } catch (error: any) {
      throw new DatabaseError(`Failed to clean expired active payments: ${error.message}`)
    }
  }

  // ============================================================================
  // Transaction Support
  // ============================================================================

  transaction<T>(fn: () => T): T {
    try {
      return this.db.transaction(fn)()
    } catch (error: any) {
      throw new DatabaseError(`Transaction failed: ${error.message}`)
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  // ============================================================================
  // TODO: Remove after testing period
  // Activation Code Methods (Internal Testing Feature)
  // ============================================================================

  /**
   * Create a new activation code
   * TODO: Remove after testing period
   */
  createActivationCode(code: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO activation_codes (code, created_at)
        VALUES (?, ?)
      `)
      stmt.run(code, Date.now())
    } catch (error: any) {
      throw new DatabaseError(`Failed to create activation code: ${error.message}`)
    }
  }

  /**
   * Get activation code by code string
   * TODO: Remove after testing period
   */
  getActivationCode(code: string): ActivationCode | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM activation_codes WHERE code = ?
      `)
      return stmt.get(code) as ActivationCode | null
    } catch (error: any) {
      throw new DatabaseError(`Failed to get activation code: ${error.message}`)
    }
  }

  /**
   * Check if activation code is valid and available
   * TODO: Remove after testing period
   */
  isActivationCodeValid(code: string): boolean {
    const activationCode = this.getActivationCode(code)
    return activationCode !== null && !activationCode.used
  }

  /**
   * Redeem activation code for a user
   * TODO: Remove after testing period
   */
  redeemActivationCode(code: string, userId: string): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE activation_codes 
        SET is_used = TRUE, used_by = ?, used_at = ?
        WHERE code = ? AND is_used = FALSE
      `)
      const result = stmt.run(userId, Date.now(), code)
      return result.changes > 0
    } catch (error: any) {
      throw new DatabaseError(`Failed to redeem activation code: ${error.message}`)
    }
  }

  // ============================================================================
  // Promo Code Methods
  // ============================================================================

  /**
   * Get promo code by code
   */
  getPromoCode(code: string): any | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM promo_codes WHERE code = ?
      `)
      return stmt.get(code)
    } catch (error: any) {
      throw new DatabaseError(`Failed to get promo code: ${error.message}`)
    }
  }

  /**
   * Check if promo code is valid and available
   */
  isPromoCodeValid(code: string): boolean {
    const promoCode = this.getPromoCode(code)
    if (!promoCode) return false
    
    // Check if code is already used
    if (promoCode.is_used) return false
    
    // Check if code is expired
    const now = Date.now()
    if (promoCode.expires_at && promoCode.expires_at < now) return false
    
    return true
  }

  /**
   * Redeem promo code for a user
   */
  redeemPromoCode(code: string, userId: string): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE promo_codes 
        SET is_used = TRUE, used_by = ?, used_at = ?
        WHERE code = ? AND is_used = FALSE
      `)
      const result = stmt.run(userId, Date.now(), code)
      return result.changes > 0
    } catch (error: any) {
      throw new DatabaseError(`Failed to redeem promo code: ${error.message}`)
    }
  }

  /**
   * Calculate promo code discount amount
   */
  calculatePromoDiscount(code: string, originalAmount: number): number {
    const promoCode = this.getPromoCode(code)
    if (!promoCode) return 0
    
    // For 100% off daily plan ($1.99), return full amount
    if (promoCode.plan_type === 'daily-plan' && promoCode.plan_amount === 1.99) {
      return originalAmount // 100% discount = full amount
    }
    
    return 0
  }

  /**
   * Get promo code statistics
   */
  getPromoCodeStats(): any {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_used = FALSE THEN 1 ELSE 0 END) as unused,
          SUM(CASE WHEN is_used = TRUE THEN 1 ELSE 0 END) as used
        FROM promo_codes
      `)
      return stmt.get()
    } catch (error: any) {
      throw new DatabaseError(`Failed to get promo code stats: ${error.message}`)
    }
  }

  /**
   * Get activation code statistics
   * TODO: Remove after testing period
   */
  getActivationCodeStats(): { total: number; used: number; available: number } {
    try {
      const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM activation_codes')
      const usedStmt = this.db.prepare('SELECT COUNT(*) as count FROM activation_codes WHERE is_used = TRUE')
      
      const total = totalStmt.get() as { count: number }
      const used = usedStmt.get() as { count: number }
      
      return {
        total: total.count,
        used: used.count,
        available: total.count - used.count
      }
    } catch (error: any) {
      throw new DatabaseError(`Failed to get activation code stats: ${error.message}`)
    }
  }

  // ============================================================================
  // User Credits Management (for Ad Service Integration)
  // ============================================================================

  /**
   * Get user credits balance
   */
  getUserCredits(userId: string): { credits_balance: number; is_premium: boolean } {
    try {
      // Get credits balance
      const creditsStmt = this.db.prepare(`
        SELECT credits_balance FROM user_credits WHERE user_id = ?
      `)
      const creditsResult = creditsStmt.get(userId) as { credits_balance: number } | undefined
      const creditsBalance = creditsResult?.credits_balance || 0

      // Check if user has active subscription (premium)
      const premiumStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM subscription_orders 
        WHERE user_id = ? AND status = 'active' AND expires_at > ?
      `)
      const premiumResult = premiumStmt.get(userId, Date.now()) as { count: number }
      const isPremium = premiumResult.count > 0

      return {
        credits_balance: creditsBalance,
        is_premium: isPremium
      }
    } catch (error: any) {
      throw new DatabaseError(`Failed to get user credits: ${error.message}`)
    }
  }

  /**
   * Initialize user credits (create record if doesn't exist)
   */
  initializeUserCredits(userId: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO user_credits (user_id, credits_balance, created_at, updated_at)
        VALUES (?, 0, ?, ?)
      `)
      const now = Date.now()
      stmt.run(userId, now, now)
    } catch (error: any) {
      throw new DatabaseError(`Failed to initialize user credits: ${error.message}`)
    }
  }

  /**
   * Get user's current credit balance
   */
  getCreditBalance(userId: string): number {
    try {
      // Initialize user credits if they don't exist
      this.initializeUserCredits(userId)

      const stmt = this.db.prepare('SELECT credits_balance FROM user_credits WHERE user_id = ?')
      const result = stmt.get(userId) as { credits_balance: number } | undefined
      return result?.credits_balance ?? 0
    } catch (error: any) {
      throw new DatabaseError(`Failed to get credit balance: ${error.message}`)
    }
  }

  /**
   * Deduct credits from user account and record transaction
   */
  deductCredits(userId: string, amount: number, reason: string): number {
    try {
      // Initialize user credits if they don't exist
      this.initializeUserCredits(userId)

      // Check if user has sufficient credits
      const currentBalance = this.getCreditBalance(userId)
      if (currentBalance < amount) {
        throw new Error('Insufficient credits')
      }

      // Record the transaction
      const transactionStmt = this.db.prepare(`
        INSERT INTO credit_transactions (user_id, type, amount, reason, created_at)
        VALUES (?, 'deduct', ?, ?, ?)
      `)
      transactionStmt.run(userId, -amount, reason, Date.now())

      // Deduct credits
      const stmt = this.db.prepare(`
        UPDATE user_credits 
        SET credits_balance = credits_balance - ?, updated_at = ?
        WHERE user_id = ?
      `)
      stmt.run(amount, Date.now(), userId)

      // Return new balance
      return this.getCreditBalance(userId)
    } catch (error: any) {
      throw new DatabaseError(`Failed to deduct credits: ${error.message}`)
    }
  }

  /**
   * Add credits to user account
   */
  addCredits(userId: string, amount: number): void {
    try {
      // Initialize user credits if they don't exist
      this.initializeUserCredits(userId)

      const stmt = this.db.prepare(`
        UPDATE user_credits 
        SET credits_balance = credits_balance + ?, updated_at = ?
        WHERE user_id = ?
      `)
      stmt.run(amount, Date.now(), userId)
    } catch (error: any) {
      throw new DatabaseError(`Failed to add credits: ${error.message}`)
    }
  }

  /**
   * Reward credits to user account and record transaction
   */
  rewardCredits(userId: string, amount: number, reason: string): number {
    try {
      // Initialize user credits if they don't exist
      this.initializeUserCredits(userId)

      // Record the transaction
      const transactionStmt = this.db.prepare(`
        INSERT INTO credit_transactions (user_id, type, amount, reason, created_at)
        VALUES (?, 'reward', ?, ?, ?)
      `)
      transactionStmt.run(userId, amount, reason, Date.now())

      // Add credits
      const stmt = this.db.prepare(`
        UPDATE user_credits 
        SET credits_balance = credits_balance + ?, updated_at = ?
        WHERE user_id = ?
      `)
      stmt.run(amount, Date.now(), userId)

      // Return new balance
      return this.getCreditBalance(userId)
    } catch (error: any) {
      throw new DatabaseError(`Failed to reward credits: ${error.message}`)
    }
  }

  /**
   * Set credits balance (for admin operations)
   */
  setCredits(userId: string, amount: number): void {
    try {
      // Initialize user credits if they don't exist
      this.initializeUserCredits(userId)

      const stmt = this.db.prepare(`
        UPDATE user_credits 
        SET credits_balance = ?, updated_at = ?
        WHERE user_id = ?
      `)
      stmt.run(amount, Date.now(), userId)
    } catch (error: any) {
      throw new DatabaseError(`Failed to set credits: ${error.message}`)
    }
  }

  close(): void {
    this.db.close()
  }
}

