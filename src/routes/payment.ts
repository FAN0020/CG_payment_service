import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { CreateSubscriptionRequestSchema, VerifySubscriptionRequestSchema, ValidationError } from '../types/index.js'
import { JWTManager } from '../lib/jwt.js'
import { StripeManager } from '../lib/stripe.js'
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

/**
 * Payment API routes
 */
export async function registerPaymentRoutes(
  fastify: FastifyInstance,
  jwtManager: JWTManager,
  stripeManager: StripeManager,
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

      const { jwt: token } = validationResult.data

      // Verify and decode JWT
      const payload = jwtManager.verify(token)
      const userEmail = payload.email
      const userId = payload.userId || 'unknown'

      logger.info('Create subscription request', {
        requestId,
        userId,
        userEmail
      })

      // Step 1: Create order via internal handler
      const orderResult = await handlerRegistry.execute(
        'create-order',
        {
          userEmail,
          userId,
          plan: 'monthly_9.9_SGD',
          amount: config.planAmount,
          currency: config.planCurrency
        },
        userId,
        userEmail
      )

      if (orderResult.status_code !== 200) {
        throw new Error(`Failed to create order: ${orderResult.message}`)
      }

      const orderId = orderResult.data.order_id

      // Step 2: Create Stripe checkout session
      const session = await stripeManager.createCheckoutSession({
        userEmail,
        orderId,
        priceId: config.priceId,
        successUrl: config.successUrl,
        cancelUrl: config.cancelUrl
      })

      // Step 3: Update order with Stripe session ID
      await handlerRegistry.execute(
        'update-subscription',
        {
          orderId,
          stripeSessionId: session.id
        },
        userId,
        userEmail
      )

      logger.info('Subscription creation successful', {
        requestId,
        userId,
        orderId,
        sessionId: session.id
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
      const userEmail = payload.email
      const userId = payload.userId || 'unknown'

      logger.info('Verify subscription request', {
        requestId,
        userId,
        userEmail
      })

      // Query subscription via internal handler
      const queryResult = await handlerRegistry.execute(
        'query-subscription',
        { userEmail },
        userId,
        userEmail
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

