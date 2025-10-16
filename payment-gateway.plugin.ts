import { registerPlugin } from '../CG_plugins/plugins/registry.js'
import { request } from 'undici'
import { ValidationError } from '../errors/validation.error.js'
import { SC } from '../constants/status-codes.js'
import { getConfig } from '../config.js'
import type { PluginContext, PluginResponse } from '../types/index.js'
import crypto from 'node:crypto'

const JSON_HEADERS = { 'content-type': 'application/json' }

/**
 * payment.subscribe - Create subscription checkout session
 * Delegates to isolated payment service
 */
registerPlugin('payment.subscribe', async ({ intent }: PluginContext): Promise<PluginResponse> => {
  try {
    const jwt = ensureJWT(intent?.inputs)
    const idempotencyKey = generateIdempotencyKey(intent?.inputs)
    const config = getConfig()
    
    console.log('[payment.subscribe] Creating subscription checkout session')
    
    // Extract business parameters from inputs (with defaults)
    const productId = intent?.inputs?.product_id || 'monthly-plan'
    const currency = intent?.inputs?.currency || 'SGD'
    const paymentMethod = intent?.inputs?.payment_method
    const customerEmail = intent?.inputs?.customer_email
    const platform = intent?.inputs?.platform
    const clientRef = intent?.inputs?.client_ref
    
    const response = await callPaymentService(
      config.paymentService.url,
      '/api/payment/create-subscription',
      { 
        jwt,
        idempotency_key: idempotencyKey,
        product_id: productId,
        currency,
        payment_method: paymentMethod,
        payment_gateway: 'stripe',
        customer_email: customerEmail,
        platform,
        client_ref: clientRef
      }
    )

    return {
      status_code: SC.OK,
      message: 'Subscription checkout created',
      data: response
    }

  } catch (error) {
    if (error instanceof ValidationError) {
      return { status_code: SC.BAD_REQUEST, message: error.message, data: {} }
    }
    const message = error instanceof Error ? error.message : String(error)
    return {
      status_code: SC.INTERNAL,
      message: `Failed to create subscription: ${message}`,
      data: {}
    }
  }
})

/**
 * payment.verify - Verify subscription status
 * Checks if user has active subscription
 */
registerPlugin('payment.verify', async ({ intent }: PluginContext): Promise<PluginResponse> => {
  try {
    const jwt = ensureJWT(intent?.inputs)
    const config = getConfig()

    console.log('[payment.verify] Verifying subscription status')

    const response = await callPaymentService(
      config.paymentService.url,
      '/api/payment/verify-subscription',
      { jwt }
    )

    return {
      status_code: SC.OK,
      message: 'Subscription status retrieved',
      data: response
    }

  } catch (error) {
    if (error instanceof ValidationError) {
      return { status_code: SC.BAD_REQUEST, message: error.message, data: {} }
    }
    const message = error instanceof Error ? error.message : String(error)
    return {
      status_code: SC.INTERNAL,
      message: `Failed to verify subscription: ${message}`,
      data: {}
    }
  }
})

/**
 * Ensure JWT is provided in inputs
 */
function ensureJWT(inputs: any): string {
  const jwt = typeof inputs?.jwt === 'string' ? inputs.jwt.trim() : ''
  if (!jwt) {
    throw new ValidationError('JWT token is required')
  }
  return jwt
}

/**
 * Generate or use provided idempotency key
 * Uses client-provided key if available, otherwise generates UUID v4
 */
function generateIdempotencyKey(inputs: any): string {
  // Use client-provided idempotency_key if available
  if (typeof inputs?.idempotency_key === 'string' && inputs.idempotency_key.trim()) {
    return inputs.idempotency_key.trim()
  }
  
  // Generate UUID v4 for idempotency
  return crypto.randomUUID()
}

/**
 * Call payment service API
 */
async function callPaymentService(baseUrl: string, path: string, body: any): Promise<any> {
  const url = new URL(path, baseUrl)
  let response

  try {
    response = await request(url, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Payment service unreachable: ${message}`)
  }

  if (!response.body) {
    throw new Error('Payment service returned no response body')
  }

  const text = await response.body.text()
  let json

  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Payment service returned invalid JSON')
  }

  if (response.statusCode >= 400) {
    throw new Error(json.message || 'Payment service error')
  }

  return json.data || json
}

