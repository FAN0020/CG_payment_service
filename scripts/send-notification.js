#!/usr/bin/env node

import { getMainlineNotifier } from '../src/lib/mainline-notifier.js'
import { PaymentDatabase } from '../src/lib/database.js'
import { logger } from '../src/lib/logger.js'
import { initializeEncryption } from '../src/lib/encryption.js'

async function sendNotificationForOrder(orderId) {
  try {
    // Check environment variables
    const jwtSecret = process.env.JWT_SECRET
    console.log('JWT_SECRET length:', jwtSecret?.length || 'undefined')
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required')
    }
    
    // Initialize encryption
    initializeEncryption(jwtSecret)
    
    // Initialize database
    const db = new PaymentDatabase('./data/payment.db')
    
    // Get order details
    const order = db.getOrderById(orderId)
    if (!order) {
      console.error(`Order ${orderId} not found`)
      return
    }
    
    console.log('Order details:', {
      orderId: order.order_id,
      userId: order.user_id,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      plan: order.plan
    })
    
    // Initialize notifier
    const notifier = getMainlineNotifier()
    
    // Send notification
    await notifier.notifyPaymentCompletion({
      orderId: order.order_id,
      userId: order.user_id,
      status: 'completed',
      timestamp: Date.now(),
      amount: order.amount,
      currency: order.currency,
      plan: order.plan,
      subscriptionId: order.stripe_subscription_id
    })
    
    console.log('✅ Notification sent successfully!')
    
  } catch (error) {
    console.error('❌ Failed to send notification:', error.message)
    process.exit(1)
  }
}

// Get order ID from command line arguments
const orderId = process.argv[2]
if (!orderId) {
  console.error('Usage: node send-notification.js <order_id>')
  process.exit(1)
}

sendNotificationForOrder(orderId)
