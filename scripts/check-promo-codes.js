#!/usr/bin/env node

/**
 * Promo Code Availability Checker
 * 
 * This script helps you check the status of promo codes in the database
 * Usage: node scripts/check-promo-codes.js [options]
 */

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Database path
const dbPath = join(__dirname, '..', 'data', 'payment.db')

/**
 * Initialize database connection
 */
function initDatabase() {
  try {
    const db = new Database(dbPath)
    console.log('✅ Connected to database:', dbPath)
    return db
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message)
    process.exit(1)
  }
}

/**
 * Get overall statistics
 */
function getOverallStats(db) {
  console.log('\n📊 PROMO CODE STATISTICS')
  console.log('=' .repeat(50))
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_used = FALSE THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN is_used = TRUE THEN 1 ELSE 0 END) as used,
      SUM(CASE WHEN expires_at IS NOT NULL AND expires_at < ? THEN 1 ELSE 0 END) as expired
    FROM promo_codes
  `).get(Date.now())
  
  console.log(`Total codes: ${stats.total}`)
  console.log(`Available: ${stats.available} (${((stats.available / stats.total) * 100).toFixed(1)}%)`)
  console.log(`Used: ${stats.used} (${((stats.used / stats.total) * 100).toFixed(1)}%)`)
  console.log(`Expired: ${stats.expired} (${((stats.expired / stats.total) * 100).toFixed(1)}%)`)
  
  return stats
}

/**
 * Show available codes
 */
function showAvailableCodes(db, limit = 10) {
  console.log(`\n🎫 AVAILABLE PROMO CODES (showing first ${limit})`)
  console.log('=' .repeat(50))
  
  const codes = db.prepare(`
    SELECT code, created_at, expires_at
    FROM promo_codes 
    WHERE is_used = FALSE 
      AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY created_at DESC
    LIMIT ?
  `).all(Date.now(), limit)
  
  if (codes.length === 0) {
    console.log('❌ No available codes found')
    return
  }
  
  codes.forEach((code, index) => {
    const created = new Date(code.created_at).toLocaleDateString()
    const expires = code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'Never'
    console.log(`${index + 1}. ${code.code} (Created: ${created}, Expires: ${expires})`)
  })
}

/**
 * Show recently used codes
 */
function showRecentlyUsed(db, limit = 10) {
  console.log(`\n📝 RECENTLY USED CODES (last ${limit})`)
  console.log('=' .repeat(50))
  
  const codes = db.prepare(`
    SELECT code, used_by, used_at
    FROM promo_codes 
    WHERE is_used = TRUE 
    ORDER BY used_at DESC 
    LIMIT ?
  `).all(limit)
  
  if (codes.length === 0) {
    console.log('✅ No codes have been used yet')
    return
  }
  
  codes.forEach((code, index) => {
    const usedDate = new Date(code.used_at).toLocaleString()
    console.log(`${index + 1}. ${code.code} (Used by: ${code.used_by}, Date: ${usedDate})`)
  })
}

/**
 * Check specific code
 */
function checkSpecificCode(db, code) {
  console.log(`\n🔍 CHECKING CODE: ${code}`)
  console.log('=' .repeat(50))
  
  const promoCode = db.prepare(`
    SELECT * FROM promo_codes WHERE code = ?
  `).get(code)
  
  if (!promoCode) {
    console.log('❌ Code not found in database')
    return
  }
  
  console.log(`Code: ${promoCode.code}`)
  console.log(`Plan: ${promoCode.plan_type} ($${promoCode.plan_amount} ${promoCode.plan_currency})`)
  console.log(`Created: ${new Date(promoCode.created_at).toLocaleString()}`)
  console.log(`Expires: ${promoCode.expires_at ? new Date(promoCode.expires_at).toLocaleString() : 'Never'}`)
  console.log(`Used: ${promoCode.is_used ? 'Yes' : 'No'}`)
  
  if (promoCode.is_used) {
    console.log(`Used by: ${promoCode.used_by}`)
    console.log(`Used at: ${new Date(promoCode.used_at).toLocaleString()}`)
  }
  
  // Check if expired
  if (promoCode.expires_at && promoCode.expires_at < Date.now()) {
    console.log('⚠️  Code has expired')
  } else if (!promoCode.is_used) {
    console.log('✅ Code is available for use')
  }
}

/**
 * Show expired codes
 */
function showExpiredCodes(db, limit = 10) {
  console.log(`\n⏰ EXPIRED CODES (showing first ${limit})`)
  console.log('=' .repeat(50))
  
  const codes = db.prepare(`
    SELECT code, created_at, expires_at
    FROM promo_codes 
    WHERE expires_at IS NOT NULL AND expires_at < ?
    ORDER BY expires_at DESC
    LIMIT ?
  `).all(Date.now(), limit)
  
  if (codes.length === 0) {
    console.log('✅ No expired codes found')
    return
  }
  
  codes.forEach((code, index) => {
    const created = new Date(code.created_at).toLocaleDateString()
    const expired = new Date(code.expires_at).toLocaleDateString()
    console.log(`${index + 1}. ${code.code} (Created: ${created}, Expired: ${expired})`)
  })
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  const value = args[1]
  
  const db = initDatabase()
  
  console.log('🎫 PROMO CODE CHECKER')
  console.log('=' .repeat(50))
  
  try {
    switch (command) {
      case 'stats':
        getOverallStats(db)
        break
        
      case 'available':
        const limit = value ? parseInt(value) : 10
        showAvailableCodes(db, limit)
        break
        
      case 'used':
        const usedLimit = value ? parseInt(value) : 10
        showRecentlyUsed(db, usedLimit)
        break
        
      case 'expired':
        const expiredLimit = value ? parseInt(value) : 10
        showExpiredCodes(db, expiredLimit)
        break
        
      case 'check':
        if (!value) {
          console.log('❌ Please provide a code to check: node scripts/check-promo-codes.js check CG-PR4T-WBBC')
          process.exit(1)
        }
        checkSpecificCode(db, value.toUpperCase())
        break
        
      case 'all':
      default:
        getOverallStats(db)
        showAvailableCodes(db, 5)
        showRecentlyUsed(db, 5)
        break
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    db.close()
  }
}

// Show usage if no arguments
if (process.argv.length === 2) {
  console.log('🎫 PROMO CODE CHECKER')
  console.log('=' .repeat(50))
  console.log('Usage:')
  console.log('  node scripts/check-promo-codes.js [command] [value]')
  console.log('')
  console.log('Commands:')
  console.log('  stats                    - Show overall statistics')
  console.log('  available [limit]        - Show available codes (default: 10)')
  console.log('  used [limit]             - Show recently used codes (default: 10)')
  console.log('  expired [limit]          - Show expired codes (default: 10)')
  console.log('  check <code>             - Check specific code (e.g., CG-PR4T-WBBC)')
  console.log('  all                      - Show all information (default)')
  console.log('')
  console.log('Examples:')
  console.log('  node scripts/check-promo-codes.js stats')
  console.log('  node scripts/check-promo-codes.js available 20')
  console.log('  node scripts/check-promo-codes.js check CG-PR4T-WBBC')
  console.log('  node scripts/check-promo-codes.js used 5')
  process.exit(0)
}

main()
