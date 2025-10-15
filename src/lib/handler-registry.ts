import { PluginContext, PluginResponse, PluginHandler, ValidationError } from '../types/index.js'
import { logger } from './logger.js'
import { nanoid } from 'nanoid'

/**
 * Internal billing handler registry for payment service
 * 
 * NOTE: This is NOT the mainline plugin orchestrator. 
 * These are internal handlers for billing operations within this microservice only.
 * 
 * We use similar patterns (context, response format) for consistency,
 * but these handlers are never exposed externally or registered with mainline.
 */
export class BillingHandlerRegistry {
  private handlers: Record<string, PluginHandler> = {}

  /**
   * Register an internal billing handler
   */
  register(handlerName: string, handler: PluginHandler): void {
    if (this.handlers[handlerName]) {
      logger.warn(`Handler ${handlerName} already registered, overwriting`)
    }
    this.handlers[handlerName] = handler
    logger.info(`Billing handler registered: ${handlerName}`)
  }

  /**
   * Execute an internal billing handler
   */
  async execute(
    handlerName: string,
    inputs: Record<string, any>,
    userId: string = 'system',
    userEmail?: string
  ): Promise<PluginResponse> {
    const requestId = nanoid()
    const timestamp = Date.now()

    logger.info(`Handler execution started: ${handlerName}`, {
      requestId,
      userId,
      handler: handlerName
    })

    const handler = this.handlers[handlerName]
    if (!handler) {
      logger.error(`Handler not found: ${handlerName}`, { requestId })
      return {
        status_code: 404,
        message: `Handler not found: ${handlerName}`,
        requestId
      }
    }

    try {
      const context: PluginContext = {
        requestId,
        userId,
        userEmail,
        timestamp,
        inputs
      }

      const response = await handler(context)

      logger.info(`Handler execution completed: ${handlerName}`, {
        requestId,
        status: response.status_code
      })

      return response

    } catch (error: any) {
      logger.error(`Handler execution failed: ${handlerName}`, {
        requestId,
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
        message: `Internal error: ${error.message}`,
        requestId
      }
    }
  }

  /**
   * List all registered handlers
   */
  list(): string[] {
    return Object.keys(this.handlers)
  }
}

// Export singleton instance
export const handlerRegistry = new BillingHandlerRegistry()
