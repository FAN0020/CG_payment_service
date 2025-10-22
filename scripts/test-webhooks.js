#!/usr/bin/env node

/**
 * Test script for Stripe webhook events
 * This script simulates the webhook events you configured in Stripe
 */

import Stripe from 'stripe'
import crypto from 'crypto'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const WEBHOOK_URL = 'http://localhost:8790/webhooks/stripe'

if (!STRIPE_SECRET_KEY || !WEBHOOK_SECRET) {
  console.error('❌ Missing required environment variables:')
  console.error('   STRIPE_SECRET_KEY:', !!STRIPE_SECRET_KEY)
  console.error('   STRIPE_WEBHOOK_SECRET:', !!WEBHOOK_SECRET)
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })

/**
 * Create a test webhook event payload
 */
function createTestEvent(type, data) {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: Math.floor(Date.now() / 1000),
    data: { object: data },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: type
  }
}

/**
 * Generate Stripe signature for webhook
 */
function generateSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000)
  const signedPayload = `${timestamp}.${payload}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex')
  
  return `t=${timestamp},v1=${signature}`
}

/**
 * Send webhook event to local server
 */
async function sendWebhookEvent(event) {
  const payload = JSON.stringify(event)
  const signature = generateSignature(payload, WEBHOOK_SECRET)
  
  console.log(`📤 Sending ${event.type} event...`)
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      },
      body: payload
    })
    
    const result = await response.text()
    
    if (response.ok) {
      console.log(`✅ ${event.type} - Success:`, result)
    } else {
      console.log(`❌ ${event.type} - Error ${response.status}:`, result)
    }
  } catch (error) {
    console.log(`❌ ${event.type} - Network error:`, error.message)
  }
}

/**
 * Test different webhook events
 */
async function testWebhooks() {
  console.log('🧪 Testing Stripe Webhook Events')
  console.log('================================')
  console.log(`Webhook URL: ${WEBHOOK_URL}`)
  console.log('')
  
  // Test 1: checkout.session.completed
  const checkoutSession = {
    id: 'cs_test_' + Date.now(),
    object: 'checkout.session',
    amount_total: 990,
    currency: 'usd',
    customer: 'cus_test_' + Date.now(),
    customer_email: 'test@example.com',
    mode: 'subscription',
    payment_status: 'paid',
    status: 'complete',
    subscription: 'sub_test_' + Date.now(),
    metadata: {
      order_id: 'order_test_' + Date.now()
    }
  }
  
  await sendWebhookEvent(createTestEvent('checkout.session.completed', checkoutSession))
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 2: customer.subscription.created
  const subscription = {
    id: 'sub_test_' + Date.now(),
    object: 'subscription',
    customer: 'cus_test_' + Date.now(),
    status: 'active',
    current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
    metadata: {
      order_id: 'order_test_' + Date.now()
    }
  }
  
  await sendWebhookEvent(createTestEvent('customer.subscription.created', subscription))
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 3: customer.subscription.updated
  const updatedSubscription = {
    ...subscription,
    status: 'active',
    current_period_end: Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60) // 60 days
  }
  
  await sendWebhookEvent(createTestEvent('customer.subscription.updated', updatedSubscription))
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 4: invoice.payment_succeeded
  const invoice = {
    id: 'in_test_' + Date.now(),
    object: 'invoice',
    customer: 'cus_test_' + Date.now(),
    subscription: subscription.id,
    amount_paid: 990,
    currency: 'usd',
    status: 'paid',
    period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
  }
  
  await sendWebhookEvent(createTestEvent('invoice.payment_succeeded', invoice))
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 5: invoice.payment_failed
  const failedInvoice = {
    ...invoice,
    id: 'in_failed_' + Date.now(),
    status: 'open',
    amount_paid: 0
  }
  
  await sendWebhookEvent(createTestEvent('invoice.payment_failed', failedInvoice))
  
  console.log('')
  console.log('🎉 Webhook testing complete!')
  console.log('')
  console.log('Check your server logs to see if the events were processed correctly.')
  console.log('You can also check the database:')
  console.log('  sqlite3 ./data/payment.db "SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 10;"')
}

// Run the tests
testWebhooks().catch(console.error)
