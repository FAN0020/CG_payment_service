import { PluginContext, PluginResponse, CreateOrderInputSchema, ValidationError } from '../types/index.js'
import { PaymentDatabase } from '../lib/database.js'
import { logger } from '../lib/logger.js'
import { nanoid } from 'nanoid'

/**
 * Internal Handler: Create Order
 * Creates a new subscription order in the database
 */
export function createBillingOrderCreateHandler(db: PaymentDatabase) {
  return async (ctx: PluginContext): Promise<PluginResponse> => {
    const { requestId, userId, inputs } = ctx

    try {
      // Validate inputs
      const validationResult = CreateOrderInputSchema.safeParse(inputs)
      if (!validationResult.success) {
        throw new ValidationError(`Invalid input: ${validationResult.error.message}`)
      }

      const { userId: inputUserId, stripeCustomerEmail, plan, amount, currency, paymentMethod, platform, clientRef, promoCode } = validationResult.data

      // Generate unique order ID
      const orderId = `order_${nanoid(16)}`

      // Create order in database
      const order = db.createOrder({
        order_id: orderId,
        user_id: inputUserId || userId,
        stripe_customer_email: stripeCustomerEmail,
        status: 'pending',
        plan,
        amount,
        currency,
        payment_method: paymentMethod,
        platform,
        client_ref: clientRef,
        promo_code: promoCode
      })

      logger.info('Order created successfully', {
        requestId,
        userId: order.user_id,
        orderId: order.order_id,
        plan: order.plan
      })

      return {
        status_code: 200,
        message: 'Order created successfully',
        data: {
          order_id: order.order_id,
          user_id: order.user_id,
          status: order.status,
          plan: order.plan,
          amount: order.amount,
          currency: order.currency,
          created_at: order.created_at
        },
        requestId
      }

    } catch (error: any) {
      logger.error('Failed to create order', {
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
        message: `Failed to create order: ${error.message}`,
        requestId
      }
    }
  }
}

