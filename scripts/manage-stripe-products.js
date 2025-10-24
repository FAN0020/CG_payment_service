#!/usr/bin/env node
/**
 * Stripe Product Management Script
 * Helps manage Stripe products and prices for ClassGuru payment service
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
let envVars = {}
try {
  const envContent = readFileSync(resolve(__dirname, '.env'), 'utf-8')
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim()
    }
  })
} catch (error) {
  console.log('⚠️  No .env file found. Please create one with your Stripe keys.')
  process.exit(1)
}

const STRIPE_SECRET_KEY = envVars.STRIPE_SECRET_KEY

if (!STRIPE_SECRET_KEY) {
  console.log('❌ STRIPE_SECRET_KEY not found in .env file')
  console.log('Please add your Stripe secret key to .env file:')
  console.log('STRIPE_SECRET_KEY=sk_test_your_key_here')
  process.exit(1)
}

console.log('🔍 Checking existing Stripe products...\n')

async function listProducts() {
  try {
    const response = await fetch('https://api.stripe.com/v1/products?active=true&limit=10', {
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('❌ Error fetching products:', error.message)
    return []
  }
}

async function listPrices() {
  try {
    const response = await fetch('https://api.stripe.com/v1/prices?active=true&limit=20', {
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('❌ Error fetching prices:', error.message)
    return []
  }
}

async function createProduct(name, description) {
  try {
    const params = new URLSearchParams({
      name,
      description,
      metadata: JSON.stringify({
        service: 'classguru-payment',
        created_by: 'management-script'
      })
    })

    const response = await fetch('https://api.stripe.com/v1/products', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`❌ Error creating product "${name}":`, error.message)
    return null
  }
}

async function createPrice(productId, amount, currency, interval = null) {
  try {
    const params = new URLSearchParams({
      product: productId,
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase()
    })

    if (interval) {
      params.append('recurring[interval]', interval)
    }

    const response = await fetch('https://api.stripe.com/v1/prices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`❌ Error creating price for product ${productId}:`, error.message)
    return null
  }
}

async function archiveProduct(productId) {
  try {
    const response = await fetch(`https://api.stripe.com/v1/products/${productId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'active=false'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`❌ Error archiving product ${productId}:`, error.message)
    return null
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('ClassGuru Stripe Product Management')
  console.log('='.repeat(60))

  // List existing products
  const products = await listProducts()
  const prices = await listPrices()

  console.log('\n📦 Existing Products:')
  if (products.length === 0) {
    console.log('   No products found')
  } else {
    products.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} (ID: ${product.id})`)
      console.log(`      Description: ${product.description || 'No description'}`)
      console.log(`      Active: ${product.active}`)
      console.log(`      Created: ${new Date(product.created * 1000).toLocaleDateString()}`)
      console.log('')
    })
  }

  console.log('\n💰 Existing Prices:')
  if (prices.length === 0) {
    console.log('   No prices found')
  } else {
    prices.forEach((price, index) => {
      const amount = (price.unit_amount / 100).toFixed(2)
      const interval = price.recurring ? `/${price.recurring.interval}` : ' (one-time)'
      console.log(`   ${index + 1}. $${amount} ${price.currency.toUpperCase()}${interval}`)
      console.log(`      Product: ${price.product}`)
      console.log(`      Price ID: ${price.id}`)
      console.log('')
    })
  }

  // Check if we need to create new products
  const requiredProducts = [
    { name: 'ClassGuru Daily Plan', description: 'Daily access to ClassGuru AI features', amount: 1.99, interval: 'day' },
    { name: 'ClassGuru Weekly Plan', description: 'Weekly subscription to ClassGuru AI features', amount: 9.90, interval: 'week' },
    { name: 'ClassGuru Monthly Plan', description: 'Monthly subscription to ClassGuru AI features', amount: 14.90, interval: 'month' }
  ]

  console.log('\n🎯 Required Products for ClassGuru:')
  requiredProducts.forEach((product, index) => {
    const interval = product.interval ? `/${product.interval}` : ' (one-time)'
    console.log(`   ${index + 1}. ${product.name} - $${product.amount}${interval}`)
  })

  console.log('\n' + '='.repeat(60))
  console.log('Next Steps:')
  console.log('1. Review existing products above')
  console.log('2. Archive old products if needed (run with --archive flag)')
  console.log('3. Create new products (run with --create flag)')
  console.log('4. Update your .env file with the new price IDs')
  console.log('='.repeat(60))

  // Check command line arguments
  const args = process.argv.slice(2)
  
  if (args.includes('--create')) {
    console.log('\n🚀 Creating new products...')
    
    for (const productInfo of requiredProducts) {
      console.log(`\nCreating: ${productInfo.name}`)
      
      const product = await createProduct(productInfo.name, productInfo.description)
      if (product) {
        console.log(`✅ Product created: ${product.id}`)
        
        const price = await createPrice(product.id, productInfo.amount, 'usd', productInfo.interval)
        if (price) {
          console.log(`✅ Price created: ${price.id}`)
          console.log(`   Add to .env: STRIPE_${productInfo.name.replace(/[^A-Z0-9]/g, '_').toUpperCase()}_PRICE_ID=${price.id}`)
        }
      }
    }
  }

  if (args.includes('--archive')) {
    console.log('\n🗄️  Archiving old products...')
    
    for (const product of products) {
      if (!product.name.includes('ClassGuru')) {
        console.log(`Archiving: ${product.name} (${product.id})`)
        const result = await archiveProduct(product.id)
        if (result) {
          console.log(`✅ Archived: ${product.name}`)
        }
      }
    }
  }
}

main().catch(console.error)
