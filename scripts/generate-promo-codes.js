#!/usr/bin/env node

/**
 * Generate 205 Promo Codes for $1.99 Daily Plan
 * 
 * This script generates 205 unique promo codes that provide
 * one free redemption of the $1.99 daily plan.
 */

import { randomBytes } from 'crypto'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const PROMO_COUNT = 205
const PLAN_AMOUNT = 1.99
const PLAN_CURRENCY = 'SGD'
const PLAN_TYPE = 'daily-plan'

/**
 * Generate a random promo code
 * Format: CG-XXXX-XXXX (8 characters, 2 groups of 4)
 */
function generatePromoCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'CG-'
  
  // Generate 4 characters
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  
  code += '-'
  
  // Generate another 4 characters
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  
  return code
}

/**
 * Create promo codes table if it doesn't exist
 */
function createPromoCodesTable(db) {
  console.log('📊 Using existing promo_codes table...')
  
  // Check if table exists and has the right structure
  const tableInfo = db.prepare("PRAGMA table_info(promo_codes)").all()
  console.log('📋 Existing table structure:', tableInfo.map(col => `${col.name} (${col.type})`).join(', '))
  
  console.log('✅ Using existing promo_codes table')
}

/**
 * Generate unique promo codes
 */
function generateUniquePromoCodes(count) {
  const codes = new Set()
  const generated = []
  
  console.log(`🎯 Generating ${count} unique promo codes...`)
  
  while (generated.length < count) {
    const code = generatePromoCode()
    
    if (!codes.has(code)) {
      codes.add(code)
      generated.push(code)
      
      if (generated.length % 50 === 0) {
        console.log(`   Generated ${generated.length}/${count} codes...`)
      }
    }
  }
  
  console.log(`✅ Generated ${generated.length} unique promo codes`)
  return generated
}

/**
 * Insert promo codes into database
 */
function insertPromoCodes(db, codes) {
  console.log('💾 Inserting promo codes into database...')
  
  const insertStmt = db.prepare(`
    INSERT INTO promo_codes (
      code, plan_type, plan_amount, plan_currency, is_used, used_by,
      created_at, used_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  const now = Date.now()
  const validUntil = now + (365 * 24 * 60 * 60 * 1000) // 1 year from now
  
  let inserted = 0
  
  for (const code of codes) {
    try {
      insertStmt.run(
        code,
        PLAN_TYPE, // plan_type
        PLAN_AMOUNT, // plan_amount
        PLAN_CURRENCY, // plan_currency
        0, // is_used (0 for false)
        null, // used_by
        now, // created_at
        null, // used_at
        validUntil // expires_at
      )
      inserted++
    } catch (error) {
      console.error(`❌ Failed to insert code ${code}:`, error.message)
    }
  }
  
  console.log(`✅ Inserted ${inserted}/${codes.length} promo codes`)
  return inserted
}

/**
 * Verify promo codes were created correctly
 */
function verifyPromoCodes(db) {
  console.log('🔍 Verifying promo codes...')
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_used = FALSE THEN 1 ELSE 0 END) as unused,
      SUM(CASE WHEN is_used = TRUE THEN 1 ELSE 0 END) as used
    FROM promo_codes
  `).get()
  
  console.log('📊 Promo Code Statistics:')
  console.log(`   Total codes: ${stats.total}`)
  console.log(`   Unused codes: ${stats.unused}`)
  console.log(`   Used codes: ${stats.used}`)
  
  // Show first 5 codes as examples
  const examples = db.prepare(`
    SELECT code, plan_type, plan_amount, plan_currency, created_at, expires_at
    FROM promo_codes 
    ORDER BY created_at 
    LIMIT 5
  `).all()
  
  console.log('\n📝 Example codes:')
  examples.forEach((example, index) => {
    const created = new Date(example.created_at).toISOString()
    const expires = new Date(example.expires_at).toISOString()
    console.log(`   ${index + 1}. ${example.code} (${example.plan_type} - $${example.plan_amount} ${example.plan_currency})`)
    console.log(`      Created: ${created}, Expires: ${expires}`)
  })
}

/**
 * Export codes to file
 */
async function exportCodesToFile(codes) {
  const fs = await import('fs')
  const path = join(__dirname, '..', 'data', 'promo-codes.txt')
  
  console.log('📄 Exporting codes to file...')
  
  const content = [
    '# ClassGuru Promo Codes - $1.99 Daily Plan',
    `# Generated: ${new Date().toISOString()}`,
    `# Total codes: ${codes.length}`,
    `# Plan: ${PLAN_TYPE} (${PLAN_AMOUNT} ${PLAN_CURRENCY})`,
    `# Expires: 1 year from generation`,
    '',
    ...codes
  ].join('\n')
  
  fs.writeFileSync(path, content)
  console.log(`✅ Codes exported to: ${path}`)
}

/**
 * Main execution
 */
async function main() {
  console.log('🎯 ClassGuru Promo Code Generator')
  console.log('=====================================')
  console.log(`📋 Generating ${PROMO_COUNT} promo codes for $${PLAN_AMOUNT} ${PLAN_TYPE}`)
  console.log('')
  
  try {
    // Initialize database
    const dbPath = join(__dirname, '..', 'data', 'payment.db')
    const db = new Database(dbPath)
    
    // Create table
    createPromoCodesTable(db)
    
    // Generate codes
    const codes = generateUniquePromoCodes(PROMO_COUNT)
    
    // Insert into database
    const inserted = insertPromoCodes(db, codes)
    
    // Verify
    verifyPromoCodes(db)
    
    // Export to file
    await exportCodesToFile(codes)
    
    console.log('\n🎉 Promo code generation completed successfully!')
    console.log(`📊 Generated ${inserted} promo codes for $${PLAN_AMOUNT} ${PLAN_TYPE}`)
    console.log('💡 Users can now redeem these codes for free daily plan access')
    
  } catch (error) {
    console.error('❌ Error generating promo codes:', error)
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)
