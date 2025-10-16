#!/usr/bin/env node

/**
 * Generate a test JWT token for API testing
 * 
 * Usage:
 *   node scripts/generate-test-jwt.js
 *   node scripts/generate-test-jwt.js user-123
 *   node scripts/generate-test-jwt.js user-123 test@example.com
 */

import jwt from 'jsonwebtoken'
import { config } from 'dotenv'

// Load environment variables
config()

const JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-key-change-in-production'

// Get user ID from command line or generate random one
const userId = process.argv[2] || `test-user-${Math.random().toString(36).substring(2, 10)}`
const email = process.argv[3] || `${userId}@example.com`

// Create JWT payload
const payload = {
  sub: userId,           // User ID (subject)
  iss: 'mainline',       // Issuer
  email: email,          // User email (optional)
  iat: Math.floor(Date.now() / 1000),  // Issued at
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)  // Expires in 7 days
}

// Sign the token
const token = jwt.sign(payload, JWT_SECRET)

console.log('\n🎫 Test JWT Token Generated\n')
console.log('─'.repeat(80))
console.log('\nUser Information:')
console.log(`  User ID:  ${userId}`)
console.log(`  Email:    ${email}`)
console.log(`  Expires:  ${new Date(payload.exp * 1000).toISOString()}`)
console.log('\nJWT Token:')
console.log(`  ${token}`)
console.log('\n─'.repeat(80))
console.log('\nExample cURL command:\n')
console.log(`curl -X POST http://localhost:8790/api/v1/create-order \\`)
console.log(`  -H "Authorization: Bearer ${token}" \\`)
console.log(`  -H "Content-Type: application/json" \\`)
console.log(`  -H "X-Idempotency-Key: idem-${Math.random().toString(36).substring(2, 15)}" \\`)
console.log(`  -d '{`)
console.log(`    "user_id": "${userId}"`)
console.log(`  }'`)
console.log('\n─'.repeat(80))
console.log('\n✅ Copy the token above to use in your API requests\n')

