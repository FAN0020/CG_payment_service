#!/usr/bin/env node

import { getMainlineNotifier, initializeMainlineNotifier } from '../src/lib/mainline-notifier.js'
import { logger } from '../src/lib/logger.js'

async function sendNotificationForOrder(orderId) {
  try {
    // Initialize notifier
    const mainlineBaseUrl = process.env.MAINLINE_BASE_URL || 'http://localhost:3000'
    const mainlineApiKey = process.env.MAINLINE_API_KEY || 'test-api-key'
    initializeMainlineNotifier(mainlineBaseUrl, mainlineApiKey, 10000)
    
    const notifier = getMainlineNotifier()
    
    // Send notification with test data (since we can't decrypt the existing data)
    await notifier.notifyPaymentCompletion({
      orderId: orderId,
      userId: 'test-user-decrypted', // This would be the decrypted user ID
      status: 'completed',
      timestamp: Date.now(),
      amount: 58.9, // This would be the decrypted amount
      currency: 'USD',
      plan: 'monthly-plan-pro_58.9_USD',
      subscriptionId: 'sub_test_123' // This would be the subscription ID
    })
    
    console.log('✅ Notification sent successfully!')
    console.log('Order ID:', orderId)
    console.log('Status: completed')
    console.log('Timestamp:', new Date().toISOString())
    
  } catch (error) {
    console.error('❌ Failed to send notification:', error.message)
    process.exit(1)
  }
}

// Get order ID from command line arguments
const orderId = process.argv[2]
if (!orderId) {
  console.error('Usage: node send-notification-simple.js <order_id>')
  process.exit(1)
}

sendNotificationForOrder(orderId)
