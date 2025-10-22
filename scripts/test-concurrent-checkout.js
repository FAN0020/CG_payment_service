#!/usr/bin/env node

/**
 * Automated Payment Service Concurrency & Idempotency Test
 * 
 * Validates the payment-service concurrency and idempotency logic after refactor.
 * 
 * Test Cases:
 * 1. Concurrent Payment Test - Multiple simultaneous requests with same JWT
 * 2. Timeout Window Test - New session only after timeout expires
 * 3. Idempotency Verification - Same JWT + product = same Stripe session
 * 4. Conflict Handling - Proper 409 responses for duplicates
 */

import fetch from 'node-fetch'
import { createHash } from 'crypto'

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8790'
const PAYMENT_TIMEOUT_MS = parseInt(process.env.PAYMENT_TIMEOUT_MS || '60000') // Default 60 seconds
const TEST_JWT = process.env.TEST_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItY29uY3VycmVudCIsImlzcyI6Im1haW5saW5lIiwiaWF0IjoxNzAzMTIzNDAwLCJleHAiOjE3MDMxMjM0NjAsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.test-signature'

// Test configuration
const TEST_PRODUCT_ID = 'monthly-plan'
const CONCURRENT_REQUEST_COUNT = 3
const TIMEOUT_TEST_WAIT_MS = PAYMENT_TIMEOUT_MS + 5000 // Wait timeout + 5 seconds buffer

/**
 * Generate expected idempotency key using same logic as server
 */
function generateExpectedIdempotencyKey(userId, productId, bucketMinutes = 1) {
  const bucket = Math.floor(Date.now() / (bucketMinutes * 60000))
  const keyData = `${userId}:${productId}:${bucket}`
  return createHash('sha256').update(keyData).digest('hex').substring(0, 16)
}

/**
 * Extract user ID from JWT payload
 */
function extractUserIdFromJWT(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString())
    return payload.sub || payload.uid || 'unknown'
  } catch (error) {
    return 'unknown'
  }
}

/**
 * Make a payment request to the checkout endpoint
 */
async function makePaymentRequest(requestId, jwt, productId = TEST_PRODUCT_ID, delayMs = 0) {
  if (delayMs > 0) {
    console.log(`[Request ${requestId}] Waiting ${delayMs}ms before request...`)
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  const payload = {
    product_id: productId
  }

  console.log(`[Request ${requestId}] Sending checkout request...`)
  console.log(`  Product ID: ${productId}`)
  console.log(`  Expected Idempotency Key: ${generateExpectedIdempotencyKey(extractUserIdFromJWT(jwt), productId)}`)
  
  const startTime = Date.now()
  const response = await fetch(`${API_BASE_URL}/api/payment/create-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jwt: jwt,
      product_id: productId,
      idempotency_key: `test-${requestId}-${Date.now()}`, // Server will override with JWT-based key
      platform: 'web',
      client_ref: `test-${requestId}`
    })
  })
  
  const responseTime = Date.now() - startTime
  const data = await response.json()
  
  console.log(`[Request ${requestId}] Response (${responseTime}ms):`)
  console.log(`  Status: ${response.status}`)
  console.log(`  Message: ${data.message}`)
  
  if (data.data) {
    console.log(`  Order ID: ${data.data.order_id || 'N/A'}`)
    console.log(`  Session ID: ${data.data.session_id || 'N/A'}`)
    console.log(`  Checkout URL: ${data.data.checkout_url ? 'Present' : 'N/A'}`)
    if (data.data.idempotency_key) {
      console.log(`  Idempotency Key: ${data.data.idempotency_key}`)
    }
    if (data.data.retry_after) {
      console.log(`  Retry After: ${data.data.retry_after}s`)
    }
  }
  
  return {
    requestId,
    status: response.status,
    message: data.message,
    orderId: data.data?.order_id,
    sessionId: data.data?.session_id,
    checkoutUrl: data.data?.checkout_url,
    idempotencyKey: data.data?.idempotency_key,
    retryAfter: data.data?.retry_after,
    responseTime
  }
}

/**
 * Test Case 1: Concurrent Payment Test
 * Simulate multiple simultaneous requests using the same JWT and product
 */
async function testConcurrentPayments() {
  console.log('🧪 Test Case 1: Concurrent Payment Test')
  console.log('========================================')
  console.log(`API Base URL: ${API_BASE_URL}`)
  console.log(`Test JWT: ${TEST_JWT.substring(0, 20)}...`)
  console.log(`Product ID: ${TEST_PRODUCT_ID}`)
  console.log(`Timeout Window: ${PAYMENT_TIMEOUT_MS}ms`)
  
  console.log('\n🚀 Starting concurrent checkout test...')
  
  // Send multiple concurrent requests
  const promises = []
  for (let i = 1; i <= CONCURRENT_REQUEST_COUNT; i++) {
    promises.push(makePaymentRequest(i, TEST_JWT))
  }
  
  const results = await Promise.all(promises)
  
  console.log('\n📊 Test Results Summary')
  console.log('======================')
  console.log(`Total Requests: ${results.length}`)
  
  const successful = results.filter(r => r.status === 200)
  const conflicts = results.filter(r => r.status === 409)
  const errors = results.filter(r => r.status >= 400 && r.status !== 409)
  
  console.log(`Successful (200): ${successful.length}`)
  console.log(`Conflicts (409): ${conflicts.length}`)
  console.log(`Errors: ${errors.length}`)
  
  // Check if we got the same session ID
  console.log('\n🔍 Idempotency Analysis:')
  const sessionIds = results.map(r => r.sessionId).filter(Boolean)
  const uniqueSessionIds = [...new Set(sessionIds)]
  
  console.log(`Session IDs returned: ${sessionIds.join(', ') || 'None'}`)
  console.log(`Unique session IDs: ${uniqueSessionIds.length}`)
  
  if (uniqueSessionIds.length === 1 && sessionIds.length > 0) {
    console.log(`✅ SUCCESS: All requests returned the same Stripe session ID!`)
    console.log(`   Session ID: ${uniqueSessionIds[0]}`)
  } else {
    console.log(`❌ FAILURE: Different session IDs returned!`)
    console.log(`   Expected: 1 unique session ID`)
    console.log(`   Actual: ${uniqueSessionIds.length} unique session IDs`)
  }
  
  // Check order IDs
  console.log('\n📋 Order Analysis:')
  const orderIds = results.map(r => r.orderId).filter(Boolean)
  const uniqueOrderIds = [...new Set(orderIds)]
  
  console.log(`Order IDs returned: ${orderIds.join(', ') || 'None'}`)
  console.log(`Unique order IDs: ${uniqueOrderIds.length}`)
  
  if (uniqueOrderIds.length === 1 && orderIds.length > 0) {
    console.log(`✅ SUCCESS: All requests returned the same order ID!`)
  } else {
    console.log(`❌ FAILURE: Different order IDs returned!`)
  }
  
  // Check conflict handling
  console.log('\n⚠️  Conflict Analysis:')
  conflicts.forEach((conflict, index) => {
    console.log(`Request ${conflict.requestId}: ${conflict.message}`)
    if (conflict.retryAfter) {
      console.log(`  Retry After: ${conflict.retryAfter}s`)
    }
  })
  
  const expectedConflicts = CONCURRENT_REQUEST_COUNT - 1
  if (conflicts.length === expectedConflicts) {
    console.log(`✅ SUCCESS: Only one request succeeded, others returned 409 conflicts!`)
  } else if (conflicts.length === 0) {
    console.log(`❌ FAILURE: No conflicts detected - all requests succeeded!`)
  } else {
    console.log(`⚠️  PARTIAL: ${conflicts.length} conflicts detected (expected ${expectedConflicts})`)
  }
  
  // Performance analysis
  console.log('\n📈 Performance Analysis:')
  results.forEach(result => {
    console.log(`Request ${result.requestId}: ${result.responseTime}ms`)
  })
  
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
  console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`)
  
  const success = uniqueSessionIds.length === 1 && conflicts.length === expectedConflicts
  return { success, results, sessionId: uniqueSessionIds[0] }
}

/**
 * Test Case 2: Timeout Window Test
 * Verify that new session is created only after timeout expires
 */
async function testTimeoutWindow(firstSessionId) {
  console.log('\n\n🧪 Test Case 2: Timeout Window Test')
  console.log('===================================')
  console.log(`Waiting ${TIMEOUT_TEST_WAIT_MS}ms for timeout window to expire...`)
  console.log(`First Session ID: ${firstSessionId}`)
  
  // Wait for timeout window to expire
  await new Promise(resolve => setTimeout(resolve, TIMEOUT_TEST_WAIT_MS))
  
  console.log('\n🚀 Testing payment after timeout...')
  
  // Make a new request after timeout
  const result = await makePaymentRequest('TIMEOUT', TEST_JWT)
  
  console.log('\n📊 Timeout Test Results')
  console.log('=======================')
  console.log(`Status: ${result.status}`)
  console.log(`Session ID: ${result.sessionId}`)
  console.log(`Order ID: ${result.orderId}`)
  
  if (result.status === 200 && result.sessionId && result.sessionId !== firstSessionId) {
    console.log(`✅ SUCCESS: New session created after timeout!`)
    console.log(`   Old Session: ${firstSessionId}`)
    console.log(`   New Session: ${result.sessionId}`)
    return { success: true, newSessionId: result.sessionId }
  } else if (result.status === 409) {
    console.log(`❌ FAILURE: Still getting 409 after timeout!`)
    console.log(`   Message: ${result.message}`)
    return { success: false, error: 'Still getting 409 after timeout' }
  } else if (result.sessionId === firstSessionId) {
    console.log(`❌ FAILURE: Same session ID returned after timeout!`)
    console.log(`   Session ID: ${result.sessionId}`)
    return { success: false, error: 'Same session ID after timeout' }
  } else {
    console.log(`❌ FAILURE: Unexpected result!`)
    console.log(`   Status: ${result.status}`)
    console.log(`   Message: ${result.message}`)
    return { success: false, error: 'Unexpected result' }
  }
}

/**
 * Test Case 3: Idempotency Key Verification
 * Verify that the same JWT + product generates the same idempotency key
 */
async function testIdempotencyKeyConsistency() {
  console.log('\n\n🧪 Test Case 3: Idempotency Key Consistency')
  console.log('============================================')
  
  const userId = extractUserIdFromJWT(TEST_JWT)
  const expectedKey = generateExpectedIdempotencyKey(userId, TEST_PRODUCT_ID)
  
  console.log(`User ID: ${userId}`)
  console.log(`Product ID: ${TEST_PRODUCT_ID}`)
  console.log(`Expected Idempotency Key: ${expectedKey}`)
  
  // Make two requests with small delay to ensure same bucket
  const result1 = await makePaymentRequest('KEY1', TEST_JWT)
  await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
  const result2 = await makePaymentRequest('KEY2', TEST_JWT)
  
  console.log('\n📊 Idempotency Key Test Results')
  console.log('===============================')
  console.log(`Request 1 Key: ${result1.idempotencyKey || 'N/A'}`)
  console.log(`Request 2 Key: ${result2.idempotencyKey || 'N/A'}`)
  console.log(`Expected Key: ${expectedKey}`)
  
  const keysMatch = result1.idempotencyKey === result2.idempotencyKey
  const keyMatchesExpected = result1.idempotencyKey === expectedKey
  
  if (keysMatch && keyMatchesExpected) {
    console.log(`✅ SUCCESS: Idempotency keys are consistent!`)
    return { success: true }
  } else {
    console.log(`❌ FAILURE: Idempotency keys don't match!`)
    if (!keysMatch) {
      console.log(`   Keys don't match each other`)
    }
    if (!keyMatchesExpected) {
      console.log(`   Keys don't match expected value`)
    }
    return { success: false, error: 'Idempotency key mismatch' }
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Automated Payment Service Concurrency & Idempotency Test')
  console.log('============================================================')
  console.log(`Test Configuration:`)
  console.log(`  API Base URL: ${API_BASE_URL}`)
  console.log(`  Product ID: ${TEST_PRODUCT_ID}`)
  console.log(`  Payment Timeout: ${PAYMENT_TIMEOUT_MS}ms`)
  console.log(`  Concurrent Requests: ${CONCURRENT_REQUEST_COUNT}`)
  console.log(`  Timeout Test Wait: ${TIMEOUT_TEST_WAIT_MS}ms`)
  
  const results = {
    concurrent: null,
    timeout: null,
    idempotency: null
  }
  
  try {
    // Test Case 1: Concurrent Payments
    results.concurrent = await testConcurrentPayments()
    
    if (results.concurrent.success) {
      // Test Case 2: Timeout Window (only if concurrent test passed)
      results.timeout = await testTimeoutWindow(results.concurrent.sessionId)
      
      // Test Case 3: Idempotency Key Consistency
      results.idempotency = await testIdempotencyKeyConsistency()
    } else {
      console.log('\n⚠️  Skipping timeout and idempotency tests due to concurrent test failure')
    }
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error)
    return false
  }
  
  // Final Results Summary
  console.log('\n\n🏁 Final Test Results Summary')
  console.log('=============================')
  
  const testResults = [
    { name: 'Concurrent Payment Test', result: results.concurrent },
    { name: 'Timeout Window Test', result: results.timeout },
    { name: 'Idempotency Key Test', result: results.idempotency }
  ]
  
  let allPassed = true
  testResults.forEach(test => {
    if (test.result) {
      const status = test.result.success ? '✅ PASSED' : '❌ FAILED'
      console.log(`${test.name}: ${status}`)
      if (!test.result.success) {
        allPassed = false
        if (test.result.error) {
          console.log(`  Error: ${test.result.error}`)
        }
      }
    } else {
      console.log(`${test.name}: ⏭️  SKIPPED`)
    }
  })
  
  console.log('\n' + '='.repeat(50))
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Payment service concurrency and idempotency working correctly!')
  } else {
    console.log('💥 SOME TESTS FAILED! Payment service needs attention.')
  }
  console.log('='.repeat(50))
  
  return allPassed
}

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    apiUrl: API_BASE_URL,
    jwt: TEST_JWT,
    productId: TEST_PRODUCT_ID,
    timeout: PAYMENT_TIMEOUT_MS,
    concurrentCount: CONCURRENT_REQUEST_COUNT,
    help: false
  }
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--api-url':
        config.apiUrl = args[++i]
        break
      case '--jwt':
        config.jwt = args[++i]
        break
      case '--product-id':
        config.productId = args[++i]
        break
      case '--timeout':
        config.timeout = parseInt(args[++i])
        break
      case '--concurrent':
        config.concurrentCount = parseInt(args[++i])
        break
      case '--help':
      case '-h':
        config.help = true
        break
    }
  }
  
  return config
}

// Help text
function showHelp() {
  console.log(`
🧪 Payment Service Concurrency & Idempotency Test

Usage: node scripts/test-concurrent-checkout.js [options]

Options:
  --api-url <url>        API base URL (default: http://localhost:8790)
  --jwt <token>         JWT token for testing (default: test token)
  --product-id <id>     Product ID to test (default: classguru-pro)
  --timeout <ms>         Payment timeout in milliseconds (default: 60000)
  --concurrent <count>   Number of concurrent requests (default: 3)
  --help, -h            Show this help message

Environment Variables:
  API_BASE_URL          Override API base URL
  TEST_JWT              Override JWT token
  PAYMENT_TIMEOUT_MS    Override payment timeout

Examples:
  # Basic test
  node scripts/test-concurrent-checkout.js

  # Test with custom API URL
  node scripts/test-concurrent-checkout.js --api-url http://localhost:3000

  # Test with custom JWT
  node scripts/test-concurrent-checkout.js --jwt "eyJhbGciOiJIUzI1NiIs..."

  # Test with custom timeout
  node scripts/test-concurrent-checkout.js --timeout 30000

Test Cases:
  1. Concurrent Payment Test - Multiple simultaneous requests with same JWT
  2. Timeout Window Test - New session only after timeout expires  
  3. Idempotency Key Test - Same JWT + product = same idempotency key

Expected Results:
  ✅ Same Stripe session ID for concurrent requests
  ✅ HTTP 409 "Payment already in progress" for duplicates
  ✅ New session created only after timeout expires
  ✅ Consistent idempotency key generation
`)
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = parseArgs()
  
  if (config.help) {
    showHelp()
    process.exit(0)
  }
  
  // Update global config with CLI args
  if (config.apiUrl !== API_BASE_URL) {
    process.env.API_BASE_URL = config.apiUrl
  }
  if (config.jwt !== TEST_JWT) {
    process.env.TEST_JWT = config.jwt
  }
  if (config.productId !== TEST_PRODUCT_ID) {
    process.env.TEST_PRODUCT_ID = config.productId
  }
  if (config.timeout !== PAYMENT_TIMEOUT_MS) {
    process.env.PAYMENT_TIMEOUT_MS = config.timeout.toString()
  }
  
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('\n❌ Test execution failed:', error)
      process.exit(1)
    })
}