import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CreateSubscriptionRequestSchema, VerifySubscriptionRequestSchema, ValidationError, PAYMENT_WHITELISTS } from '../types/index.js'
import { JWTManager } from '../lib/jwt.js'
import { StripeManager } from '../lib/stripe.js'
import { PaymentDatabase } from '../lib/database.js'
import { handlerRegistry } from '../lib/handler-registry.js'
import { logger } from '../lib/logger.js'
import { nanoid } from 'nanoid'

interface PaymentConfig {
  priceId: string
  planAmount: number
  planCurrency: string
  successUrl: string
  cancelUrl: string
}

// Product configuration mapping
const PRODUCT_CONFIG: Record<string, { priceId: string; amount: number; currency: string; durationDays?: number }> = {
  'trial-plan': { priceId: process.env.STRIPE_TRIAL_PRICE_ID || '', amount: 1.00, currency: 'USD', durationDays: 2 },
  'monthly-plan': { priceId: process.env.STRIPE_MONTHLY_PRICE_ID || '', amount: 12.90, currency: 'USD' },
  'annual-plan': { priceId: process.env.STRIPE_ANNUAL_PRICE_ID || '', amount: 99.00, currency: 'SGD' },
  'basic-plan': { priceId: process.env.STRIPE_BASIC_PRICE_ID || '', amount: 4.90, currency: 'SGD' },
  'premium-plan': { priceId: process.env.STRIPE_PREMIUM_PRICE_ID || '', amount: 19.90, currency: 'SGD' }
}

/**
 * Payment API routes
 */
export async function registerPaymentRoutes(
  fastify: FastifyInstance,
  jwtManager: JWTManager,
  stripeManager: StripeManager,
  db: PaymentDatabase,
  config: PaymentConfig
): Promise<void> {

  /**
   * POST /api/payment/create-subscription
   * Create a Stripe checkout session for subscription
   */
  fastify.post('/api/payment/create-subscription', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = nanoid()

    try {
      // Validate request body
      const validationResult = CreateSubscriptionRequestSchema.safeParse(request.body)
      if (!validationResult.success) {
        throw new ValidationError(`Invalid request: ${validationResult.error.message}`)
      }

      const { 
        jwt: token, 
        idempotency_key, 
        payment_gateway,
        product_id,
        currency,
        payment_method,
        customer_email,
        platform,
        client_ref
      } = validationResult.data

      // Verify and decode JWT (authentication only)
      const payload = jwtManager.verify(token)
      const userId = payload.sub
      
      // Business parameters come from request body (with defaults)
      const productId = product_id || 'monthly-plan'
      const finalCurrency = currency || config.planCurrency
      const paymentMethod = payment_method
      const customerEmail = customer_email || payload.email  // Fallback to JWT email if provided

      logger.info('Create subscription request', {
        requestId,
        userId,
        productId,
        currency: finalCurrency,
        idempotencyKey: idempotency_key
      })
      console.log('[DEBUG] Step 1: Starting idempotency check')

      // ========== IDEMPOTENCY CHECK ==========
      // Check if this request was already processed
      const existingOrderId = db.checkIdempotency(idempotency_key, userId)
      console.log('[DEBUG] Step 2: Idempotency check complete, existingOrderId:', existingOrderId)
      if (existingOrderId) {
        const existingOrder = db.getOrderById(existingOrderId)
        logger.info('Idempotency check: returning existing order', {
          requestId,
          userId,
          orderId: existingOrderId
        })
        
        // Return the existing order's checkout URL (if still pending) or order info
        return reply.code(200).send({
          status_code: 200,
          message: 'Order already exists (idempotent request)',
          data: {
            checkout_url: existingOrder?.stripe_session_id ? `https://checkout.stripe.com/c/pay/${existingOrder.stripe_session_id}` : null,
            order_id: existingOrderId,
            session_id: existingOrder?.stripe_session_id,
            status: existingOrder?.status
          }
        })
      }

      // ========== WHITELIST VALIDATION ==========
      // Note: Basic validation already done by Zod schema, but we double-check for safety
      if (!PAYMENT_WHITELISTS.PRODUCTS.includes(productId as any)) {
        throw new ValidationError(`Invalid product_id: ${productId}. Allowed: ${PAYMENT_WHITELISTS.PRODUCTS.join(', ')}`)
      }

      if (!PAYMENT_WHITELISTS.CURRENCIES.includes(finalCurrency as any)) {
        throw new ValidationError(`Invalid currency: ${finalCurrency}. Allowed: ${PAYMENT_WHITELISTS.CURRENCIES.join(', ')}`)
      }

      if (paymentMethod && !PAYMENT_WHITELISTS.PAYMENT_METHODS.includes(paymentMethod as any)) {
        throw new ValidationError(`Invalid payment_method: ${paymentMethod}. Allowed: ${PAYMENT_WHITELISTS.PAYMENT_METHODS.join(', ')}`)
      }

      // Get product configuration
      const productConfig = PRODUCT_CONFIG[productId]
      if (!productConfig || !productConfig.priceId) {
        throw new ValidationError(`Product configuration not found for: ${productId}`)
      }

      console.log('[DEBUG] Step 3: Creating order via internal handler')
      // Step 1: Create order via internal handler
      const orderResult = await handlerRegistry.execute(
        'create-order',
        {
          userId,
          stripeCustomerEmail: customerEmail,  // From request body or JWT
          plan: `${productId}_${productConfig.amount}_${finalCurrency}`,
          amount: productConfig.amount,
          currency: finalCurrency,
          paymentMethod,
          platform,
          clientRef: client_ref
        },
        userId
      )

      if (orderResult.status_code !== 200) {
        throw new Error(`Failed to create order: ${orderResult.message}`)
      }

      const orderId = orderResult.data.order_id
      console.log('[DEBUG] Step 4: Order created, orderId:', orderId)

      // Record idempotency AFTER order creation
      db.recordIdempotency(idempotency_key, userId, orderId, 24)
      console.log('[DEBUG] Step 5: Idempotency recorded, calling Stripe API...')

      // Step 2: Create Stripe checkout session
      const session = await stripeManager.createCheckoutSession({
        customerEmail,  // From request body or JWT
        orderId,
        priceId: productConfig.priceId,
        successUrl: config.successUrl,
        cancelUrl: config.cancelUrl
      })

      console.log('[DEBUG] Step 6: Stripe session created, sessionId:', session.id)

      // Step 3: Update order with Stripe session ID
      await handlerRegistry.execute(
        'update-subscription',
        {
          orderId,
          stripeSessionId: session.id
        },
        userId
      )
      console.log('[DEBUG] Step 7: Order updated with session ID')

      logger.info('Subscription creation successful', {
        requestId,
        userId,
        orderId,
        sessionId: session.id,
        productId
      })

      return reply.code(200).send({
        status_code: 200,
        message: 'Checkout session created successfully',
        data: {
          checkout_url: session.url,
          order_id: orderId,
          session_id: session.id
        }
      })

    } catch (error: any) {
      console.log('[DEBUG] ERROR caught in create-subscription handler:', error.message)
      console.log('[DEBUG] Error type:', error.constructor.name)
      logger.error('Create subscription failed', {
        requestId,
        error: error.message
      })

      if (error instanceof ValidationError) {
        return reply.code(400).send({
          status_code: 400,
          message: error.message
        })
      }

      return reply.code(500).send({
        status_code: 500,
        message: `Failed to create subscription: ${error.message}`
      })
    }
  })

  /**
   * POST /api/payment/verify-subscription
   * Check if user has an active subscription
   */
  fastify.post('/api/payment/verify-subscription', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = nanoid()

    try {
      // Validate request body
      const validationResult = VerifySubscriptionRequestSchema.safeParse(request.body)
      if (!validationResult.success) {
        throw new ValidationError(`Invalid request: ${validationResult.error.message}`)
      }

      const { jwt: token } = validationResult.data

      // Verify and decode JWT
      const payload = jwtManager.verify(token)
      const userId = payload.sub

      logger.info('Verify subscription request', {
        requestId,
        userId
      })

      // Query subscription via internal handler
      const queryResult = await handlerRegistry.execute(
        'query-subscription',
        { userId },
        userId
      )

      if (queryResult.status_code !== 200) {
        throw new Error(`Failed to query subscription: ${queryResult.message}`)
      }

      const { is_active, active_subscription } = queryResult.data

      logger.info('Subscription verification successful', {
        requestId,
        userId,
        isActive: is_active
      })

      return reply.code(200).send({
        status_code: 200,
        message: 'Subscription status retrieved',
        data: {
          is_active,
          subscription: active_subscription
        }
      })

    } catch (error: any) {
      logger.error('Verify subscription failed', {
        requestId,
        error: error.message
      })

      if (error instanceof ValidationError) {
        return reply.code(400).send({
          status_code: 400,
          message: error.message
        })
      }

      return reply.code(500).send({
        status_code: 500,
        message: `Failed to verify subscription: ${error.message}`
      })
    }
  })

  /**
   * GET /api/payment/health
   * Health check endpoint
   */
  fastify.get('/api/payment/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({
      status: 'healthy',
      service: 'payment',
      timestamp: Date.now()
    })
  })
}

