import { FastifyInstance } from 'fastify'
import { PaymentDatabase } from '../lib/database.js'
import { JWTManager } from '../lib/jwt.js'
import { logger } from '../lib/logger.js'
import { generateRequestId } from '../lib/api-response.js'

export async function registerCreditsRoutes(fastify: FastifyInstance) {
  const db = fastify.paymentDb as PaymentDatabase
  const jwtManager = fastify.jwtManager as JWTManager

  // Health check endpoint
  fastify.get('/api/credits/health', async (request, reply) => {
    const requestId = generateRequestId()
    logger.info(`[${requestId}] Health check requested`)
    
    return {
      status: 'healthy',
      service: 'payment-service',
      timestamp: new Date().toISOString(),
      requestId
    }
  })

  // Get user credits status
  fastify.get('/api/credits/status', async (request, reply) => {
    const requestId = generateRequestId()
    logger.info(`[${requestId}] Credits status requested`)

    try {
      const authHeader = request.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn(`[${requestId}] No valid authorization header`)
        return reply.status(400).send({
          error: 'Missing or invalid authorization header',
          requestId
        })
      }

      const token = authHeader.substring(7)
      const decoded = jwtManager.verifyToken(token)
      
      if (!decoded || !decoded.userId) {
        logger.warn(`[${requestId}] Invalid token`)
        return reply.status(401).send({
          error: 'Invalid token',
          requestId
        })
      }

      const userId = decoded.userId
      logger.info(`[${requestId}] Getting credits status for user: ${userId}`)

      // Check if user has active subscription
      const subscription = await db.getActiveSubscription(userId)
      const isPremium = subscription && subscription.status === 'active'

      // Get credit balance
      const creditBalance = await db.getCreditBalance(userId)

      return {
        userId,
        isPremium,
        creditBalance: creditBalance || 0,
        requestId
      }

    } catch (error) {
      logger.error(`[${requestId}] Error getting credits status:`, error)
      return reply.status(500).send({
        error: 'Internal server error',
        requestId
      })
    }
  })

  // Deduct credits
  fastify.post('/api/credits/deduct', async (request, reply) => {
    const requestId = generateRequestId()
    logger.info(`[${requestId}] Credits deduction requested`)

    try {
      const authHeader = request.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn(`[${requestId}] No valid authorization header`)
        return reply.status(400).send({
          error: 'Missing or invalid authorization header',
          requestId
        })
      }

      const token = authHeader.substring(7)
      const decoded = jwtManager.verifyToken(token)
      
      if (!decoded || !decoded.userId) {
        logger.warn(`[${requestId}] Invalid token`)
        return reply.status(401).send({
          error: 'Invalid token',
          requestId
        })
      }

      const userId = decoded.userId
      const { amount, reason } = request.body as { amount: number; reason: string }

      if (!amount || amount <= 0) {
        logger.warn(`[${requestId}] Invalid amount: ${amount}`)
        return reply.status(400).send({
          error: 'Invalid amount',
          requestId
        })
      }

      logger.info(`[${requestId}] Deducting ${amount} credits for user: ${userId}, reason: ${reason}`)

      // Check if user has sufficient credits
      const currentBalance = await db.getCreditBalance(userId)
      if (!currentBalance || currentBalance < amount) {
        logger.warn(`[${requestId}] Insufficient credits. Current: ${currentBalance}, Required: ${amount}`)
        return reply.status(400).send({
          error: 'Insufficient credits',
          currentBalance: currentBalance || 0,
          required: amount,
          requestId
        })
      }

      // Deduct credits
      const newBalance = await db.deductCredits(userId, amount, reason)
      
      logger.info(`[${requestId}] Credits deducted successfully. New balance: ${newBalance}`)

      return {
        userId,
        amountDeducted: amount,
        newBalance,
        reason,
        requestId
      }

    } catch (error) {
      logger.error(`[${requestId}] Error deducting credits:`, error)
      return reply.status(500).send({
        error: 'Internal server error',
        requestId
      })
    }
  })

  // Reward credits
  fastify.post('/api/credits/reward', async (request, reply) => {
    const requestId = generateRequestId()
    logger.info(`[${requestId}] Credits reward requested`)

    try {
      const authHeader = request.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn(`[${requestId}] No valid authorization header`)
        return reply.status(400).send({
          error: 'Missing or invalid authorization header',
          requestId
        })
      }

      const token = authHeader.substring(7)
      const decoded = jwtManager.verifyToken(token)
      
      if (!decoded || !decoded.userId) {
        logger.warn(`[${requestId}] Invalid token`)
        return reply.status(401).send({
          error: 'Invalid token',
          requestId
        })
      }

      const userId = decoded.userId
      const { amount, reason } = request.body as { amount: number; reason: string }

      if (!amount || amount <= 0) {
        logger.warn(`[${requestId}] Invalid amount: ${amount}`)
        return reply.status(400).send({
          error: 'Invalid amount',
          requestId
        })
      }

      logger.info(`[${requestId}] Rewarding ${amount} credits to user: ${userId}, reason: ${reason}`)

      // Reward credits
      const newBalance = await db.rewardCredits(userId, amount, reason)
      
      logger.info(`[${requestId}] Credits rewarded successfully. New balance: ${newBalance}`)

      return {
        userId,
        amountRewarded: amount,
        newBalance,
        reason,
        requestId
      }

    } catch (error) {
      logger.error(`[${requestId}] Error rewarding credits:`, error)
      return reply.status(500).send({
        error: 'Internal server error',
        requestId
      })
    }
  })
}
