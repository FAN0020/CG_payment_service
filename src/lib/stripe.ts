import Stripe from 'stripe'
import { StripeError as CustomStripeError } from '../types/index.js'
import { logger } from './logger.js'

export interface CreateCheckoutSessionParams {
  customerEmail?: string  // Optional email for Stripe checkout
  orderId: string
  priceId: string
  successUrl: string
  cancelUrl: string
}

export interface StripeSubscriptionInfo {
  subscriptionId: string
  customerId: string
  status: string
  currentPeriodEnd: number
}

export class StripeManager {
  public stripe: Stripe

  constructor(secretKey: string) {
    if (!secretKey) {
      throw new Error('Stripe secret key is required')
    }
    
    if (!secretKey.startsWith('sk_')) {
      throw new Error('Invalid Stripe secret key format. Key must start with "sk_"')
    }
    
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16'
    })
  }

  /**
   * Create a Stripe Checkout Session for subscription
   */
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
    console.log('[STRIPE DEBUG] Starting createCheckoutSession, orderId:', params.orderId)
    try {
      console.log('[STRIPE DEBUG] Creating session config...')
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
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
        },
        subscription_data: {
          metadata: {
            order_id: params.orderId
          }
        }
      }

      // Add customer_email only if provided
      if (params.customerEmail) {
        sessionConfig.customer_email = params.customerEmail
      }

      console.log('[STRIPE DEBUG] Calling Stripe API checkout.sessions.create()...')
      const session = await this.stripe.checkout.sessions.create(sessionConfig)
      console.log('[STRIPE DEBUG] Stripe API call successful, sessionId:', session.id)

      logger.info('Stripe checkout session created', {
        sessionId: session.id,
        orderId: params.orderId,
        hasEmail: !!params.customerEmail
      })

      return session
    } catch (error: any) {
      console.log('[STRIPE DEBUG] ERROR in Stripe API call:', error.message)
      console.log('[STRIPE DEBUG] Error type:', error.constructor.name)
      logger.error('Failed to create Stripe checkout session', {
        error: error.message,
        orderId: params.orderId
      })
      console.log('[STRIPE DEBUG] Throwing CustomStripeError...')
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

