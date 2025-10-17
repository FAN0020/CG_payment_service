#!/usr/bin/env node
/**
 * Test 1: Database Initialization and Operations
 * Tests SQLite database setup, table creation, and basic CRUD operations
 */

import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEST_DB_PATH = resolve(__dirname, '../../data/test-payment.db')

console.log('\n' + '='.repeat(80))
console.log('TEST 1: Database Initialization and Operations')
console.log('='.repeat(80))

let testResults = {
  testName: 'Database Operations',
  timestamp: new Date().toISOString(),
  tests: [],
  passed: 0,
  failed: 0
}

function addTest(name, passed, details) {
  testResults.tests.push({ name, passed, details })
  if (passed) {
    testResults.passed++
    console.log(`✅ ${name}`)
  } else {
    testResults.failed++
    console.log(`❌ ${name}`)
    console.log(`   Error: ${details}`)
  }
}

try {
  // Ensure data directory exists
  const dataDir = dirname(TEST_DB_PATH)
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  console.log('\n📋 Step 1: Initialize Database')
  const db = new Database(TEST_DB_PATH)
  db.pragma('journal_mode = WAL')
  addTest('Database connection established', true, 'SQLite connected')

  console.log('\n📋 Step 2: Create Tables')
  
  // Create subscription_orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_orders (
      order_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stripe_session_id TEXT,
      stripe_subscription_id TEXT,
      stripe_customer_id TEXT,
      stripe_customer_email TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      plan TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      payment_method TEXT,
      platform TEXT,
      client_ref TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER
    )
  `)
  addTest('subscription_orders table created', true, 'Table exists')

  // Create payment_events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      processed_at INTEGER NOT NULL,
      order_id TEXT
    )
  `)
  addTest('payment_events table created', true, 'Table exists')

  // Create client_idempotency table
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_idempotency (
      idempotency_key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `)
  addTest('client_idempotency table created', true, 'Table exists')

  console.log('\n📋 Step 3: Create Indexes')
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON subscription_orders(user_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_stripe_subscription_id ON subscription_orders(stripe_subscription_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_status ON subscription_orders(status)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_type ON payment_events(event_type)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_idempotency_user_id ON client_idempotency(user_id)')
  addTest('Database indexes created', true, 'All indexes exist')

  console.log('\n📋 Step 4: Test CRUD Operations')
  
  // Insert test order
  const testOrder = {
    order_id: 'test-order-' + Date.now(),
    user_id: 'test-user-12345',
    status: 'pending',
    plan: 'monthly-plan',
    amount: 12.90,
    currency: 'USD',
    created_at: Date.now(),
    updated_at: Date.now()
  }

  const insertStmt = db.prepare(`
    INSERT INTO subscription_orders 
    (order_id, user_id, status, plan, amount, currency, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  insertStmt.run(
    testOrder.order_id,
    testOrder.user_id,
    testOrder.status,
    testOrder.plan,
    testOrder.amount,
    testOrder.currency,
    testOrder.created_at,
    testOrder.updated_at
  )
  addTest('Insert order record', true, `Order ${testOrder.order_id} created`)

  // Read order
  const selectStmt = db.prepare('SELECT * FROM subscription_orders WHERE order_id = ?')
  const retrievedOrder = selectStmt.get(testOrder.order_id)
  addTest('Read order record', retrievedOrder !== undefined, `Order retrieved: ${retrievedOrder?.order_id}`)

  // Update order
  const updateStmt = db.prepare('UPDATE subscription_orders SET status = ? WHERE order_id = ?')
  updateStmt.run('active', testOrder.order_id)
  const updatedOrder = selectStmt.get(testOrder.order_id)
  addTest('Update order status', updatedOrder.status === 'active', `Status updated to ${updatedOrder.status}`)

  // Query by user_id
  const userOrdersStmt = db.prepare('SELECT * FROM subscription_orders WHERE user_id = ?')
  const userOrders = userOrdersStmt.all(testOrder.user_id)
  addTest('Query orders by user_id', userOrders.length > 0, `Found ${userOrders.length} orders`)

  // Test idempotency table
  const idemKey = 'test-idem-' + Date.now()
  const idemStmt = db.prepare(`
    INSERT INTO client_idempotency (idempotency_key, user_id, order_id, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `)
  idemStmt.run(idemKey, testOrder.user_id, testOrder.order_id, Date.now(), Date.now() + 86400000)
  addTest('Idempotency record created', true, `Key: ${idemKey}`)

  // Test payment_events table
  const eventId = 'evt_test_' + Date.now()
  const eventStmt = db.prepare(`
    INSERT INTO payment_events (event_id, event_type, processed_at, order_id)
    VALUES (?, ?, ?, ?)
  `)
  eventStmt.run(eventId, 'checkout.session.completed', Date.now(), testOrder.order_id)
  addTest('Payment event recorded', true, `Event: ${eventId}`)

  console.log('\n📋 Step 5: Test Edge Cases')
  
  // Test duplicate key prevention
  try {
    insertStmt.run(
      testOrder.order_id,
      testOrder.user_id,
      testOrder.status,
      testOrder.plan,
      testOrder.amount,
      testOrder.currency,
      testOrder.created_at,
      testOrder.updated_at
    )
    addTest('Duplicate key prevention', false, 'Duplicate insert should have failed')
  } catch (err) {
    addTest('Duplicate key prevention', true, 'Correctly rejected duplicate order_id')
  }

  db.close()
  addTest('Database connection closed', true, 'Graceful shutdown')

  console.log('\n' + '='.repeat(80))
  console.log(`✅ Database Tests: ${testResults.passed} passed, ${testResults.failed} failed`)
  console.log('='.repeat(80))

  // Save results
  import('fs').then(fs => {
    fs.writeFileSync(
      resolve(__dirname, '../test-results/1-database-test.json'),
      JSON.stringify(testResults, null, 2)
    )
  })

  process.exit(testResults.failed > 0 ? 1 : 0)

} catch (error) {
  console.error('\n❌ Database Test Failed:', error.message)
  addTest('Fatal error', false, error.message)
  process.exit(1)
}

