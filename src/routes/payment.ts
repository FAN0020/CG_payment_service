import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CreateSubscriptionRequestSchema, VerifySubscriptionRequestSchema, ValidationError, PAYMENT_WHITELISTS, StripeError as CustomStripeError } from '../types/index.js'
import { JWTManager } from '../lib/jwt.js'
import { StripeManager } from '../lib/stripe.js'
import { PaymentDatabase } from '../lib/database.js'
import { handlerRegistry } from '../lib/handler-registry.js'
import { logger } from '../lib/logger.js'
import { nanoid } from 'nanoid'
import { getProductConfig, validateProductId } from '../config/products.js'
import { generateIdempotencyKey } from '../utils/hash.js'

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
    
    // Declare variables in outer scope for error handling
    let userId: string | undefined
    let productId: string | undefined
    let idempotency_key: string | undefined
    let activePaymentRecorded: boolean = false

    try {
      // Validate request body
      const validationResult = CreateSubscriptionRequestSchema.safeParse(request.body)
      if (!validationResult.success) {
        throw new ValidationError(`Invalid request: ${validationResult.error.message}`)
      }

      const { 
        jwt: token, 
        idempotency_key: clientIdempotencyKey, 
        payment_gateway,
        product_id,
        payment_method,
        customer_email,
        platform,
        client_ref
      } = validationResult.data

      // Verify and decode JWT (authentication only)
      const payload = jwtManager.verify(token)
      userId = payload.sub
      
      // Business parameters come from request body (with defaults)
      productId = product_id || 'monthly-plan'
      const paymentMethod = payment_method
      const customerEmail = customer_email || payload.email  // Fallback to JWT email if provided

      // Generate JWT-based idempotency key with fixed bucket size for consistency
      const timeoutMs = parseInt(process.env.PAYMENT_TIMEOUT_MS || '60000') // Default 60 seconds
      const bucketMinutes = Math.max(1, Math.floor(timeoutMs / 60000)) // At least 1 minute bucket
      idempotency_key = generateIdempotencyKey(userId, productId, bucketMinutes)

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
      
      // Log idempotency key details for diagnostics
      logger.info('[payment-service] idempotencyKey=<key> user=<id> product=<id>', {
        idempotencyKey: idempotency_key,
        userId,
        productId: productId,
        requestId,
        bucketMinutes,
        timeoutMs
      })
      logger.debug('Starting timeout-window and idempotency checks')

      // ========== TIMEOUT-WINDOW ENFORCEMENT ==========
      // Check if there's an active payment within the timeout window
      const activePayment = db.findActivePayment(userId, productId)
      if (activePayment && Date.now() - activePayment.created_at < timeoutMs) {
        logger.info('Active payment found within timeout window', {
          requestId,
          userId,
          productId,
          idempotencyKey: idempotency_key,
          activePaymentIdempotencyKey: activePayment.idempotency_key,
          timeRemaining: activePayment.expires_at - Date.now()
        })
        
        return reply.code(409).send({
          status_code: 409,
          message: 'Payment already in progress.',
          request_id: requestId,
          data: {
            idempotency_key: idempotency_key,
            session_url: activePayment.session_url,
            retry_after: Math.ceil((activePayment.expires_at - Date.now()) / 1000) // seconds
          }
        })
      }

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

      // ========== CONCURRENCY PROTECTION ==========
      // Try to record active payment immediately - this will fail if one already exists
      let activePaymentRecorded = false
      try {
        db.recordActivePayment(userId, productId, idempotency_key, null, timeoutMs)
        activePaymentRecorded = true
        logger.debug('Active payment record created - proceeding with checkout', { 
          requestId, 
          userId, 
          productId, 
          idempotencyKey: idempotency_key 
        })
      } catch (error: any) {
        // If recording failed due to constraint violation, there's already an active payment
        if (error.message.includes('Active payment already exists')) {
          const existingActivePayment = db.findActivePayment(userId, productId)
          if (existingActivePayment && Date.now() - existingActivePayment.created_at < timeoutMs) {
            logger.info('Concurrent payment detected - returning existing session', {
              requestId,
              userId,
              productId,
              idempotencyKey: idempotency_key,
              existingIdempotencyKey: existingActivePayment.idempotency_key,
              timeRemaining: existingActivePayment.expires_at - Date.now()
            })
            
            return reply.code(409).send({
              status_code: 409,
              message: 'Payment already in progress.',
              request_id: requestId,
              data: {
                idempotency_key: idempotency_key,
                session_url: existingActivePayment.session_url,
                retry_after: Math.ceil((existingActivePayment.expires_at - Date.now()) / 1000) // seconds
              }
            })
          }
        }
        // If it's not a constraint violation, re-throw the error
        throw error
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
        productType: productConfig.type as 'one-time' | 'subscription',
        idempotencyKey: idempotency_key  // Pass the idempotency key to Stripe
      })

      logger.debug('Stripe session created', { sessionId: session.id })
      
      // Log session creation with idempotency details
      logger.info('[payment-service] idempotencyKey=<key> user=<id> product=<id> session=<session_id>', {
        idempotencyKey: idempotency_key,
        userId,
        productId: productId,
        sessionId: session.id,
        requestId
      })

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

      // Step 4: Update active payment record with actual session URL
      if (activePaymentRecorded && session.url) {
        const updated = db.updateActivePaymentSessionUrl(userId, productId, session.url)
        if (updated) {
          logger.debug('Active payment updated with session URL', { requestId, userId, productId })
        } else {
          logger.warn('Failed to update active payment with session URL', { requestId, userId, productId })
        }
      }

      logger.info('Subscription creation successful', {
        requestId,
        userId,
        orderId,
        sessionId: session.id,
        productId
      })
      
      // Log idempotency verification success
      logger.info('[payment-service] Idempotency check passed: session created successfully', {
        idempotencyKey: idempotency_key,
        userId,
        productId: productId,
        sessionId: session.id,
        requestId
      })

      // Clean up active payment record on success (webhook will handle final cleanup)
      if (activePaymentRecorded) {
        // Keep the record for timeout window - webhook will clean it up
        logger.debug('Active payment record maintained for timeout window', { requestId, userId, productId })
      }

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
      // Clean up active payment record on error
      try {
        if (userId && productId && activePaymentRecorded) {
          db.removeActivePayment(userId, productId)
          logger.debug('Active payment record removed on error', { requestId, userId, productId })
        }
      } catch (cleanupError: any) {
        logger.warn('Failed to remove active payment record on error', { 
          requestId, 
          userId, 
          productId, 
          cleanupError: cleanupError.message 
        })
      }

      logger.error('Error in create-subscription handler', { 
        error: error.message, 
        errorType: error.constructor.name,
        requestId,
        userId,
        productId: productId,
        idempotencyKey: idempotency_key
      })
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

      // Handle Stripe idempotency conflicts gracefully
      if (error instanceof CustomStripeError && error.message.includes('Idempotency key already used')) {
        logger.info('Idempotency conflict detected - returning 409 status', {
          requestId,
          userId,
          idempotencyKey: idempotency_key,
          error: error.message
        })
        
        return reply.code(409).send({
          status_code: 409,
          message: 'Payment is already in progress. Please wait.',
          request_id: requestId,
          data: {
            idempotency_key: idempotency_key,
            retry_after: 5 // seconds
          }
        })
      }

      if (error instanceof CustomStripeError) {
        return reply.code(500).send({
          status_code: 500,
          message: 'Payment service temporarily unavailable'
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

