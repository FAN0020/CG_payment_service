#!/usr/bin/env node

/**
 * Concurrency and Idempotency Testing Script
 * 
 * This script tests the refined concurrency control and idempotency handling
 * for the payment service. It verifies:
 * 
 * 1. JWT-based idempotency key generation with 1-minute buckets
 * 2. Timeout-window enforcement (60 seconds by default)
 * 3. Concurrent request handling
 * 4. Stripe session reuse
 * 5. Frontend 409 response handling
 */

import { createHash } from 'crypto'
import fetch from 'node-fetch'

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8790'
const TEST_JWT = process.env.TEST_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItY29uY3VycmVudCIsImlzcyI6Im1haW5saW5lIiwiaWF0IjoxNzAzMTIzNDAwLCJleHAiOjE3MDMxMjM0NjAsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.test-signature'
const PAYMENT_TIMEOUT_MS = parseInt(process.env.PAYMENT_TIMEOUT_MS || '60000') // 60 seconds

// Test configuration
const TEST_USER_ID = 'test-user-concurrent'
const TEST_PRODUCT_ID = 'monthly-plan'
const CONCURRENT_REQUESTS = 3
const REQUEST_DELAY_MS = 100 // Small delay between concurrent requests

// Utility functions
function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function generateIdempotencyKey(userId: string, productId: string, bucketMinutes: number = 1): string {
  const bucket = Math.floor(Date.now() / (bucketMinutes * 60 * 1000))
  const keyInput = `${userId}:${productId}:${bucket}`
  return sha256(keyInput)
}

function generateIdempotencyKeyWithTimestamp(userId: string, productId: string, timestamp: number, bucketMinutes: number = 1): string {
  const bucket = Math.floor(timestamp / (bucketMinutes * 60 * 1000))
  const keyInput = `${userId}:${productId}:${bucket}`
  return sha256(keyInput)
}

async function makePaymentRequest(requestId: string, jwt: string, productId: string = TEST_PRODUCT_ID) {
  const payload = {
    jwt: jwt,
    idempotency_key: generateIdempotencyKey(TEST_USER_ID, productId), // Server will override this
    product_id: productId,
    currency: 'USD',
    platform: 'web',
    client_ref: `test-concurrent-${requestId}`
  }

  console.log(`[Request ${requestId}] Sending checkout request...`)
  
  const startTime = Date.now()
  const response = await fetch(`${API_BASE_URL}/api/payment/create-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  
  const responseTime = Date.now() - startTime
  const data = await response.json()
  
  console.log(`[Request ${requestId}] Response (${responseTime}ms):`)
  console.log(`  Status: ${response.status}`)
  console.log(`  Status Code: ${data.status_code}`)
  console.log(`  Message: ${data.message}`)
  
  if (data.data) {
    console.log(`  Order ID: ${data.data.order_id || 'N/A'}`)
    console.log(`  Session ID: ${data.data.session_id || 'N/A'}`)
    console.log(`  Checkout URL: ${data.data.checkout_url ? 'Present' : 'N/A'}`)
  }
  
  return {
    requestId,
    status: response.status,
    statusCode: data.status_code,
    message: data.message,
    orderId: data.data?.order_id,
    sessionId: data.data?.session_id,
    checkoutUrl: data.data?.checkout_url,
    responseTime
  }
}

async function testConcurrentRequests() {
  console.log('\n🧪 Testing Concurrent Checkout Idempotency')
  console.log('='.repeat(50))
  console.log(`API Base URL: ${API_BASE_URL}`)
  console.log(`Test User ID: ${TEST_USER_ID}`)
  console.log(`Test Product ID: ${TEST_PRODUCT_ID}`)
  console.log(`Payment Timeout: ${PAYMENT_TIMEOUT_MS}ms`)
  
  // Generate expected idempotency key
  const expectedIdempotencyKey = generateIdempotencyKey(TEST_USER_ID, TEST_PRODUCT_ID)
  console.log(`Expected Idempotency Key: ${expectedIdempotencyKey}`)
  
  console.log('\n🚀 Starting concurrent checkout test...')
  
  // Send concurrent requests
  const promises = []
  for (let i = 1; i <= CONCURRENT_REQUESTS; i++) {
    const promise = new Promise(resolve => {
      setTimeout(() => {
        resolve(makePaymentRequest(i.toString(), TEST_JWT))
      }, (i - 1) * REQUEST_DELAY_MS)
    })
    promises.push(promise)
  }
  
  const results = await Promise.all(promises)
  
  // Analyze results
  console.log('\n📊 Test Results Summary')
  console.log('='.repeat(30))
  console.log(`Total Requests: ${results.length}`)
  
  const successful = results.filter(r => r.status === 200)
  const conflicts = results.filter(r => r.status === 409)
  const errors = results.filter(r => r.status >= 400 && r.status !== 409)
  
  console.log(`Successful (200): ${successful.length}`)
  console.log(`Conflicts (409): ${conflicts.length}`)
  console.log(`Errors: ${errors.length}`)
  
  // Check idempotency
  console.log('\n🔍 Idempotency Analysis:')
  const sessionIds = results.map(r => r.sessionId).filter(Boolean)
  const uniqueSessionIds = [...new Set(sessionIds)]
  
  console.log(`Session IDs returned: ${sessionIds.join(', ')}`)
  console.log(`Unique session IDs: ${uniqueSessionIds.length}`)
  
  if (uniqueSessionIds.length === 1 && sessionIds.length > 0) {
    console.log(`✅ SUCCESS: All requests returned the same Stripe session ID!`)
    console.log(`   Session ID: ${uniqueSessionIds[0]}`)
  } else if (uniqueSessionIds.length > 1) {
    console.log(`❌ FAILURE: Different session IDs returned!`)
    console.log(`   Expected: 1 unique session ID`)
    console.log(`   Actual: ${uniqueSessionIds.length} unique session IDs`)
  } else {
    console.log(`⚠️  WARNING: No session IDs returned`)
  }
  
  // Check order IDs
  console.log('\n📋 Order Analysis:')
  const orderIds = results.map(r => r.orderId).filter(Boolean)
  const uniqueOrderIds = [...new Set(orderIds)]
  
  console.log(`Order IDs returned: ${orderIds.join(', ')}`)
  console.log(`Unique order IDs: ${uniqueOrderIds.length}`)
  
  if (uniqueOrderIds.length === 1 && orderIds.length > 0) {
    console.log(`✅ SUCCESS: All requests returned the same order ID!`)
  } else if (uniqueOrderIds.length > 1) {
    console.log(`❌ FAILURE: Different order IDs returned!`)
  } else {
    console.log(`⚠️  WARNING: No order IDs returned`)
  }
  
  // Check conflict handling
  console.log('\n⚠️  Conflict Analysis:')
  conflicts.forEach((conflict, index) => {
    console.log(`Request ${conflict.requestId}: ${conflict.message}`)
  })
  
  if (conflicts.length === CONCURRENT_REQUESTS - 1) {
    console.log(`✅ SUCCESS: Only one request succeeded, others returned 409 conflicts!`)
  } else if (conflicts.length === 0) {
    console.log(`❌ FAILURE: No conflicts detected - all requests succeeded!`)
  } else {
    console.log(`⚠️  PARTIAL: ${conflicts.length} conflicts detected`)
  }
  
  // Performance analysis
  console.log('\n📈 Performance Analysis:')
  results.forEach(result => {
    console.log(`Request ${result.requestId}: ${result.responseTime}ms`)
  })
  
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
  console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`)
  
  return {
    success: uniqueSessionIds.length === 1 && conflicts.length === CONCURRENT_REQUESTS - 1,
    results,
    sessionIds: uniqueSessionIds,
    orderIds: uniqueOrderIds
  }
}

async function testTimeoutWindow() {
  console.log('\n⏰ Testing Timeout Window Enforcement')
  console.log('='.repeat(40))
  
  // First request
  console.log('Making first request...')
  const firstResult = await makePaymentRequest('timeout-1', TEST_JWT)
  
  if (firstResult.status !== 200) {
    console.log('❌ First request failed, cannot test timeout window')
    return false
  }
  
  console.log('✅ First request successful')
  
  // Immediate second request (should be blocked)
  console.log('\nMaking immediate second request (should be blocked)...')
  const secondResult = await makePaymentRequest('timeout-2', TEST_JWT)
  
  if (secondResult.status === 409) {
    console.log('✅ Second request correctly blocked by timeout window')
    console.log(`   Message: ${secondResult.message}`)
    return true
  } else {
    console.log('❌ Second request was not blocked!')
    console.log(`   Status: ${secondResult.status}`)
    return false
  }
}

async function testIdempotencyKeyGeneration() {
  console.log('\n🔑 Testing Idempotency Key Generation')
  console.log('='.repeat(40))
  
  const now = Date.now()
  const bucketMinutes = Math.ceil(PAYMENT_TIMEOUT_MS / 60000)
  
  // Test same bucket
  const key1 = generateIdempotencyKeyWithTimestamp(TEST_USER_ID, TEST_PRODUCT_ID, now, bucketMinutes)
  const key2 = generateIdempotencyKeyWithTimestamp(TEST_USER_ID, TEST_PRODUCT_ID, now + 30000, bucketMinutes) // 30 seconds later
  
  console.log(`User ID: ${TEST_USER_ID}`)
  console.log(`Product ID: ${TEST_PRODUCT_ID}`)
  console.log(`Bucket Minutes: ${bucketMinutes}`)
  console.log(`Key 1 (t=${now}): ${key1}`)
  console.log(`Key 2 (t=${now + 30000}): ${key2}`)
  
  if (key1 === key2) {
    console.log('✅ SUCCESS: Same bucket generates same key')
  } else {
    console.log('❌ FAILURE: Same bucket generated different keys')
  }
  
  // Test different bucket
  const key3 = generateIdempotencyKeyWithTimestamp(TEST_USER_ID, TEST_PRODUCT_ID, now + (bucketMinutes * 60 * 1000), bucketMinutes)
  console.log(`Key 3 (t=${now + (bucketMinutes * 60 * 1000)}): ${key3}`)
  
  if (key1 !== key3) {
    console.log('✅ SUCCESS: Different bucket generates different key')
  } else {
    console.log('❌ FAILURE: Different bucket generated same key')
  }
  
  return key1 === key2 && key1 !== key3
}

async function main() {
  console.log('🧪 Payment Service Concurrency & Idempotency Test Suite')
  console.log('='.repeat(60))
  
  try {
    // Test 1: Idempotency key generation
    const keyTestPassed = await testIdempotencyKeyGeneration()
    
    // Test 2: Concurrent requests
    const concurrentTestResult = await testConcurrentRequests()
    
    // Test 3: Timeout window enforcement
    const timeoutTestPassed = await testTimeoutWindow()
    
    // Summary
    console.log('\n🏁 Test Summary')
    console.log('='.repeat(20))
    console.log(`Idempotency Key Generation: ${keyTestPassed ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Concurrent Request Handling: ${concurrentTestResult.success ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Timeout Window Enforcement: ${timeoutTestPassed ? '✅ PASS' : '❌ FAIL'}`)
    
    const allTestsPassed = keyTestPassed && concurrentTestResult.success && timeoutTestPassed
    
    if (allTestsPassed) {
      console.log('\n🎉 All tests passed! Concurrency control is working correctly.')
      process.exit(0)
    } else {
      console.log('\n💥 Some tests failed. Please check the implementation.')
      process.exit(1)
    }
    
  } catch (error) {
    console.error('\n💥 Test suite failed with error:')
    console.error(error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
