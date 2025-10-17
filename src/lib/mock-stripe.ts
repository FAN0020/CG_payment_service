/**
 * Mock Stripe Manager for Testing
 * 
 * Simulates Stripe responses without making actual API calls.
 * Controlled via MOCK_STRIPE_SCENARIO environment variable.
 */

import { nanoid } from 'nanoid'
import type Stripe from 'stripe'
import { CreateCheckoutSessionParams, StripeSubscriptionInfo, IStripeManager } from './stripe.js'
import { logger } from './logger.js'
import { StripeError as CustomStripeError } from '../types/index.js'

export type MockScenario = 
  | 'success'           // Successful payment flow
  | 'cancel'            // User cancels payment
  | 'expired'           // Session expires
  | 'invalid_card'      // Card payment fails
  | 'webhook_fail'      // Webhook processing fails

export class MockStripeManager implements IStripeManager {
  private scenario: MockScenario
  private baseUrl: string
  public stripe: any  // Mock stripe instance

  constructor(scenario?: string) {
    this.scenario = (scenario as MockScenario) || 'success'
    this.baseUrl = process.env.MOCK_STRIPE_BASE_URL || 'http://localhost:8790'
    this.stripe = null  // No real Stripe instance in mock mode
    
    logger.info('🧪 Mock Stripe Manager Initialized', {
      scenario: this.scenario,
      baseUrl: this.baseUrl
    })
  }

  /**
   * Create a mock checkout session
   */
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
    const sessionId = `cs_mock_${nanoid(24)}`
    
    logger.info('🎭 Creating mock checkout session', {
      scenario: this.scenario,
      orderId: params.orderId,
      sessionId
    })

    // Simulate different scenarios
    switch (this.scenario) {
      case 'success':
        return this.createSuccessSession(sessionId, params)
      
      case 'cancel':
        return this.createCancelSession(sessionId, params)
      
      case 'expired':
        throw new Error('Checkout session has expired')
      
      case 'invalid_card':
        return this.createInvalidCardSession(sessionId, params)
      
      case 'webhook_fail':
        return this.createWebhookFailSession(sessionId, params)
      
      default:
        return this.createSuccessSession(sessionId, params)
    }
  }

  /**
   * Success scenario - returns a checkout URL that will redirect to success page
   */
  private createSuccessSession(sessionId: string, params: CreateCheckoutSessionParams): Stripe.Checkout.Session {
    // Create a mock checkout URL that will simulate Stripe's flow
    // Pass success_url and cancel_url so the mock page can redirect properly
    const checkoutUrl = `${this.baseUrl}/mock-stripe/checkout?session_id=${sessionId}&scenario=success&order_id=${params.orderId}&success_url=${encodeURIComponent(params.successUrl)}&cancel_url=${encodeURIComponent(params.cancelUrl)}`
    
    return {
      id: sessionId,
      object: 'checkout.session',
      url: checkoutUrl,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail || null,
      metadata: {
        order_id: params.orderId
      },
      mode: 'subscription',
      status: 'open',
      created: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600
    } as Stripe.Checkout.Session
  }

  /**
   * Cancel scenario - returns a checkout URL that will redirect to cancel page
   */
  private createCancelSession(sessionId: string, params: CreateCheckoutSessionParams): Stripe.Checkout.Session {
    const checkoutUrl = `${this.baseUrl}/mock-stripe/checkout?session_id=${sessionId}&scenario=cancel&order_id=${params.orderId}&success_url=${encodeURIComponent(params.successUrl)}&cancel_url=${encodeURIComponent(params.cancelUrl)}`
    
    return {
      id: sessionId,
      object: 'checkout.session',
      url: checkoutUrl,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail || null,
      metadata: {
        order_id: params.orderId
      },
      mode: 'subscription',
      status: 'open',
      created: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600
    } as Stripe.Checkout.Session
  }

  /**
   * Invalid card scenario
   */
  private createInvalidCardSession(sessionId: string, params: CreateCheckoutSessionParams): Stripe.Checkout.Session {
    const checkoutUrl = `${this.baseUrl}/mock-stripe/checkout?session_id=${sessionId}&scenario=invalid_card&order_id=${params.orderId}&success_url=${encodeURIComponent(params.successUrl)}&cancel_url=${encodeURIComponent(params.cancelUrl)}`
    
    return {
      id: sessionId,
      object: 'checkout.session',
      url: checkoutUrl,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail || null,
      metadata: {
        order_id: params.orderId
      },
      mode: 'subscription',
      status: 'open',
      created: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600
    } as Stripe.Checkout.Session
  }

  /**
   * Webhook fail scenario
   */
  private createWebhookFailSession(sessionId: string, params: CreateCheckoutSessionParams): Stripe.Checkout.Session {
    const checkoutUrl = `${this.baseUrl}/mock-stripe/checkout?session_id=${sessionId}&scenario=webhook_fail&order_id=${params.orderId}&success_url=${encodeURIComponent(params.successUrl)}&cancel_url=${encodeURIComponent(params.cancelUrl)}`
    
    return {
      id: sessionId,
      object: 'checkout.session',
      url: checkoutUrl,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail || null,
      metadata: {
        order_id: params.orderId
      },
      mode: 'subscription',
      status: 'open',
      created: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600
    } as Stripe.Checkout.Session
  }

  /**
   * Mock subscription retrieval
   */
  async getSubscription(subscriptionId: string): Promise<StripeSubscriptionInfo> {
    logger.info('🧪 Mock: Getting subscription', { subscriptionId })
    
    return {
      subscriptionId,
      customerId: `cus_mock_${nanoid(14)}`,
      status: 'active',
      currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000
    }
  }

  /**
   * Mock subscription cancellation
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    logger.info('🧪 Mock: Canceling subscription', { subscriptionId })
    // In mock mode, just log - no actual Stripe call
  }

  /**
   * Mock webhook signature verification
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    logger.info('🧪 Mock: Verifying webhook signature')
    
    // In mock mode, create a mock event
    const mockEvent: Stripe.Event = {
      id: `evt_mock_${nanoid(24)}`,
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {}
      },
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'checkout.session.completed'
    }
    
    return mockEvent
  }

  /**
   * Get the mock Stripe instance (returns null)
   */
  getInstance(): any {
    return this.stripe
  }
}

