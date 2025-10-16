#!/usr/bin/env node

/**
 * Complete test script for payment service with real Stripe
 * 
 * This script:
 * 1. Generates a test JWT token
 * 2. Creates an order via API
 * 3. Shows the Stripe checkout URL
 * 4. Polls for order completion
 * 
 * Prerequisites:
 * - Payment service running (npm run dev)
 * - Real Stripe test keys configured in .env
 * - Webhook configured (ngrok or Stripe CLI)
 */

import jwt from 'jsonwebtoken'
import { config } from 'dotenv'

// Load environment variables
config()

const API_BASE = process.env.API_BASE || 'http://localhost:8790'
const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-key-change-in-production'

// Generate test user
const userId = `test-user-${Math.random().toString(36).substring(2, 10)}`
const email = `${userId}@example.com`
const idempotencyKey = `idem-${Math.random().toString(36).substring(2, 15)}`

console.log('\n🚀 Payment Service Test with Real Stripe\n')
console.log('═'.repeat(80))

// Step 1: Generate JWT
console.log('\n📋 Step 1: Generating JWT Token...')
const token = jwt.sign(
  {
    sub: userId,
    iss: 'mainline',
    email: email
  },
  JWT_SECRET,
  { expiresIn: '7d' }
)
console.log(`✅ JWT Generated for user: ${userId}`)

// Step 2: Create Order
console.log('\n📋 Step 2: Creating Order...')
console.log(`   API: ${API_BASE}/api/v1/create-order`)
console.log(`   User: ${userId}`)
console.log(`   Idempotency Key: ${idempotencyKey}`)

try {
  const response = await fetch(`${API_BASE}/api/v1/create-order`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      user_id: userId
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API request failed (${response.status}): ${error}`)
  }

  const data = await response.json()
  
  console.log('\n✅ Order Created Successfully!')
  console.log('\n─'.repeat(80))
  console.log('\nOrder Details:')
  console.log(`  Order ID:     ${data.order_id}`)
  console.log(`  Status:       ${data.status}`)
  console.log(`  Amount:       ${data.currency} ${data.amount}`)
  console.log(`  Session ID:   ${data.session_id}`)
  console.log('\n─'.repeat(80))
  console.log('\n💳 Stripe Checkout URL:\n')
  console.log(`  ${data.checkout_url}`)
  console.log('\n─'.repeat(80))
  console.log('\n📋 Next Steps:\n')
  console.log('1. Open the checkout URL above in your browser')
  console.log('2. Use Stripe test card: 4242 4242 4242 4242')
  console.log('   - Expiry: Any future date (e.g., 12/34)')
  console.log('   - CVC: Any 3 digits (e.g., 123)')
  console.log('   - Email: Any email address')
  console.log('3. Complete the payment')
  console.log('4. Check order status below...\n')
  console.log('─'.repeat(80))

  // Step 3: Poll for Order Completion
  console.log('\n📋 Step 3: Monitoring Order Status...')
  console.log('   (Waiting for webhook to update status to "completed")\n')

  const orderId = data.order_id
  let attempts = 0
  const maxAttempts = 60  // 5 minutes (60 * 5 seconds)

  const checkStatus = async () => {
    attempts++
    
    const statusResponse = await fetch(`${API_BASE}/api/v1/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (statusResponse.ok) {
      const orderData = await statusResponse.json()
      process.stdout.write(`\r   [${attempts}] Status: ${orderData.status.padEnd(20)}`)

      if (orderData.status === 'completed') {
        console.log('\n\n✅ Payment Completed Successfully!\n')
        console.log('─'.repeat(80))
        console.log('\nFinal Order Details:')
        console.log(`  Order ID:        ${orderData.order_id}`)
        console.log(`  User ID:         ${orderData.user_id}`)
        console.log(`  Status:          ${orderData.status}`)
        console.log(`  Amount:          ${orderData.currency} ${orderData.amount}`)
        console.log(`  Subscription ID: ${orderData.subscription_id || 'N/A'}`)
        console.log(`  Created:         ${new Date(orderData.created_at).toISOString()}`)
        console.log(`  Updated:         ${new Date(orderData.updated_at).toISOString()}`)
        console.log('\n─'.repeat(80))
        console.log('\n🎉 Test Completed Successfully!\n')
        return true
      } else if (orderData.status === 'failed' || orderData.status === 'cancelled') {
        console.log(`\n\n❌ Payment ${orderData.status}!\n`)
        return true
      }
    }

    if (attempts >= maxAttempts) {
      console.log('\n\n⚠️  Timeout: Payment not completed within 5 minutes')
      console.log('   This is normal if you haven\'t completed the checkout yet.')
      console.log('   You can check the order status manually:\n')
      console.log(`   curl -H "Authorization: Bearer ${token}" \\`)
      console.log(`        ${API_BASE}/api/v1/orders/${orderId}\n`)
      return true
    }

    // Wait 5 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 5000))
    return checkStatus()
  }

  await checkStatus()

} catch (error) {
  console.error('\n❌ Test Failed:\n')
  console.error(`   ${error.message}\n`)
  
  if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
    console.error('⚠️  Make sure the payment service is running:')
    console.error('   npm run dev\n')
  } else if (error.message.includes('Invalid Stripe')) {
    console.error('⚠️  Check your Stripe configuration in .env:')
    console.error('   - STRIPE_SECRET_KEY should start with sk_test_')
    console.error('   - STRIPE_MONTHLY_PRICE_ID should start with price_')
    console.error('   See STRIPE_SETUP_GUIDE.md for instructions\n')
  }
  
  process.exit(1)
}

