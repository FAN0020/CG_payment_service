import { PaymentDatabase } from '../lib/database.js'
import { handlerRegistry } from '../lib/handler-registry.js'
import { createBillingOrderCreateHandler } from './create-order.js'
import { createBillingSubscriptionUpdateHandler } from './update-subscription.js'
import { createBillingSubscriptionQueryHandler } from './query-subscription.js'

/**
 * Initialize and register all internal billing handlers
 * 
 * These are internal to the payment service and NOT exposed as mainline plugins.
 */
export function initializeHandlers(db: PaymentDatabase): void {
  handlerRegistry.register('create-order', createBillingOrderCreateHandler(db))
  handlerRegistry.register('update-subscription', createBillingSubscriptionUpdateHandler(db))
  handlerRegistry.register('query-subscription', createBillingSubscriptionQueryHandler(db))

  console.log(`[Handlers] Registered ${handlerRegistry.list().length} billing handlers:`, handlerRegistry.list())
}
