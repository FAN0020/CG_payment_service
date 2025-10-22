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
  'monthly-plan': {
    priceId: process.env.STRIPE_MONTHLY_PRICE_ID || '',
    amount: 9.90,
    currency: 'USD',
    type: 'subscription', // Recurring subscription
    name: 'Monthly Plan',
    description: 'Best for regular users',
    features: [
      'Everything in Test',
      'Unlimited course materials',
      'Advanced AI features',
      'Priority support',
      'Cancel anytime'
    ]
  },
  'monthly-plan-pro': {
    priceId: process.env.STRIPE_MONTHLY_PRO_PRICE_ID || '',
    amount: 58.90,
    currency: 'USD',
    type: 'subscription', // Recurring subscription
    name: 'Monthly Pro Plan',
    description: 'For power users and professionals',
    features: [
      'Everything in Monthly Plan',
      'Advanced analytics dashboard',
      'Custom integrations',
      'API access',
      'Dedicated support',
      'White-label options',
      'Advanced reporting',
      'Team collaboration tools'
    ]
  }
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
