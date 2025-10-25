import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { PaymentDatabase } from '../lib/database.js'
import { logger } from '../lib/logger.js'

/**
 * Promo Code API routes
 */
export async function registerPromoRoutes(
  fastify: FastifyInstance,
  db: PaymentDatabase
): Promise<void> {

  /**
   * Validate promo code
   * POST /api/promo/validate
   */
  fastify.post('/api/promo/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      const { code } = request.body as { code: string }
      
      if (!code) {
        return reply.code(400).send({
          valid: false,
          message: 'Promo code is required'
        })
      }

      // Sanitize and validate format
      const sanitizedCode = code.trim().toUpperCase()
      const codePattern = /^CG-[A-Z0-9]{4}-[A-Z0-9]{4}$/
      
      if (!codePattern.test(sanitizedCode)) {
        logger.warn('Invalid promo code format', {
          requestId,
          code: sanitizedCode
        })
        
        return reply.code(400).send({
          valid: false,
          message: 'Invalid promo code format. Use CG-XXXX-XXXX'
        })
      }

      // Check if code exists and is valid
      const isValid = db.isPromoCodeValid(sanitizedCode)
      
      if (!isValid) {
        const promoCode = db.getPromoCode(sanitizedCode)
        
        if (!promoCode) {
          logger.warn('Promo code not found', {
            requestId,
            code: sanitizedCode
          })
          
          return reply.code(404).send({
            valid: false,
            message: 'Promo code not found'
          })
        }
        
        if (promoCode.is_used) {
          logger.warn('Promo code already used', {
            requestId,
            code: sanitizedCode,
            usedBy: promoCode.used_by,
            usedAt: promoCode.used_at
          })
          
          return reply.code(400).send({
            valid: false,
            message: 'Promo code has already been used'
          })
        }
        
        if (promoCode.expires_at && promoCode.expires_at < Date.now()) {
          logger.warn('Promo code expired', {
            requestId,
            code: sanitizedCode,
            expiresAt: promoCode.expires_at
          })
          
          return reply.code(400).send({
            valid: false,
            message: 'Promo code has expired'
          })
        }
      }

      // Get promo code details
      const promoCode = db.getPromoCode(sanitizedCode)
      
      logger.info('Promo code validated successfully', {
        requestId,
        code: sanitizedCode,
        planType: promoCode.plan_type,
        planAmount: promoCode.plan_amount,
        planCurrency: promoCode.plan_currency
      })

      return reply.send({
        valid: true,
        message: 'Promo code is valid',
        code: sanitizedCode,
        planType: promoCode.plan_type,
        planAmount: promoCode.plan_amount,
        planCurrency: promoCode.plan_currency,
        expiresAt: promoCode.expires_at
      })

    } catch (error: any) {
      logger.error('Promo code validation error', {
        requestId,
        error: error.message,
        stack: error.stack
      })

      return reply.code(500).send({
        valid: false,
        message: 'Internal server error during validation'
      })
    }
  })

  /**
   * Get promo code statistics (Admin only)
   * GET /api/promo/stats
   */
  fastify.get('/api/promo/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      const stats = db.getPromoCodeStats()
      
      logger.info('Promo code stats retrieved', {
        requestId,
        total: stats.total,
        unused: stats.unused,
        used: stats.used
      })

      return reply.send({
        success: true,
        data: {
          total: stats.total,
          unused: stats.unused,
          used: stats.used,
          usageRate: stats.total > 0 ? ((stats.used / stats.total) * 100).toFixed(2) : 0
        }
      })

    } catch (error: any) {
      logger.error('Promo code stats error', {
        requestId,
        error: error.message,
        stack: error.stack
      })

      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve promo code statistics'
      })
    }
  })

  /**
   * Health check for promo service
   * GET /api/promo/health
   */
  fastify.get('/api/promo/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'healthy',
      service: 'promo',
      timestamp: Date.now()
    })
  })
}


