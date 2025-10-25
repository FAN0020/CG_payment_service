import fetch from 'node-fetch'
import { logger } from './logger.js'

/**
 * Mainline notification service
 * Sends status updates to mainline after payment completion
 */
export class MainlineNotifier {
  private readonly mainlineBaseUrl: string
  private readonly apiKey: string
  private readonly timeout: number

  constructor(mainlineBaseUrl: string, apiKey: string, timeout: number = 10000) {
    this.mainlineBaseUrl = mainlineBaseUrl
    this.apiKey = apiKey
    this.timeout = timeout
  }

  /**
   * Send payment completion notification to mainline
   */
  async notifyPaymentCompletion(data: {
    orderId: string
    userId: string
    status: 'completed' | 'failed' | 'cancelled'
    timestamp: number
    amount?: number
    currency?: string
    plan?: string
    subscriptionId?: string
  }): Promise<boolean> {
    try {
      const payload = {
        event: 'payment_completed',
        order_id: data.orderId,
        user_id: data.userId,
        status: data.status,
        timestamp: data.timestamp,
        amount: data.amount,
        currency: data.currency,
        plan: data.plan,
        subscription_id: data.subscriptionId,
        service: 'payment_service'
      }

      logger.info('Sending payment completion notification to mainline', {
        orderId: data.orderId,
        userId: data.userId,
        status: data.status,
        timestamp: data.timestamp
      })

      const response = await fetch(`${this.mainlineBaseUrl}/api/webhooks/payment-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Service': 'payment-service',
          'X-Event': 'payment_completed'
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        logger.info('Payment completion notification sent successfully', {
          orderId: data.orderId,
          status: response.status,
          statusText: response.statusText
        })
        return true
      } else {
        logger.warn('Payment completion notification failed', {
          orderId: data.orderId,
          status: response.status,
          statusText: response.statusText,
          response: await response.text().catch(() => 'Unable to read response')
        })
        return false
      }
    } catch (error: any) {
      logger.error('Failed to send payment completion notification', {
        orderId: data.orderId,
        error: error.message,
        stack: error.stack
      })
      return false
    }
  }

  /**
   * Send subscription status update to mainline
   */
  async notifySubscriptionUpdate(data: {
    orderId: string
    userId: string
    status: 'active' | 'cancelled' | 'expired' | 'incomplete'
    timestamp: number
    subscriptionId?: string
    expiresAt?: number
  }): Promise<boolean> {
    try {
      const payload = {
        event: 'subscription_updated',
        order_id: data.orderId,
        user_id: data.userId,
        status: data.status,
        timestamp: data.timestamp,
        subscription_id: data.subscriptionId,
        expires_at: data.expiresAt,
        service: 'payment_service'
      }

      logger.info('Sending subscription update notification to mainline', {
        orderId: data.orderId,
        userId: data.userId,
        status: data.status,
        timestamp: data.timestamp
      })

      const response = await fetch(`${this.mainlineBaseUrl}/api/webhooks/subscription-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Service': 'payment-service',
          'X-Event': 'subscription_updated'
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        logger.info('Subscription update notification sent successfully', {
          orderId: data.orderId,
          status: response.status,
          statusText: response.statusText
        })
        return true
      } else {
        logger.warn('Subscription update notification failed', {
          orderId: data.orderId,
          status: response.status,
          statusText: response.statusText,
          response: await response.text().catch(() => 'Unable to read response')
        })
        return false
      }
    } catch (error: any) {
      logger.error('Failed to send subscription update notification', {
        orderId: data.orderId,
        error: error.message,
        stack: error.stack
      })
      return false
    }
  }

  /**
   * Send credits allocation notification to mainline
   */
  async notifyCreditsAllocation(data: {
    orderId: string
    userId: string
    credits: number
    teachingHours: number
    timestamp: number
    plan: string
  }): Promise<boolean> {
    try {
      const payload = {
        event: 'credits_allocated',
        order_id: data.orderId,
        user_id: data.userId,
        credits: data.credits,
        teaching_hours: data.teachingHours,
        timestamp: data.timestamp,
        plan: data.plan,
        service: 'payment_service'
      }

      logger.info('Sending credits allocation notification to mainline', {
        orderId: data.orderId,
        userId: data.userId,
        credits: data.credits,
        teachingHours: data.teachingHours,
        timestamp: data.timestamp
      })

      const response = await fetch(`${this.mainlineBaseUrl}/api/webhooks/credits-allocation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Service': 'payment-service',
          'X-Event': 'credits_allocated'
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        logger.info('Credits allocation notification sent successfully', {
          orderId: data.orderId,
          status: response.status,
          statusText: response.statusText
        })
        return true
      } else {
        logger.warn('Credits allocation notification failed', {
          orderId: data.orderId,
          status: response.status,
          statusText: response.statusText,
          response: await response.text().catch(() => 'Unable to read response')
        })
        return false
      }
    } catch (error: any) {
      logger.error('Failed to send credits allocation notification', {
        orderId: data.orderId,
        error: error.message,
        stack: error.stack
      })
      return false
    }
  }

  /**
   * Test connection to mainline
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.mainlineBaseUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Service': 'payment-service'
        },
      })

      if (response.ok) {
        logger.info('Mainline connection test successful', {
          status: response.status,
          statusText: response.statusText
        })
        return true
      } else {
        logger.warn('Mainline connection test failed', {
          status: response.status,
          statusText: response.statusText
        })
        return false
      }
    } catch (error: any) {
      logger.error('Mainline connection test failed', {
        error: error.message,
        stack: error.stack
      })
      return false
    }
  }
}

/**
 * Global mainline notifier instance
 */
let mainlineNotifier: MainlineNotifier | null = null

/**
 * Initialize mainline notifier
 */
export function initializeMainlineNotifier(
  mainlineBaseUrl: string, 
  apiKey: string, 
  timeout: number = 10000
): void {
  mainlineNotifier = new MainlineNotifier(mainlineBaseUrl, apiKey, timeout)
  logger.info('Mainline notifier initialized', {
    mainlineBaseUrl,
    timeout
  })
}

/**
 * Get mainline notifier instance
 */
export function getMainlineNotifier(): MainlineNotifier {
  if (!mainlineNotifier) {
    throw new Error('Mainline notifier not initialized. Call initializeMainlineNotifier() first.')
  }
  return mainlineNotifier
}
