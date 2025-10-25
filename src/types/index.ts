import { z } from 'zod'

// ============================================================================
// Plugin System Types (mini version of mainline)
// ============================================================================

export interface PluginContext {
  requestId: string
  userId: string
  timestamp: number
  inputs: Record<string, any>
}

export interface PluginResponse {
  status_code: number
  message: string
  data?: any
  requestId: string
}

export type PluginHandler = (ctx: PluginContext) => Promise<PluginResponse>

export interface PluginRegistry {
  [pluginName: string]: PluginHandler
}

// ============================================================================
// Database Types
// ============================================================================

export interface SubscriptionOrder {
  order_id: string
  user_id: string                      // Primary identifier (from JWT sub)
  stripe_session_id?: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  stripe_customer_email?: string       // Email for Stripe only
  status: 'pending' | 'active' | 'canceled' | 'expired' | 'incomplete'
  plan: string
  amount: number
  currency: string
  payment_method?: string              // From JWT
  platform?: string                    // From JWT metadata
  client_ref?: string                  // From JWT metadata
  request_id?: string                  // Short-lived request ID (15 min TTL)
  ad_source?: string                   // Advertising source
  campaign_id?: string                 // Campaign identifier
  created_at: number
  updated_at: number
  expires_at?: number
  request_expires_at?: number          // Request ID expiration timestamp
  // TODO: Remove after testing period
  test_activated?: boolean              // Flag for test-activated orders
  activation_code?: string             // Activation code used for test activation
}

export interface PaymentEvent {
  event_id: string
  event_type: string
  processed_at: number
  order_id?: string
}

export interface ClientIdempotencyRecord {
  idempotency_key: string
  user_id: string
  order_id: string
  created_at: number
  expires_at: number
}

// ============================================================================
// JWT Payload - Authentication Only
// ============================================================================

export const JWTPayloadSchema = z.object({
  // Standard JWT claims (authentication/authorization only)
  sub: z.string().min(1, 'User ID (sub) is required'),  // User ID
  iss: z.string().default('mainline'),                  // Issuer
  iat: z.number().optional(),                           // Issued at
  exp: z.number().optional(),                           // Expiration
  
  // Optional: email for display/customer support (not used for Stripe)
  email: z.string().email().optional(),
  
  // Optional: authorization roles/permissions
  roles: z.array(z.string()).optional(),
  
  // Optional: role field for backward compatibility
  role: z.string().optional(),
})

export type JWTPayload = z.infer<typeof JWTPayloadSchema>

// ============================================================================
// Business Logic Whitelists
// ============================================================================

// Allowed values for validation
const ALLOWED_PRODUCTS = ['daily-plan', 'weekly-plan', 'monthly-plan'] as const
const ALLOWED_CURRENCIES = ['SGD'] as const
const ALLOWED_PAYMENT_METHODS = ['card', 'alipay', 'wechat', 'paynow', 'grabpay'] as const

// Export allowed values for use in validation
export const PAYMENT_WHITELISTS = {
  PRODUCTS: ALLOWED_PRODUCTS,
  CURRENCIES: ALLOWED_CURRENCIES,
  PAYMENT_METHODS: ALLOWED_PAYMENT_METHODS
} as const

// ============================================================================
// API Request/Response Schemas
// ============================================================================

export const CreateSubscriptionRequestSchema = z.object({
  // Authentication
  jwt: z.string().min(1, 'JWT token is required'),
  
  // Idempotency
  idempotency_key: z.string().min(1, 'Idempotency key is required'),  // Client-generated UUID
  
  // Business parameters (validated against whitelists)
  product_id: z.enum(ALLOWED_PRODUCTS).default('weekly-plan').optional(),
  currency: z.enum(ALLOWED_CURRENCIES).default('SGD').optional(),
  payment_method: z.enum(ALLOWED_PAYMENT_METHODS).optional(),
  
  // Gateway selection
  payment_gateway: z.enum(['stripe', 'paypal', 'alipay']).default('stripe').optional(),
  
  // Optional: customer email for Stripe checkout
  customer_email: z.string().email().optional(),
  
  // Metadata for tracking/debugging
  platform: z.enum(['web', 'ios', 'android']).optional(),
  client_ref: z.string().optional(),
  
  // Promo code
  promo_code: z.string().optional(),
})

export const VerifySubscriptionRequestSchema = z.object({
  jwt: z.string().min(1, 'JWT token is required')
})

export type CreateSubscriptionRequest = z.infer<typeof CreateSubscriptionRequestSchema>
export type VerifySubscriptionRequest = z.infer<typeof VerifySubscriptionRequestSchema>

// ============================================================================
// Plugin Input Schemas
// ============================================================================

export const CreateOrderInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  stripeCustomerEmail: z.string().email().optional(),  // Email for Stripe checkout only
  plan: z.string(),
  amount: z.number().min(0), // Allow 0 for promo codes with 100% discount
  currency: z.string(),
  paymentMethod: z.string().optional(),
  platform: z.string().optional(),
  clientRef: z.string().optional(),
  promoCode: z.string().optional()
})

export const UpdateSubscriptionInputSchema = z.object({
  orderId: z.string().optional(),
  userId: z.string().optional(),
  stripeCustomerEmail: z.string().email().optional(),
  stripeSessionId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  stripeCustomerId: z.string().optional(),
  status: z.enum(['pending', 'active', 'canceled', 'expired', 'incomplete']).optional(),
  expiresAt: z.number().optional()
})

export const QuerySubscriptionInputSchema = z.object({
  userId: z.string().optional(),
  orderId: z.string().optional()
})

// ============================================================================
// Error Types
// ============================================================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class StripeError extends Error {
  constructor(message: string) {
    super(message)
  }
}

