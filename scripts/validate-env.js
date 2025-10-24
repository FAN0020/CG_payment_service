#!/usr/bin/env node

/**
 * Environment Validation Script
 * Validates that all required environment variables are set
 */

import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Load .env file
config()

const REQUIRED_VARS = [
  { name: 'STRIPE_SECRET_KEY', description: 'Stripe secret key (from Dashboard > API Keys)' },
  { name: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe webhook secret (from Dashboard > Webhooks)' },
  { name: 'JWT_SECRET', description: 'JWT secret for authentication' },
  { name: 'STRIPE_DAILY_PRICE_ID', description: 'Stripe price ID for daily subscription' },
  { name: 'STRIPE_WEEKLY_PRICE_ID', description: 'Stripe price ID for weekly subscription' },
  { name: 'STRIPE_MONTHLY_PRICE_ID', description: 'Stripe price ID for monthly subscription' }
]

const OPTIONAL_VARS = [
  { name: 'PORT', default: '8790' },
  { name: 'DB_PATH', default: './data/payment.db' },
  { name: 'DAILY_PLAN_AMOUNT', default: '1.99' },
  { name: 'WEEKLY_PLAN_AMOUNT', default: '9.90' },
  { name: 'MONTHLY_PLAN_AMOUNT', default: '14.90' },
  { name: 'PLAN_CURRENCY', default: 'SGD' },
  { name: 'NODE_ENV', default: 'development' }
]

console.log('🔍 Validating environment configuration...\n')

let hasErrors = false

// Check if .env file exists
if (!existsSync(resolve(process.cwd(), '.env'))) {
  console.error('❌ ERROR: .env file not found!')
  console.error('   Please copy .env.example to .env and fill in your values:')
  console.error('   $ cp .env.example .env\n')
  process.exit(1)
}

console.log('✅ .env file found\n')

// Validate required variables
console.log('📋 Required Variables:')
for (const { name, description } of REQUIRED_VARS) {
  const value = process.env[name]
  if (!value || value.includes('your_') || value.includes('change-this')) {
    console.error(`❌ ${name}`)
    console.error(`   Missing or placeholder value`)
    console.error(`   → ${description}\n`)
    hasErrors = true
  } else {
    // Mask sensitive values
    const maskedValue = value.substring(0, 8) + '...' + value.substring(value.length - 4)
    console.log(`✅ ${name} = ${maskedValue}`)
  }
}

// Show optional variables
console.log('\n📋 Optional Variables (using defaults if not set):')
for (const { name, default: defaultValue } of OPTIONAL_VARS) {
  const value = process.env[name] || defaultValue
  console.log(`✅ ${name} = ${value}`)
}

if (hasErrors) {
  console.error('\n❌ Environment validation failed!')
  console.error('   Please update your .env file with valid values.\n')
  console.error('   Need help? Check README.md for setup instructions.')
  process.exit(1)
}

console.log('\n✅ Environment validation passed!')
console.log('   All required variables are configured correctly.\n')
process.exit(0)

