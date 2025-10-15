import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { PaymentDatabase } from './lib/database.js'
import { JWTManager } from './lib/jwt.js'
import { StripeManager } from './lib/stripe.js'
import { logger } from './lib/logger.js'
import { initializeHandlers } from './handlers/index.js'
import { registerPaymentRoutes } from './routes/payment.js'
import { registerWebhookRoutes } from './routes/webhook.js'

/**
 * Load and validate environment variables
 */
function loadConfig() {
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'JWT_SECRET',
    'STRIPE_MONTHLY_PRICE_ID'
  ]

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`)
    }
  }

  return {
    port: parseInt(process.env.PORT || '8790', 10),
    dbPath: process.env.DB_PATH || './payment.db',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    jwtSecret: process.env.JWT_SECRET!,
    stripePriceId: process.env.STRIPE_MONTHLY_PRICE_ID!,
    planAmount: parseFloat(process.env.MONTHLY_PLAN_AMOUNT || '9.90'),
    planCurrency: process.env.MONTHLY_PLAN_CURRENCY || 'SGD',
    successUrl: process.env.FRONTEND_SUCCESS_URL || 'http://localhost:3000/payment/success',
    cancelUrl: process.env.FRONTEND_CANCEL_URL || 'http://localhost:3000/payment/cancel'
  }
}

/**
 * Main server initialization
 */
async function main() {
  try {
    // Load configuration
    const config = loadConfig()
    logger.info('Configuration loaded successfully')

    // Initialize database
    const db = new PaymentDatabase(config.dbPath)
    logger.info('Database initialized')

    // Initialize internal billing handlers
    initializeHandlers(db)

    // Initialize managers
    const jwtManager = new JWTManager(config.jwtSecret)
    const stripeManager = new StripeManager(config.stripeSecretKey)
    logger.info('Managers initialized')

    // Create Fastify instance
    const fastify = Fastify({
      logger: false, // Use our custom logger
      bodyLimit: 10485760, // 10MB
      requestIdLogLabel: 'requestId',
      disableRequestLogging: true
    })

    // Register CORS
    await fastify.register(cors, {
      origin: true, // Allow all origins in development; restrict in production
      credentials: true
    })

    // Add raw body support for webhook signature verification
    fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      try {
        const json = JSON.parse(body.toString())
        ;(req as any).rawBody = body
        done(null, json)
      } catch (err: any) {
        err.statusCode = 400
        done(err, undefined)
      }
    })

    // Register routes
    await registerPaymentRoutes(fastify, jwtManager, stripeManager, {
      priceId: config.stripePriceId,
      planAmount: config.planAmount,
      planCurrency: config.planCurrency,
      successUrl: config.successUrl,
      cancelUrl: config.cancelUrl
    })

    await registerWebhookRoutes(fastify, stripeManager, db, config.stripeWebhookSecret)

    logger.info('Routes registered')

    // Start server
    await fastify.listen({ port: config.port, host: '0.0.0.0' })

    logger.info(`🚀 Payment service running on port ${config.port}`)
    logger.info(`✅ Database: ${config.dbPath}`)
    logger.info(`✅ Registered handlers: ${(await import('./lib/handler-registry.js')).handlerRegistry.list().join(', ')}`)

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...')
      await fastify.close()
      db.close()
      logger.info('Shutdown complete')
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message })
    console.error(error)
    process.exit(1)
  }
}

// Start server
main()

