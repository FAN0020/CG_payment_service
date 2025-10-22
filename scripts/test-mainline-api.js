#!/usr/bin/env node

/**
 * Test script for the encapsulated payment service API
 * Tests the new mainline-facing endpoints
 */

import { JWTManager } from './src/lib/jwt.js'
import { generateRequestId } from './src/lib/api-response.js'

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-must-be-at-least-32-characters-long'
const BASE_URL = process.env.BASE_URL || 'http://localhost:8790'

const jwtManager = new JWTManager(JWT_SECRET)

// Test data
const testUserId = 'test-user-123'
const testAdminId = 'admin-user-456'

// Generate test JWT tokens
const userToken = jwtManager.sign({
  sub: testUserId,
  iss: 'mainline',
  email: 'test@example.com',
  roles: ['user']
})

const adminToken = jwtManager.sign({
  sub: testAdminId,
  iss: 'mainline',
  email: 'admin@example.com',
  roles: ['admin']
})

async function makeRequest(endpoint: string, method: string = 'GET', body?: any, token?: string) {
  const url = `${BASE_URL}${endpoint}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const options: RequestInit = {
    method,
    headers
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, options)
    const data = await response.json()
    
    console.log(`\n${method} ${endpoint}`)
    console.log(`Status: ${response.status}`)
    console.log(`Response:`, JSON.stringify(data, null, 2))
    
    return { status: response.status, data }
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error)
    return { status: 0, error }
  }
}

async function runTests() {
  console.log('🧪 Testing Payment Service API')
  console.log('================================')
  
  // Test 1: Health check (no auth required)
  console.log('\n1. Testing health check...')
  await makeRequest('/api/payments/health')
  
  // Test 2: Create session with user token
  console.log('\n2. Testing create session with user token...')
  const createSessionResponse = await makeRequest('/api/payments/create-session', 'POST', {
    uid: testUserId,
    ad_source: 'google_ads',
    campaign_id: 'test_campaign'
  }, userToken)
  
  let requestId = null
  if (createSessionResponse.data?.data?.requestId) {
    requestId = createSessionResponse.data.data.requestId
    console.log(`✅ Created session with requestId: ${requestId}`)
  }
  
  // Test 3: Check status with user token
  if (requestId) {
    console.log('\n3. Testing status check with user token...')
    await makeRequest(`/api/payments/status/${requestId}`, 'GET', undefined, userToken)
  }
  
  // Test 4: Admin query
  console.log('\n4. Testing admin query...')
  await makeRequest(`/api/payments/admin/query/${testUserId}`, 'GET', undefined, adminToken)
  
  // Test 5: Unauthorized access (no token)
  console.log('\n5. Testing unauthorized access...')
  await makeRequest('/api/payments/create-session', 'POST', { uid: testUserId })
  
  // Test 6: Forbidden access (user trying to access another user's data)
  console.log('\n6. Testing forbidden access...')
  await makeRequest('/api/payments/create-session', 'POST', { uid: 'other-user-789' }, userToken)
  
  // Test 7: Admin trying to access admin endpoint
  console.log('\n7. Testing admin access to admin endpoint...')
  await makeRequest(`/api/payments/admin/query/${testUserId}`, 'GET', undefined, adminToken)
  
  // Test 8: Non-admin trying to access admin endpoint
  console.log('\n8. Testing non-admin access to admin endpoint...')
  await makeRequest(`/api/payments/admin/query/${testUserId}`, 'GET', undefined, userToken)
  
  console.log('\n✅ All tests completed!')
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error)
}

export { runTests }
