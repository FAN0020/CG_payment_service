/**
 * Product Configuration
 *
 * This file centralizes all product/plan definitions for the payment system.
 * Update this file when adding new plans or changing pricing - no need to touch route handlers.
 *
 * Principles:
 * - Encapsulation: All product data in one place
 * - Extensibility: Easy to add new plans
 * - Type Safety: TypeScript ensures consistency
 */

/**
 * Product Catalog
 *
 * To add a new plan:
 * 1. Create the product in Stripe Dashboard
 * 2. Add the product_id and configuration here
 * 3. Update STRIPE_<PLAN>_PRICE_ID in .env
 * 4. That's it! No code changes needed.
 */
export const PRODUCT_CATALOG = {
  'trial-plan': {
    priceId: process.env.STRIPE_TRIAL_PRICE_ID || '',
    amount: 1.00,
    currency: 'USD',
    durationDays: 2,
    name: 'Trial Plan',
    description: 'Perfect for trying out ClassGuru',
    features: [
      'Full platform access',
      'AI-powered course summaries',
      'Lecture transcription',
      '48-hour trial period'
    ]
  },
  'monthly-plan': {
    priceId: process.env.STRIPE_MONTHLY_PRICE_ID || '',
    amount: 12.90,
    currency: 'USD',
    name: 'Monthly Plan',
    description: 'Best for regular users',
    features: [
      'Everything in Trial',
      'Unlimited course materials',
      'Advanced AI features',
      'Priority support',
      'Cancel anytime'
    ]
  },
  // Example: Uncomment and configure these when needed
  /*
  'annual-plan': {
    priceId: process.env.STRIPE_ANNUAL_PRICE_ID || '',
    amount: 99.00,
    currency: 'USD',
    name: 'Annual Plan',
    description: 'Best value - save 36%',
    features: [
      'Everything in Monthly',
      '2 months free',
      'Premium support',
      'Early access to new features'
    ]
  },
  
  'premium-plan': {
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID || '',
    amount: 19.90,
    currency: 'USD',
    name: 'Premium Plan',
    description: 'For power users',
    features: [
      'Everything in Monthly',
      'Unlimited AI queries',
      'Custom integrations',
      'Dedicated support',
      'API access'
    ]
  }
  */
}

/**
 * Get product configuration by ID
 * @throws Error if product not found
 */
export function getProductConfig(productId: string) {
  const config = PRODUCT_CATALOG[productId as keyof typeof PRODUCT_CATALOG]
  if (!config) {
    throw new Error(`Product '${productId}' not found. Available products: ${Object.keys(PRODUCT_CATALOG).join(', ')}`)
  }
  if (!config.priceId) {
    throw new Error(`Product '${productId}' is not configured. Please set the Stripe Price ID in your .env file.`)
  }
  return config
}

/**
 * Get all available products
 */
export function getAllProducts() {
  return Object.entries(PRODUCT_CATALOG)
    .filter(([_, config]) => config.priceId) // Only return configured products
    .map(([id, config]) => ({ id, config }))
}

/**
 * Validate if a product ID exists
 */
export function validateProductId(productId: string): boolean {
  return productId in PRODUCT_CATALOG && !!PRODUCT_CATALOG[productId as keyof typeof PRODUCT_CATALOG].priceId
}
