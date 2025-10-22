import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import Stripe from 'stripe'
import { StripeManager } from '../lib/stripe.js'
import { PaymentDatabase } from '../lib/database.js'
import { handlerRegistry } from '../lib/handler-registry.js'
import { logger } from '../lib/logger.js'

/**
 * Stripe webhook handler
 * Processes Stripe events with signature verification and idempotency
 */
export async function registerWebhookRoutes(
  fastify: FastifyInstance,
  stripeManager: StripeManager,
  db: PaymentDatabase,
  webhookSecret: string
): Promise<void> {
  
  fastify.post('/webhooks/stripe', async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['stripe-signature'] as string

    if (!signature) {
      logger.error('Missing Stripe signature header')
      return reply.code(400).send({ error: 'Missing signature' })
    }

    try {
      // Verify webhook signature
      const rawBody = (request as any).rawBody
      logger.info('Webhook raw body type', { 
        rawBodyType: typeof rawBody,
        isBuffer: Buffer.isBuffer(rawBody),
        bodyLength: rawBody ? rawBody.length : 0
      })
      const event = stripeManager.verifyWebhookSignature(rawBody, signature, webhookSecret)

      const requestId = event.id
      logger.info('Webhook received', {
        requestId,
        eventType: event.type,
        eventId: event.id
      })

      // Check idempotency - have we processed this event before?
      if (db.isEventProcessed(event.id)) {
        logger.info('Event already processed (idempotent)', {
          requestId,
          eventId: event.id
        })
        return reply.code(200).send({ received: true, processed: 'already' })
      }

      // Handle different event types
      const orderId = await handleStripeEvent(event, db, stripeManager, requestId)

      // Record event as processed
      db.recordEvent({
        event_id: event.id,
        event_type: event.type,
        order_id: orderId || undefined
      })

      logger.info('Webhook processed successfully', {
        requestId,
        eventType: event.type
      })

      return reply.code(200).send({ received: true })

    } catch (error: any) {
      logger.error('Webhook processing failed', {
        error: error.message
      })
      return reply.code(400).send({ error: error.message })
    }
  })
}

/**
 * Handle different Stripe event types
 */
async function handleStripeEvent(event: Stripe.Event, db: PaymentDatabase, stripeManager: StripeManager, requestId: string): Promise<string | null> {
  switch (event.type) {
    case 'checkout.session.completed':
      return await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, db, stripeManager, requestId)

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, db, requestId)

    case 'customer.subscription.deleted':
      return await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, db, requestId)

    case 'invoice.payment_succeeded':
      return await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, db, requestId)

    case 'invoice.payment_failed':
      return await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, db, requestId)

    default:
      logger.info('Unhandled event type', {
        requestId,
        eventType: event.type
      })
      return null
  }
}

/**
 * Handle checkout.session.completed
 * User completed checkout - handles both subscription and one-time payments
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  db: PaymentDatabase,
  stripeManager: StripeManager,
  requestId: string
): Promise<string | null> {
  const orderId = session.metadata?.order_id
  const subscriptionId = session.subscription as string | null
  const customerId = session.customer as string | null

  if (!orderId) {
    logger.warn('Checkout session missing order_id in metadata', { requestId, sessionId: session.id })
    return null
  }

  // Build update data - only include non-null values
  const updateData: any = {
    orderId,
    stripeSessionId: session.id,
    status: 'active'
  }

  // Only add subscription/customer IDs if they exist (for subscription payments)
  if (subscriptionId) {
    updateData.stripeSubscriptionId = subscriptionId
    
    // For subscription payments, try to fetch subscription details to get expiration
    try {
      const stripe = stripeManager.getInstance()
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      
      
      // Extract expiration timestamp with fallback logic
      let expiresAt: number | undefined = undefined
      
      if (subscription.current_period_end && typeof subscription.current_period_end === 'number') {
        expiresAt = subscription.current_period_end * 1000
      } else if (subscription.billing_cycle_anchor && typeof subscription.billing_cycle_anchor === 'number') {
        expiresAt = subscription.billing_cycle_anchor * 1000
      } else if (subscription.trial_end && typeof subscription.trial_end === 'number') {
        expiresAt = subscription.trial_end * 1000
      }
      
      if (expiresAt) {
        updateData.expiresAt = expiresAt
      }
    } catch (error: any) {
      logger.warn('Failed to fetch subscription details for checkout session', {
        requestId,
        orderId,
        subscriptionId,
        error: error.message
      })
    }
  }
  if (customerId) {
    updateData.stripeCustomerId = customerId
  }

  // Update order via plugin
  await handlerRegistry.execute(
    'update-subscription',
    updateData,
    'system/stripe-webhook'
  )

  // Get order details to extract user and product info for cleanup
  const order = db.getOrderById(orderId)
  if (order) {
    // Extract product ID from plan (format: productId_amount_currency)
    const productId = order.plan.split('_')[0]
    
    // Clean up active payment and concurrency locks for this user/product
    try {
      // Remove active payment record (payment completed successfully)
      const removed = db.removeActivePayment(order.user_id, productId)
      if (removed) {
        logger.debug('Removed active payment after successful completion', {
          requestId,
          orderId,
          userId: order.user_id,
          productId
        })
      }
      
      // Clean up any remaining concurrency locks
      db.cleanExpiredLocks()
      logger.debug('Cleaned expired locks after successful payment', {
        requestId,
        orderId,
        userId: order.user_id,
        productId
      })
    } catch (error: any) {
      logger.warn('Failed to clean locks/active payments after payment', {
        requestId,
        orderId,
        error: error.message
      })
    }
  }

  logger.info('Checkout session completed, order activated', {
    requestId,
    orderId,
    subscriptionId
  })

  return orderId
}

/**
 * Handle customer.subscription.updated
 * Subscription status changed
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  db: PaymentDatabase,
  requestId: string
): Promise<string | null> {
  const orderId = subscription.metadata?.order_id
  const subscriptionId = subscription.id
  const status = mapStripeStatus(subscription.status)
  
  
  // Extract expiration timestamp with fallback logic
  let expiresAt: number | undefined = undefined
  
  if (subscription.current_period_end && typeof subscription.current_period_end === 'number') {
    expiresAt = subscription.current_period_end * 1000
  } else if (subscription.billing_cycle_anchor && typeof subscription.billing_cycle_anchor === 'number') {
    // Fallback to billing cycle anchor if current_period_end is not available
    expiresAt = subscription.billing_cycle_anchor * 1000
  } else if (subscription.trial_end && typeof subscription.trial_end === 'number') {
    // For trial subscriptions, use trial end date
    expiresAt = subscription.trial_end * 1000
  }

  // Try to find order by subscription ID if no order_id in metadata
  let order = null
  if (orderId) {
    order = db.getOrderById(orderId)
  }
  if (!order) {
    order = db.getOrderByStripeSubscriptionId(subscriptionId)
  }

  if (!order) {
    logger.warn('Subscription update: order not found', {
      requestId,
      subscriptionId,
      orderId
    })
    return null
  }

  // Update subscription via plugin
  await handlerRegistry.execute(
    'update-subscription',
    {
      orderId: order.order_id,
      stripeSubscriptionId: subscriptionId,
      status,
      expiresAt
    },
    'system/stripe-webhook'
  )

  logger.info('Subscription updated', {
    requestId,
    orderId: order.order_id,
    subscriptionId,
    status
  })

  return order.order_id
}

/**
 * Handle customer.subscription.deleted
 * Subscription canceled or expired
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  db: PaymentDatabase,
  requestId: string
): Promise<string | null> {
  const subscriptionId = subscription.id
  const order = db.getOrderByStripeSubscriptionId(subscriptionId)

  if (!order) {
    logger.warn('Subscription deleted: order not found', {
      requestId,
      subscriptionId
    })
    return null
  }

  await handlerRegistry.execute(
    'update-subscription',
    {
      orderId: order.order_id,
      status: 'canceled'
    },
    'system/stripe-webhook'
  )

  logger.info('Subscription deleted', {
    requestId,
    orderId: order.order_id,
    subscriptionId
  })

  return order.order_id
}

/**
 * Handle invoice.payment_succeeded
 * Recurring payment succeeded, extend subscription
 */
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  db: PaymentDatabase,
  requestId: string
): Promise<string | null> {
  const subscriptionId = invoice.subscription as string

  if (!subscriptionId) {
    return null
  }

  const order = db.getOrderByStripeSubscriptionId(subscriptionId)

  if (!order) {
    logger.warn('Invoice payment succeeded: order not found', {
      requestId,
      subscriptionId
    })
    return null
  }

  // Extract expiration timestamp with fallback logic
  let expiresAt: number | undefined = undefined
  
  if (invoice.period_end && typeof invoice.period_end === 'number') {
    expiresAt = invoice.period_end * 1000
  } else if (invoice.period_start && typeof invoice.period_start === 'number') {
    // Fallback to period start + 30 days if period_end is not available
    expiresAt = (invoice.period_start + (30 * 24 * 60 * 60)) * 1000
  }

  await handlerRegistry.execute(
    'update-subscription',
    {
      orderId: order.order_id,
      status: 'active',
      expiresAt
    },
    'system/stripe-webhook'
  )

  logger.info('Invoice payment succeeded, subscription extended', {
    requestId,
    orderId: order.order_id,
    subscriptionId,
    expiresAt
  })

  return order.order_id
}

/**
 * Handle invoice.payment_failed
 * Payment failed, mark subscription as incomplete
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  db: PaymentDatabase,
  requestId: string
): Promise<string | null> {
  const subscriptionId = invoice.subscription as string

  if (!subscriptionId) {
    return null
  }

  const order = db.getOrderByStripeSubscriptionId(subscriptionId)

  if (!order) {
    logger.warn('Invoice payment failed: order not found', {
      requestId,
      subscriptionId
    })
    return null
  }

  await handlerRegistry.execute(
    'update-subscription',
    {
      orderId: order.order_id,
      status: 'incomplete'
    },
    'system/stripe-webhook'
  )

  logger.info('Invoice payment failed', {
    requestId,
    orderId: order.order_id,
    subscriptionId
  })

  return order.order_id
}

/**
 * Map Stripe subscription status to our internal status
 */
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): 'pending' | 'active' | 'canceled' | 'expired' | 'incomplete' {
  switch (stripeStatus) {
    case 'active':
      return 'active'
    case 'canceled':
    case 'unpaid':
      return 'canceled'
    case 'past_due':
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete'
    case 'trialing':
      return 'active'
    default:
      return 'pending'
  }
}

