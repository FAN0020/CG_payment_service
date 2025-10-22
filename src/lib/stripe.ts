import Stripe from 'stripe'
import { StripeError as CustomStripeError } from '../types/index.js'
import { logger } from './logger.js'

export interface CreateCheckoutSessionParams {
  customerEmail?: string  // Optional email for Stripe checkout
  orderId: string
  priceId: string
  successUrl: string
  cancelUrl: string
  productType?: 'one-time' | 'subscription'  // Product type to determine checkout mode
  idempotencyKey?: string  // Idempotency key for Stripe API calls
}

export interface StripeSubscriptionInfo {
  subscriptionId: string
  customerId: string
  status: string
  currentPeriodEnd: number
}

export class StripeManager {
  private stripe: Stripe

  constructor(secretKey: string) {
    if (!secretKey) {
      throw new Error('Stripe secret key is required')
    }
    
    // Validate Stripe key format
    if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
      throw new Error('Invalid Stripe secret key format. Must start with sk_test_ or sk_live_')
    }
    
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16'
    })
  }

  /**
   * Create a Stripe Checkout Session for subscription or one-time payment
   */
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
    logger.debug('Starting createCheckoutSession', { 
      orderId: params.orderId, 
      productType: params.productType,
      idempotencyKey: params.idempotencyKey 
    })
    try {
      logger.debug('Creating session config')
      
      // Determine checkout mode based on product type
      const mode = params.productType === 'one-time' ? 'payment' : 'subscription'
      
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        mode,
        line_items: [
          {
            price: params.priceId,
            quantity: 1
          }
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          order_id: params.orderId
        }
      }

      // Add subscription-specific data only for subscription mode
      if (mode === 'subscription') {
        sessionConfig.subscription_data = {
          metadata: {
            order_id: params.orderId
          }
        }
      }

      // Add customer_email only if provided
      if (params.customerEmail) {
        sessionConfig.customer_email = params.customerEmail
      }

      // Prepare Stripe API options with idempotency key
      const stripeOptions: Stripe.RequestOptions = {}
      if (params.idempotencyKey) {
        stripeOptions.idempotencyKey = params.idempotencyKey
        logger.info('Using idempotency key for Stripe API call', {
          idempotencyKey: params.idempotencyKey,
          orderId: params.orderId
        })
      }

      logger.debug('Calling Stripe API checkout.sessions.create()', {
        hasIdempotencyKey: !!params.idempotencyKey
      })
      const session = await this.stripe.checkout.sessions.create(sessionConfig, stripeOptions)
      logger.debug('Stripe API call successful', { sessionId: session.id })

      logger.info('Stripe checkout session created', {
        sessionId: session.id,
        orderId: params.orderId,
        idempotencyKey: params.idempotencyKey,
        hasEmail: !!params.customerEmail
      })

      return session
    } catch (error: any) {
      // Handle Stripe idempotency errors gracefully
      if (error.code === 'idempotency_key_in_use' || error.message.includes('Keys already used')) {
        logger.info('Stripe idempotency key already used - this is expected for concurrent requests', {
          idempotencyKey: params.idempotencyKey,
          orderId: params.orderId,
          error: error.message
        })
        // Re-throw as a more specific error that can be handled upstream
        throw new CustomStripeError(`Idempotency key already used: ${error.message}`)
      }
      
      logger.error('Stripe API call failed', { error: error.message, errorType: error.constructor.name })
      logger.error('Failed to create Stripe checkout session', {
        error: error.message,
        orderId: params.orderId,
        idempotencyKey: params.idempotencyKey
      })
      logger.debug('Throwing CustomStripeError')
      throw new CustomStripeError(`Failed to create checkout session: ${error.message}`)
    }
  }

  /**
   * Retrieve subscription details
   */
  async getSubscription(subscriptionId: string): Promise<StripeSubscriptionInfo> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId)

      return {
        subscriptionId: subscription.id,
        customerId: subscription.customer as string,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end * 1000 // Convert to ms
      }
    } catch (error: any) {
      logger.error('Failed to retrieve Stripe subscription', {
        error: error.message,
        subscriptionId
      })
      throw new CustomStripeError(`Failed to retrieve subscription: ${error.message}`)
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.stripe.subscriptions.cancel(subscriptionId)

      logger.info('Stripe subscription canceled', { subscriptionId })
    } catch (error: any) {
      logger.error('Failed to cancel Stripe subscription', {
        error: error.message,
        subscriptionId
      })
      throw new CustomStripeError(`Failed to cancel subscription: ${error.message}`)
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, secret)
      return event
    } catch (error: any) {
      logger.error('Webhook signature verification failed', {
        error: error.message
      })
      throw new CustomStripeError(`Webhook signature verification failed: ${error.message}`)
    }
  }

  /**
   * Get the Stripe instance (for advanced usage)
   */
  getInstance(): Stripe {
    return this.stripe
  }
}

