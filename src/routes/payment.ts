import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CreateSubscriptionRequestSchema, VerifySubscriptionRequestSchema, ValidationError, PAYMENT_WHITELISTS } from '../types/index.js'
import { JWTManager } from '../lib/jwt.js'
import { StripeManager } from '../lib/stripe.js'
import { PaymentDatabase } from '../lib/database.js'
import { handlerRegistry } from '../lib/handler-registry.js'
import { logger } from '../lib/logger.js'
import { nanoid } from 'nanoid'
import { getProductConfig, validateProductId } from '../config/products.js'

interface PaymentConfig {
  priceId: string
  planAmount: number
  planCurrency: string
  successUrl: string
  cancelUrl: string
  baseUrl: string
  isProduction: boolean
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
      const paymentMethod = payment_method
      const customerEmail = customer_email || payload.email  // Fallback to JWT email if provided

      // ========== PRODUCT VALIDATION ==========
      // Validate product exists and is configured
      if (!validateProductId(productId)) {
        throw new ValidationError(
          `Invalid or unconfigured product: ${productId}. Please check your product configuration.`
        )
      }

      // Get product configuration (centralized)
      const productConfig = getProductConfig(productId)

      logger.info('Create subscription request', {
        requestId,
        userId,
        productId,
        currency: productConfig.currency,
        idempotencyKey: idempotency_key
      })
      logger.debug('Starting idempotency check')

      // ========== IDEMPOTENCY CHECK ==========
      // Check if this request was already processed
      const existingOrderId = db.checkIdempotency(idempotency_key, userId)
      logger.debug('Idempotency check complete', { existingOrderId })
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

      if (paymentMethod && !PAYMENT_WHITELISTS.PAYMENT_METHODS.includes(paymentMethod as any)) {
        throw new ValidationError(`Invalid payment_method: ${paymentMethod}. Allowed: ${PAYMENT_WHITELISTS.PAYMENT_METHODS.join(', ')}`)
      }

      logger.debug('Creating order via internal handler')
      // Step 1: Create order via internal handler
      const orderResult = await handlerRegistry.execute(
        'create-order',
        {
          userId,
          stripeCustomerEmail: customerEmail,  // From request body or JWT
          plan: `${productId}_${productConfig.amount}_${productConfig.currency}`,
          amount: productConfig.amount,
          currency: productConfig.currency,
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
      logger.debug('Order created', { orderId })

      // Record idempotency AFTER order creation
      db.recordIdempotency(idempotency_key, userId, orderId, 24)
      logger.debug('Idempotency recorded, calling Stripe API')

      // Step 2: Create Stripe checkout session
      const session = await stripeManager.createCheckoutSession({
        customerEmail,  // From request body or JWT
        orderId,
        priceId: productConfig.priceId,
        successUrl: config.successUrl,
        cancelUrl: config.cancelUrl,
        productType: productConfig.type as 'one-time' | 'subscription'
      })

      logger.debug('Stripe session created', { sessionId: session.id })

      // Step 3: Update order with Stripe session ID
      await handlerRegistry.execute(
        'update-subscription',
        {
          orderId,
          stripeSessionId: session.id
        },
        userId
      )
      logger.debug('Order updated with session ID')

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
      logger.error('Error in create-subscription handler', { error: error.message, errorType: error.constructor.name })
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
   * GET /api/payment/status/:sessionId
   * Get payment status by session ID
   */
  fastify.get('/api/payment/status/:sessionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = nanoid()
    const { sessionId } = request.params as { sessionId: string }

    try {
      logger.info('Payment status request', {
        requestId,
        sessionId
      })

      // Get order by session ID
      const order = db.getOrderBySessionId(sessionId)
      
      if (!order) {
        logger.warn('Order not found for session', {
          requestId,
          sessionId
        })
        return reply.code(404).send({
          status_code: 404,
          message: 'Order not found',
          data: {
            session_id: sessionId,
            status: 'not_found'
          }
        })
      }

      // Determine payment status
      let paymentStatus = 'pending'
      let error = null

      if (order.status === 'active') {
        paymentStatus = 'success'
      } else if (order.status === 'canceled') {
        paymentStatus = 'cancelled'
        error = 'Payment was cancelled'
      } else if (order.status === 'expired') {
        paymentStatus = 'failed'
        error = 'Payment expired'
      } else if (order.status === 'incomplete') {
        paymentStatus = 'failed'
        error = 'Payment incomplete'
      } else if (order.status === 'pending') {
        paymentStatus = 'pending'
      }

      logger.info('Payment status retrieved', {
        requestId,
        sessionId,
        orderId: order.order_id,
        status: paymentStatus
      })

      return reply.code(200).send({
        status_code: 200,
        message: 'Payment status retrieved successfully',
        data: {
          session_id: sessionId,
          order_id: order.order_id,
          status: paymentStatus,
          amount: order.amount,
          currency: order.currency,
          plan: order.plan,
          error: error,
          created_at: order.created_at,
          updated_at: order.updated_at
        }
      })

    } catch (error: any) {
      logger.error('Payment status request failed', {
        requestId,
        sessionId,
        error: error.message
      })
      
      return reply.code(500).send({
        status_code: 500,
        message: 'Internal server error',
        data: {
          session_id: sessionId,
          status: 'error',
          error: error.message
        }
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

  /**
   * GET /api/payment/config
   * Get payment service configuration and URLs
   */
  fastify.get('/api/payment/config', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({
      status_code: 200,
      message: 'Payment service configuration',
      data: {
        base_url: config.successUrl.replace('/payment/success', ''),
        api_base_url: `${config.successUrl.replace('/payment/success', '')}/api/payment`,
        endpoints: {
          create_subscription: '/api/payment/create-subscription',
          verify_subscription: '/api/payment/verify-subscription',
          payment_status: '/api/payment/status/:sessionId',
          health: '/api/payment/health',
          config: '/api/payment/config'
        },
        urls: {
          success: config.successUrl,
          cancel: config.cancelUrl
        },
        environment: process.env.NODE_ENV || 'development',
        is_production: process.env.NODE_ENV === 'production' || !!process.env.PRODUCTION_URL
      }
    })
  })
}

