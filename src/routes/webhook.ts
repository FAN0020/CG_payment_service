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
  
  fastify.post('/webhooks/stripe', {
    config: {
      // Disable body parsing to get raw body for signature verification
      rawBody: true
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['stripe-signature'] as string

    if (!signature) {
      logger.error('Missing Stripe signature header')
      return reply.code(400).send({ error: 'Missing signature' })
    }

    try {
      // Verify webhook signature
      const rawBody = (request as any).rawBody || request.body
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
      await handleStripeEvent(event, db, requestId)

      // Record event as processed
      db.recordEvent({
        event_id: event.id,
        event_type: event.type
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
async function handleStripeEvent(event: Stripe.Event, db: PaymentDatabase, requestId: string): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, db, requestId)
      break

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, db, requestId)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, db, requestId)
      break

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, db, requestId)
      break

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, db, requestId)
      break

    default:
      logger.info('Unhandled event type', {
        requestId,
        eventType: event.type
      })
  }
}

/**
 * Handle checkout.session.completed
 * User completed checkout, subscription is created
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  db: PaymentDatabase,
  requestId: string
): Promise<void> {
  const orderId = session.metadata?.order_id
  const subscriptionId = session.subscription as string
  const customerId = session.customer as string

  if (!orderId) {
    logger.warn('Checkout session missing order_id in metadata', { requestId, sessionId: session.id })
    return
  }

  // Update order via plugin
  await handlerRegistry.execute(
    'update-subscription',
    {
      orderId,
      stripeSessionId: session.id,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      status: 'active'
    },
    'system/stripe-webhook'
  )

  logger.info('Checkout session completed, order activated', {
    requestId,
    orderId,
    subscriptionId
  })
}

/**
 * Handle customer.subscription.updated
 * Subscription status changed
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  db: PaymentDatabase,
  requestId: string
): Promise<void> {
  const orderId = subscription.metadata?.order_id
  const subscriptionId = subscription.id
  const status = mapStripeStatus(subscription.status)
  const expiresAt = subscription.current_period_end * 1000

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
    return
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
}

/**
 * Handle customer.subscription.deleted
 * Subscription canceled or expired
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  db: PaymentDatabase,
  requestId: string
): Promise<void> {
  const subscriptionId = subscription.id
  const order = db.getOrderByStripeSubscriptionId(subscriptionId)

  if (!order) {
    logger.warn('Subscription deleted: order not found', {
      requestId,
      subscriptionId
    })
    return
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
}

/**
 * Handle invoice.payment_succeeded
 * Recurring payment succeeded, extend subscription
 */
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  db: PaymentDatabase,
  requestId: string
): Promise<void> {
  const subscriptionId = invoice.subscription as string

  if (!subscriptionId) {
    return
  }

  const order = db.getOrderByStripeSubscriptionId(subscriptionId)

  if (!order) {
    logger.warn('Invoice payment succeeded: order not found', {
      requestId,
      subscriptionId
    })
    return
  }

  // Extend subscription period
  const expiresAt = invoice.period_end * 1000

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
}

/**
 * Handle invoice.payment_failed
 * Payment failed, mark subscription as incomplete
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  db: PaymentDatabase,
  requestId: string
): Promise<void> {
  const subscriptionId = invoice.subscription as string

  if (!subscriptionId) {
    return
  }

  const order = db.getOrderByStripeSubscriptionId(subscriptionId)

  if (!order) {
    logger.warn('Invoice payment failed: order not found', {
      requestId,
      subscriptionId
    })
    return
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

