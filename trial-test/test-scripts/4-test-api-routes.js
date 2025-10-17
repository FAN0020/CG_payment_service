#!/usr/bin/env node
/**
 * Test 4: API Routes with Authentication
 * Tests create-subscription and verify-subscription endpoints with real JWT tokens
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config = JSON.parse(readFileSync(resolve(__dirname, '../mock-data/test-config.json'), 'utf-8'))
const tokens = JSON.parse(readFileSync(resolve(__dirname, '../mock-data/test-jwt-tokens.json'), 'utf-8'))
const BASE_URL = config.server.baseUrl

console.log('\n' + '='.repeat(80))
console.log('TEST 4: API Routes with Authentication')
console.log('='.repeat(80))

let testResults = {
  testName: 'API Routes',
  timestamp: new Date().toISOString(),
  tests: [],
  passed: 0,
  failed: 0,
  createdOrders: []
}

function addTest(name, passed, details) {
  testResults.tests.push({ name, passed, details })
  if (passed) {
    testResults.passed++
    console.log(`✅ ${name}`)
  } else {
    testResults.failed++
    console.log(`❌ ${name}`)
    if (details) console.log(`   ${details}`)
  }
}

async function runTests() {
  try {
    const jwt = tokens.tokens.standard
    
    console.log('\n📋 Step 1: Test Create Subscription (Trial Plan)')
    
    const trialRequest = {
      jwt,
      idempotency_key: randomUUID(),
      product_id: 'trial-plan',
      currency: 'USD',
      platform: 'web',
      customer_email: 'test@classguru.ai'
    }

    console.log('   Request:', JSON.stringify(trialRequest, null, 2))
    
    const trialResponse = await fetch(`${BASE_URL}/api/payment/create-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trialRequest)
    })

    addTest(
      'POST /api/payment/create-subscription (trial)',
      trialResponse.ok,
      `HTTP ${trialResponse.status}`
    )

    if (trialResponse.ok) {
      const trialData = await trialResponse.json()
      console.log('   Response:', JSON.stringify(trialData, null, 2))
      
      addTest(
        'Response includes checkout_url',
        trialData.checkout_url !== undefined,
        trialData.checkout_url ? 'URL present' : 'URL missing'
      )
      
      addTest(
        'Response includes order_id',
        trialData.order_id !== undefined,
        trialData.order_id || 'Missing'
      )
      
      if (trialData.order_id) {
        testResults.createdOrders.push({ plan: 'trial', orderId: trialData.order_id })
      }
    } else {
      const errorText = await trialResponse.text()
      console.log('   Error:', errorText)
    }

    console.log('\n📋 Step 2: Test Create Subscription (Monthly Plan)')
    
    const monthlyRequest = {
      jwt,
      idempotency_key: randomUUID(),
      product_id: 'monthly-plan',
      currency: 'USD',
      platform: 'web',
      customer_email: 'test@classguru.ai'
    }

    const monthlyResponse = await fetch(`${BASE_URL}/api/payment/create-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(monthlyRequest)
    })

    addTest(
      'POST /api/payment/create-subscription (monthly)',
      monthlyResponse.ok,
      `HTTP ${monthlyResponse.status}`
    )

    if (monthlyResponse.ok) {
      const monthlyData = await monthlyResponse.json()
      if (monthlyData.order_id) {
        testResults.createdOrders.push({ plan: 'monthly', orderId: monthlyData.order_id })
      }
    }

    console.log('\n📋 Step 3: Test Idempotency')
    
    const idempotencyKey = randomUUID()
    const request1 = {
      jwt,
      idempotency_key: idempotencyKey,
      product_id: 'monthly-plan',
      currency: 'USD'
    }

    const response1 = await fetch(`${BASE_URL}/api/payment/create-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request1)
    })

    if (response1.ok) {
      const data1 = await response1.json()
      
      // Same request with same idempotency key
      const response2 = await fetch(`${BASE_URL}/api/payment/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request1)
      })

      if (response2.ok) {
        const data2 = await response2.json()
        const sameOrderId = data1.order_id === data2.order_id
        addTest(
          'Idempotency returns same order',
          sameOrderId,
          sameOrderId ? `Both returned ${data1.order_id}` : 'Different orders created'
        )
      } else {
        addTest('Idempotency test', false, 'Second request failed')
      }
    } else {
      addTest('Idempotency test', false, 'First request failed')
    }

    console.log('\n📋 Step 4: Test Verify Subscription')
    
    const verifyRequest = { jwt }
    const verifyResponse = await fetch(`${BASE_URL}/api/payment/verify-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyRequest)
    })

    addTest(
      'POST /api/payment/verify-subscription',
      verifyResponse.ok,
      `HTTP ${verifyResponse.status}`
    )

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json()
      console.log('   Response:', JSON.stringify(verifyData, null, 2))
      
      addTest(
        'Verify response includes is_active',
        verifyData.is_active !== undefined,
        `is_active: ${verifyData.is_active}`
      )
      
      addTest(
        'Verify response includes all_orders',
        Array.isArray(verifyData.all_orders),
        `Found ${verifyData.all_orders?.length || 0} orders`
      )
    }

    console.log('\n📋 Step 5: Test Error Cases')
    
    // Missing JWT
    const noJwtResponse = await fetch(`${BASE_URL}/api/payment/create-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: 'monthly-plan' })
    })
    addTest(
      'Reject request without JWT',
      !noJwtResponse.ok,
      `HTTP ${noJwtResponse.status}`
    )

    // Invalid JWT
    const invalidJwtResponse = await fetch(`${BASE_URL}/api/payment/create-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jwt: 'invalid.jwt.token',
        idempotency_key: randomUUID(),
        product_id: 'monthly-plan'
      })
    })
    addTest(
      'Reject invalid JWT',
      !invalidJwtResponse.ok,
      `HTTP ${invalidJwtResponse.status}`
    )

    // Missing idempotency key
    const noIdempotencyResponse = await fetch(`${BASE_URL}/api/payment/create-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jwt,
        product_id: 'monthly-plan'
      })
    })
    addTest(
      'Reject request without idempotency_key',
      !noIdempotencyResponse.ok,
      `HTTP ${noIdempotencyResponse.status}`
    )

    // Invalid product
    const invalidProductResponse = await fetch(`${BASE_URL}/api/payment/create-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jwt,
        idempotency_key: randomUUID(),
        product_id: 'invalid-plan'
      })
    })
    addTest(
      'Reject invalid product_id',
      !invalidProductResponse.ok,
      `HTTP ${invalidProductResponse.status}`
    )

    console.log('\n' + '='.repeat(80))
    console.log(`✅ API Tests: ${testResults.passed} passed, ${testResults.failed} failed`)
    console.log('='.repeat(80))

    // Save results
    writeFileSync(
      resolve(__dirname, '../test-results/4-api-routes-test.json'),
      JSON.stringify(testResults, null, 2)
    )

    process.exit(testResults.failed > 0 ? 1 : 0)

  } catch (error) {
    console.error('\n❌ API Test Failed:', error.message)
    addTest('Fatal error', false, error.message)
    process.exit(1)
  }
}

runTests()

