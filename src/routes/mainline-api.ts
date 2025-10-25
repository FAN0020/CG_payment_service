import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { JWTManager } from '../lib/jwt.js'
import { StripeManager } from '../lib/stripe.js'
import { PaymentDatabase } from '../lib/database.js'
import { createJwtMiddleware, createAccessControlMiddleware, createAdminOnlyMiddleware, AuthenticatedRequest } from '../lib/auth-middleware.js'
import { 
  successResponse, 
  errorResponse, 
  validationErrorResponse, 
  notFoundResponse,
  generateRequestId 
} from '../lib/api-response.js'
import { logger } from '../lib/logger.js'
import { nanoid } from 'nanoid'
import { getProductConfig } from '../config/products.js'
import { generateIdempotencyKey } from '../utils/hash.js'
import { ActivationManager } from '../lib/activation.js'

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
 * Mainline-facing API routes for payment service
 * These endpoints follow the standardized API contract
 */
export async function registerMainlineApiRoutes(
  fastify: FastifyInstance,
  jwtManager: JWTManager,
  stripeManager: StripeManager,
  db: PaymentDatabase,
  config: PaymentConfig
): Promise<void> {

  // JWT authentication middleware
  const jwtAuth = createJwtMiddleware(jwtManager)
  const accessControl = createAccessControlMiddleware()
  const adminOnly = createAdminOnlyMiddleware()

  /**
   * POST /api/payments/create-session
   * Create Stripe checkout session (mainline sends only uid)
   */
  fastify.post('/api/payments/create-session', {
    preHandler: [jwtAuth, accessControl]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = generateRequestId()
    const authRequest = request as AuthenticatedRequest
    const user = authRequest.user

    try {
      // Validate request body
      const body = request.body as { 
        uid?: string; 
        ad_source?: string; 
        campaign_id?: string;
        activation_code?: string; // TODO: Remove after testing period
      }
      
      if (!body.uid) {
        return reply.code(400).send(validationErrorResponse('uid is required', requestId))
      }

      // Verify the uid matches the JWT sub (unless admin)
      const isAdmin = user.roles?.includes('admin') || user.role === 'admin'
      if (!isAdmin && body.uid !== user.sub) {
        return reply.code(403).send(errorResponse(403, 'Forbidden: You can only create sessions for yourself', requestId))
      }

      const userId = body.uid
      const adSource = body.ad_source
      const campaignId = body.campaign_id
      const activationCode = body.activation_code // TODO: Remove after testing period

      logger.info('Create session request', {
        requestId,
        userId,
        adSource,
        campaignId,
        hasActivationCode: !!activationCode // TODO: Remove after testing period
      })

      // TODO: Remove after testing period
      // TEMPORARY FEATURE: Check for activation code (only in non-production)
      if (ActivationManager.isEnabled() && activationCode) {
        const sanitizedCode = ActivationManager.sanitizeCode(activationCode)
        
        // Validate code format
        if (!ActivationManager.validateFormat(sanitizedCode)) {
          logger.warn('Invalid activation code format', {
            requestId,
            userId,
            code: sanitizedCode
          })
          // Continue with normal Stripe flow
        } else if (db.isActivationCodeValid(sanitizedCode)) {
          // Code is valid and available - bypass Stripe payment
          logger.info('[TEST-ACTIVATED] Order created using activation code', {
            userId,
            requestId,
            code: sanitizedCode
          })
          
          // Generate order ID
          const orderId = `order_${nanoid(12)}`
          
          // Create order with test_activated flag
          const order = db.createOrder({
            order_id: orderId,
            user_id: userId,
            status: 'active', // Use existing 'active' status
            plan: ActivationManager.getDefaultTestPlan(), // Hardcoded test plan
            amount: ActivationManager.getDefaultTestAmount(), // Free for test activation
            currency: 'SGD',
            request_id: requestId,
            ad_source: adSource,
            campaign_id: campaignId,
            test_activated: true, // TODO: Remove after testing period
            activation_code: sanitizedCode, // TODO: Remove after testing period
            request_expires_at: Date.now() + (15 * 60 * 1000) // 15 minutes
          })
          
          // Redeem the activation code
          const redeemed = db.redeemActivationCode(sanitizedCode, userId)
          if (!redeemed) {
            logger.error('Failed to redeem activation code', {
              requestId,
              userId,
              code: sanitizedCode
            })
            throw new Error('Failed to redeem activation code')
          }
          
          return reply.code(200).send(successResponse('Session created (test-activated)', {
            checkoutUrl: null, // No Stripe checkout needed
            requestId,
            orderId,
            sessionId: null,
            testActivated: true, // TODO: Remove after testing period
            activationCode: sanitizedCode // TODO: Remove after testing period
          }, requestId))
        } else {
          logger.warn('Activation code invalid or already used', {
            requestId,
            userId,
            code: sanitizedCode
          })
          // Continue with normal Stripe flow
        }
      }

      // Get default product configuration
      const productConfig = getProductConfig('weekly-plan')

      // Fetch amount from Stripe using price ID
      const stripe = stripeManager.getInstance()
      const price = await stripe.prices.retrieve(productConfig.priceId)
      const amount = price.unit_amount ? price.unit_amount / 100 : 0 // Convert from cents to dollars

      // Generate order ID
      const orderId = `order_${nanoid(12)}`

      // Create order with request ID (15 min TTL)
      const now = Date.now()
      const requestExpiresAt = now + (15 * 60 * 1000) // 15 minutes

      const order = db.createOrder({
        order_id: orderId,
        user_id: userId,
        status: 'pending',
        plan: `${productConfig.type}_${amount}_${productConfig.currency}`,
        amount: amount,
        currency: productConfig.currency,
        request_id: requestId,
        ad_source: adSource,
        campaign_id: campaignId,
        request_expires_at: requestExpiresAt
      })

      // Generate JWT-based idempotency key with 1-minute buckets
      const timeoutMs = parseInt(process.env.PAYMENT_TIMEOUT_MS || '60000') // Default 60 seconds
      const bucketMinutes = Math.ceil(timeoutMs / 60000) // Convert to minutes, round up
      const idempotencyKey = generateIdempotencyKey(userId, productConfig.type, bucketMinutes)
      
      logger.info('Creating Stripe checkout session', {
        requestId,
        userId,
        orderId,
        idempotencyKey,
        productType: productConfig.type
      })

      // Create Stripe checkout session
      const session = await stripeManager.createCheckoutSession({
        customerEmail: user.email, // Use email from JWT if available
        orderId,
        priceId: productConfig.priceId,
        successUrl: config.successUrl,
        cancelUrl: config.cancelUrl,
        productType: productConfig.type as 'one-time' | 'subscription',
        idempotencyKey
      })

      // Update order with Stripe session ID
      db.updateOrder(orderId, {
        stripe_session_id: session.id
      })

      logger.info('Session created successfully', {
        requestId,
        userId,
        orderId,
        sessionId: session.id
      })

      return reply.code(200).send(successResponse('Session created', {
        checkoutUrl: session.url,
        requestId,
        orderId,
        sessionId: session.id
      }, requestId))

    } catch (error: any) {
      logger.error('Create session failed', {
        requestId,
        error: error.message
      })

      return reply.code(500).send(errorResponse(500, `Failed to create session: ${error.message}`, requestId))
    }
  })

  /**
   * GET /api/payments/status/{requestId}
   * Get payment status by request ID
   */
  fastify.get('/api/payments/status/:requestId', {
    preHandler: [jwtAuth, accessControl]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = generateRequestId()
    const authRequest = request as AuthenticatedRequest
    const user = authRequest.user
    const { requestId: targetRequestId } = request.params as { requestId: string }

    try {
      logger.info('Payment status request', {
        requestId,
        targetRequestId
      })

      // Get order by request ID
      const order = db.getOrderByRequestId(targetRequestId)
      
      if (!order) {
        logger.warn('Order not found for request ID', {
          requestId,
          targetRequestId
        })
        return reply.code(404).send(notFoundResponse('Order not found', requestId))
      }

      // Check access control: user can only access their own orders unless admin
      const isAdmin = user.roles?.includes('admin') || user.role === 'admin'
      if (!isAdmin && order.user_id !== user.sub) {
        return reply.code(403).send(errorResponse(403, 'Forbidden: You can only access your own orders', requestId))
      }

      // Check if request ID has expired
      if (order.request_expires_at && order.request_expires_at < Date.now()) {
        logger.warn('Request ID expired', {
          requestId,
          targetRequestId,
          expiresAt: order.request_expires_at
        })
        return reply.code(410).send(errorResponse(410, 'Request ID has expired', requestId))
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
        targetRequestId,
        orderId: order.order_id,
        status: paymentStatus
      })

      return reply.code(200).send(successResponse('Payment status retrieved', {
        requestId: targetRequestId,
        orderId: order.order_id,
        status: paymentStatus,
        amount: order.amount,
        currency: order.currency,
        plan: order.plan,
        error: error,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        // TODO: Remove after testing period
        testActivated: order.test_activated || false,
        activationCode: order.activation_code || undefined
      }, requestId))

    } catch (error: any) {
      logger.error('Payment status request failed', {
        requestId,
        targetRequestId,
        error: error.message
      })
      
      return reply.code(500).send(errorResponse(500, 'Internal server error', requestId))
    }
  })

  /**
   * GET /api/payments/admin/query/{uid}
   * Admin query orders by UID (admin only)
   */
  fastify.get('/api/payments/admin/query/:uid', {
    preHandler: [jwtAuth, adminOnly]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = generateRequestId()
    const { uid } = request.params as { uid: string }

    try {
      logger.info('Admin query request', {
        requestId,
        uid
      })

      // Get all orders for the user
      const orders = db.getOrdersByUserId(uid)

      logger.info('Admin query completed', {
        requestId,
        uid,
        orderCount: orders.length
      })

      return reply.code(200).send(successResponse('Orders retrieved', {
        uid,
        orders: orders.map(order => ({
          orderId: order.order_id,
          status: order.status,
          plan: order.plan,
          amount: order.amount,
          currency: order.currency,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          requestId: order.request_id,
          adSource: order.ad_source,
          campaignId: order.campaign_id
        }))
      }, requestId))

    } catch (error: any) {
      logger.error('Admin query failed', {
        requestId,
        uid,
        error: error.message
      })
      
      return reply.code(500).send(errorResponse(500, 'Internal server error', requestId))
    }
  })

  /**
   * GET /api/payments/health
   * Health check endpoint
   */
  fastify.get('/api/payments/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = generateRequestId()
    
    return reply.code(200).send(successResponse('Service healthy', {
      status: 'healthy',
      service: 'payment',
      timestamp: Date.now()
    }, requestId))
  })
}
