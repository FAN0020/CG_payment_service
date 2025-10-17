import Database from 'better-sqlite3'
import { SubscriptionOrder, PaymentEvent, DatabaseError } from '../types/index.js'

export class PaymentDatabase {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.initializeTables()
  }

  private initializeTables(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL')

    // Create subscription_orders table
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

      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON subscription_orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_stripe_sub ON subscription_orders(stripe_subscription_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON subscription_orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON subscription_orders(stripe_session_id);
    `)

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

    console.log('[DB] Database initialized successfully')
  }

  // ============================================================================
  // Subscription Order Methods
  // ============================================================================

  createOrder(order: Omit<SubscriptionOrder, 'created_at' | 'updated_at'>): SubscriptionOrder {
    const now = Date.now()
    const fullOrder: SubscriptionOrder = {
      // stripe_session_id: null,
      // stripe_subscription_id: null,
      // stripe_customer_id: null,
      // stripe_customer_email: null,
      // payment_method: null,
      // platform: null,
      // client_ref: null,
      // expires_at: null,
      stripe_session_id: undefined,
      stripe_subscription_id: undefined,
      stripe_customer_id: undefined,
      stripe_customer_email: undefined,
      payment_method: undefined,
      platform: undefined,
      client_ref: undefined,
      expires_at: undefined,
      ...order,
      created_at: now,
      updated_at: now
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO subscription_orders (
          order_id, user_id, stripe_session_id, stripe_subscription_id,
          stripe_customer_id, stripe_customer_email, status, plan, amount, currency,
          payment_method, platform, client_ref, created_at, updated_at, expires_at
        ) VALUES (
          @order_id, @user_id, @stripe_session_id, @stripe_subscription_id,
          @stripe_customer_id, @stripe_customer_email, @status, @plan, @amount, @currency,
          @payment_method, @platform, @client_ref, @created_at, @updated_at, @expires_at
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
      return stmt.get(orderId) as SubscriptionOrder | undefined || null
    } catch (error: any) {
      throw new DatabaseError(`Failed to get order: ${error.message}`)
    }
  }

  getOrderByStripeSessionId(sessionId: string): SubscriptionOrder | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM subscription_orders WHERE stripe_session_id = ?')
      return stmt.get(sessionId) as SubscriptionOrder | undefined || null
    } catch (error: any) {
      throw new DatabaseError(`Failed to get order by session: ${error.message}`)
    }
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

  getOrdersByUserId(userId: string): SubscriptionOrder[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM subscription_orders WHERE user_id = ? ORDER BY created_at DESC')
      return stmt.all(userId) as SubscriptionOrder[]
    } catch (error: any) {
      throw new DatabaseError(`Failed to get orders by user ID: ${error.message}`)
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

  close(): void {
    this.db.close()
  }
}

