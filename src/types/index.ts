import { z } from 'zod'

// ============================================================================
// Plugin System Types (mini version of mainline)
// ============================================================================

export interface PluginContext {
  requestId: string
  userId: string
  userEmail?: string
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
  user_email: string
  user_id?: string
  stripe_session_id?: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  status: 'pending' | 'active' | 'canceled' | 'expired' | 'incomplete'
  plan: string
  amount: number
  currency: string
  created_at: number
  updated_at: number
  expires_at?: number
}

export interface PaymentEvent {
  event_id: string
  event_type: string
  processed_at: number
  order_id?: string
}

// ============================================================================
// JWT Payload
// ============================================================================

export const JWTPayloadSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email(),
  username: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional()
})

export type JWTPayload = z.infer<typeof JWTPayloadSchema>

// ============================================================================
// API Request/Response Schemas
// ============================================================================

export const CreateSubscriptionRequestSchema = z.object({
  jwt: z.string().min(1, 'JWT token is required')
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
  userEmail: z.string().email(),
  userId: z.string().optional(),
  plan: z.string(),
  amount: z.number().positive(),
  currency: z.string()
})

export const UpdateSubscriptionInputSchema = z.object({
  orderId: z.string().optional(),
  userEmail: z.string().email().optional(),
  stripeSessionId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  stripeCustomerId: z.string().optional(),
  status: z.enum(['pending', 'active', 'canceled', 'expired', 'incomplete']).optional(),
  expiresAt: z.number().optional()
})

export const QuerySubscriptionInputSchema = z.object({
  userEmail: z.string().email().optional(),
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

