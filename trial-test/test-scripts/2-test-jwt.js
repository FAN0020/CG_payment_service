#!/usr/bin/env node
/**
 * Test 2: JWT Generation and Verification
 * Tests JWT token creation, validation, and error handling
 */

import jwt from 'jsonwebtoken'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config = JSON.parse(readFileSync(resolve(__dirname, '../mock-data/test-config.json'), 'utf-8'))

console.log('\n' + '='.repeat(80))
console.log('TEST 2: JWT Generation and Verification')
console.log('='.repeat(80))

let testResults = {
  testName: 'JWT Operations',
  timestamp: new Date().toISOString(),
  tests: [],
  passed: 0,
  failed: 0,
  generatedTokens: {}
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
  console.log('\n📋 Step 1: Generate Valid JWT Tokens')
  
  const JWT_SECRET = config.jwt.secret
  const basePayload = {
    sub: config.jwt.testUserId,
    iss: 'mainline',
    email: config.jwt.testEmail,
    iat: Math.floor(Date.now() / 1000)
  }

  // Generate standard token
  const standardToken = jwt.sign(
    { ...basePayload, exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) },
    JWT_SECRET
  )
  testResults.generatedTokens.standard = standardToken
  addTest('Generate standard JWT token', true, 'Valid for 7 days')
  console.log(`   Token: ${standardToken.substring(0, 50)}...`)

  // Generate short-lived token
  const shortToken = jwt.sign(
    { ...basePayload, exp: Math.floor(Date.now() / 1000) + 300 },
    JWT_SECRET
  )
  testResults.generatedTokens.shortLived = shortToken
  addTest('Generate short-lived token', true, 'Valid for 5 minutes')

  // Generate token with roles
  const adminToken = jwt.sign(
    { ...basePayload, exp: Math.floor(Date.now() / 1000) + 3600, roles: ['admin', 'user'] },
    JWT_SECRET
  )
  testResults.generatedTokens.withRoles = adminToken
  addTest('Generate token with roles', true, 'Includes roles array')

  console.log('\n📋 Step 2: Verify JWT Tokens')
  
  // Verify standard token
  try {
    const decoded = jwt.verify(standardToken, JWT_SECRET)
    const hasRequiredFields = decoded.sub && decoded.iss && decoded.iat && decoded.exp
    addTest('Verify standard token', hasRequiredFields, `Decoded: sub=${decoded.sub}`)
  } catch (err) {
    addTest('Verify standard token', false, err.message)
  }

  // Verify token with roles
  try {
    const decoded = jwt.verify(adminToken, JWT_SECRET)
    const hasRoles = Array.isArray(decoded.roles) && decoded.roles.includes('admin')
    addTest('Verify token with roles', hasRoles, `Roles: ${decoded.roles.join(', ')}`)
  } catch (err) {
    addTest('Verify token with roles', false, err.message)
  }

  console.log('\n📋 Step 3: Test JWT Error Handling')
  
  // Test expired token
  const expiredToken = jwt.sign(
    { ...basePayload, exp: Math.floor(Date.now() / 1000) - 1000 },
    JWT_SECRET
  )
  try {
    jwt.verify(expiredToken, JWT_SECRET)
    addTest('Reject expired token', false, 'Should have thrown error')
  } catch (err) {
    addTest('Reject expired token', err.name === 'TokenExpiredError', `Error: ${err.message}`)
  }

  // Test invalid signature
  const tamperedToken = standardToken.slice(0, -5) + 'XXXXX'
  try {
    jwt.verify(tamperedToken, JWT_SECRET)
    addTest('Reject tampered token', false, 'Should have thrown error')
  } catch (err) {
    addTest('Reject tampered token', err.name === 'JsonWebTokenError', `Error: ${err.message}`)
  }

  // Test wrong secret
  try {
    jwt.verify(standardToken, 'wrong-secret-key')
    addTest('Reject wrong secret', false, 'Should have thrown error')
  } catch (err) {
    addTest('Reject wrong secret', err.name === 'JsonWebTokenError', `Error: ${err.message}`)
  }

  // Test missing required fields
  const invalidPayload = jwt.sign({ email: 'test@example.com' }, JWT_SECRET)
  try {
    const decoded = jwt.verify(invalidPayload, JWT_SECRET)
    addTest('Detect missing required fields', !decoded.sub, `Missing 'sub' field`)
  } catch (err) {
    addTest('Detect missing required fields', true, err.message)
  }

  console.log('\n📋 Step 4: Test Decode Without Verification')
  
  const decodedWithoutVerification = jwt.decode(standardToken)
  const canDecode = decodedWithoutVerification && decodedWithoutVerification.sub === config.jwt.testUserId
  addTest('Decode token without verification', canDecode, 'Successfully decoded payload')

  console.log('\n📋 Step 5: Generate Multiple Test Users')
  
  const testUsers = [
    { userId: 'test-user-1', email: 'user1@test.com' },
    { userId: 'test-user-2', email: 'user2@test.com' },
    { userId: 'test-user-3', email: 'user3@test.com' }
  ]

  testUsers.forEach((user, index) => {
    const token = jwt.sign(
      {
        sub: user.userId,
        iss: 'mainline',
        email: user.email,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
      },
      JWT_SECRET
    )
    testResults.generatedTokens[`user${index + 1}`] = token
  })
  addTest('Generate multiple test users', true, `Created ${testUsers.length} user tokens`)

  console.log('\n' + '='.repeat(80))
  console.log(`✅ JWT Tests: ${testResults.passed} passed, ${testResults.failed} failed`)
  console.log('='.repeat(80))

  // Save results and tokens
  writeFileSync(
    resolve(__dirname, '../test-results/2-jwt-test.json'),
    JSON.stringify(testResults, null, 2)
  )

  // Save tokens for use in other tests
  writeFileSync(
    resolve(__dirname, '../mock-data/test-jwt-tokens.json'),
    JSON.stringify({
      secret: JWT_SECRET,
      tokens: testResults.generatedTokens,
      testUser: {
        userId: config.jwt.testUserId,
        email: config.jwt.testEmail
      },
      generated: new Date().toISOString()
    }, null, 2)
  )

  console.log('\n💾 Saved JWT tokens to: trial-test/mock-data/test-jwt-tokens.json')

  process.exit(testResults.failed > 0 ? 1 : 0)

} catch (error) {
  console.error('\n❌ JWT Test Failed:', error.message)
  addTest('Fatal error', false, error.message)
  process.exit(1)
}

