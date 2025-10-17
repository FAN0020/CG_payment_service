import { PluginContext, PluginResponse, QuerySubscriptionInputSchema, ValidationError } from '../types/index.js'
import { PaymentDatabase } from '../lib/database.js'
import { logger } from '../lib/logger.js'

/**
 * Internal Handler: Query Subscription
 * Queries subscription status by userId or orderId
 */
export function createBillingSubscriptionQueryHandler(db: PaymentDatabase) {
  return async (ctx: PluginContext): Promise<PluginResponse> => {
    const { requestId, userId, inputs } = ctx

    try {
      // Validate inputs
      const validationResult = QuerySubscriptionInputSchema.safeParse(inputs)
      if (!validationResult.success) {
        throw new ValidationError(`Invalid input: ${validationResult.error.message}`)
      }

      const { userId: inputUserId, orderId } = validationResult.data

      // Query logic
      let activeSubscription = null
      let allOrders: any[] = []

      if (orderId) {
        // Query by order ID
        const order = db.getOrderById(orderId)
        if (order) {
          allOrders = [order]
          if (order.status === 'active' && (!order.expires_at || order.expires_at > Date.now())) {
            activeSubscription = order
          }
        }
      } else if (inputUserId || userId) {
        // Query by user ID
        const targetUserId = inputUserId || userId
        activeSubscription = db.getActiveSubscriptionByUserId(targetUserId)
        allOrders = db.getOrdersByUserId(targetUserId)
      } else {
        throw new ValidationError('Must provide userId or orderId')
      }

      const isActive = activeSubscription !== null

      logger.info('Subscription query completed', {
        requestId,
        userId: inputUserId || userId,
        isActive,
        ordersFound: allOrders.length
      })

      return {
        status_code: 200,
        message: 'Subscription query successful',
        data: {
          is_active: isActive,
          active_subscription: activeSubscription ? {
            order_id: activeSubscription.order_id,
            plan: activeSubscription.plan,
            status: activeSubscription.status,
            expires_at: activeSubscription.expires_at,
            created_at: activeSubscription.created_at
          } : null,
          all_orders: allOrders.map(o => ({
            order_id: o.order_id,
            plan: o.plan,
            status: o.status,
            amount: o.amount,
            currency: o.currency,
            created_at: o.created_at,
            expires_at: o.expires_at
          }))
        },
        requestId
      }

    } catch (error: any) {
      logger.error('Failed to query subscription', {
        requestId,
        userId,
        error: error.message
      })

      if (error instanceof ValidationError) {
        return {
          status_code: 400,
          message: error.message,
          requestId
        }
      }

      return {
        status_code: 500,
        message: `Failed to query subscription: ${error.message}`,
        requestId
      }
    }
  }
}

