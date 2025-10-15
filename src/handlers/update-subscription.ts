import { PluginContext, PluginResponse, UpdateSubscriptionInputSchema, ValidationError } from '../types/index.js'
import { PaymentDatabase } from '../lib/database.js'
import { logger } from '../lib/logger.js'

/**
 * Internal Handler: Update Subscription
 * Updates subscription order details (status, Stripe IDs, expiration, etc.)
 */
export function createBillingSubscriptionUpdateHandler(db: PaymentDatabase) {
  return async (ctx: PluginContext): Promise<PluginResponse> => {
    const { requestId, userId, inputs } = ctx

    try {
      // Validate inputs
      const validationResult = UpdateSubscriptionInputSchema.safeParse(inputs)
      if (!validationResult.success) {
        throw new ValidationError(`Invalid input: ${validationResult.error.message}`)
      }

      const data = validationResult.data

      // Find order by ID, session ID, or subscription ID
      let order = null
      if (data.orderId) {
        order = db.getOrderById(data.orderId)
      } else if (data.stripeSessionId) {
        order = db.getOrderByStripeSessionId(data.stripeSessionId)
      } else if (data.stripeSubscriptionId) {
        order = db.getOrderByStripeSubscriptionId(data.stripeSubscriptionId)
      } else if (data.userEmail) {
        // Get most recent order for this email
        const orders = db.getOrdersByEmail(data.userEmail)
        order = orders[0] || null
      }

      if (!order) {
        throw new ValidationError('Order not found')
      }

      // Build update object (only include provided fields)
      const updates: any = {}
      if (data.stripeSessionId !== undefined) updates.stripe_session_id = data.stripeSessionId
      if (data.stripeSubscriptionId !== undefined) updates.stripe_subscription_id = data.stripeSubscriptionId
      if (data.stripeCustomerId !== undefined) updates.stripe_customer_id = data.stripeCustomerId
      if (data.status !== undefined) updates.status = data.status
      if (data.expiresAt !== undefined) updates.expires_at = data.expiresAt

      // Update order
      const updatedOrder = db.updateOrder(order.order_id, updates)

      if (!updatedOrder) {
        throw new Error('Failed to update order')
      }

      logger.info('Subscription updated successfully', {
        requestId,
        userId,
        orderId: updatedOrder.order_id,
        status: updatedOrder.status
      })

      return {
        status_code: 200,
        message: 'Subscription updated successfully',
        data: {
          order_id: updatedOrder.order_id,
          user_email: updatedOrder.user_email,
          status: updatedOrder.status,
          stripe_subscription_id: updatedOrder.stripe_subscription_id,
          expires_at: updatedOrder.expires_at,
          updated_at: updatedOrder.updated_at
        },
        requestId
      }

    } catch (error: any) {
      logger.error('Failed to update subscription', {
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
        message: `Failed to update subscription: ${error.message}`,
        requestId
      }
    }
  }
}

