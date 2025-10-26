import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { PaymentDatabase } from './lib/database.js'
import { JWTManager } from './lib/jwt.js'
import { StripeManager } from './lib/stripe.js'
import { logger } from './lib/logger.js'
import { initializeHandlers } from './handlers/index.js'
import { registerPaymentRoutes } from './routes/payment.js'
import { registerWebhookRoutes } from './routes/webhook.js'
import { registerMainlineApiRoutes } from './routes/mainline-api.js'
import { registerPromoRoutes } from './routes/promo.js'
import { registerCreditsRoutes } from './routes/credits.js'
import { generateRequestId } from './lib/api-response.js'
import { initializeEncryption } from './lib/encryption.js'
import { initializeMainlineNotifier } from './lib/mainline-notifier.js'
// import { registerAdRoutes } from '../../CG_ad_service/src/routes/index.js'
// import { initDatabase as initAdDatabase, closeDatabase as closeAdDatabase } from '../../CG_ad_service/src/lib/database.js'
// import { initGoogleAds } from '../../CG_ad_service/src/lib/google-ads.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Load and validate environment variables
 */
function loadConfig() {
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'JWT_SECRET',
    'STRIPE_DAILY_PRICE_ID',
    'STRIPE_WEEKLY_PRICE_ID',
    'STRIPE_MONTHLY_PRICE_ID',
    'MAINLINE_BASE_URL',
    'MAINLINE_API_KEY'
  ]

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`)
    }
  }

  // Determine base URL based on environment
  const isProduction = process.env.NODE_ENV === 'production' || process.env.PRODUCTION_URL
  const baseUrl = isProduction 
    ? (process.env.PRODUCTION_URL || 'https://yp.test.classguruai.com')
    : 'http://localhost:8790'

  return {
    port: parseInt(process.env.PORT || '8790', 10),
    dbPath: process.env.DB_PATH || './data/payment.db',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    jwtSecret: process.env.JWT_SECRET!,
    stripePriceId: process.env.STRIPE_WEEKLY_PRICE_ID!,
    planAmount: parseFloat(process.env.WEEKLY_PLAN_AMOUNT || '9.90'),
    planCurrency: process.env.PLAN_CURRENCY || 'SGD',
    successUrl: process.env.FRONTEND_SUCCESS_URL || `${baseUrl}/payment/success`,
    cancelUrl: process.env.FRONTEND_CANCEL_URL || `${baseUrl}/payment/cancel`,
    baseUrl,
    isProduction,
    mainlineBaseUrl: process.env.MAINLINE_BASE_URL!,
    mainlineApiKey: process.env.MAINLINE_API_KEY!
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

    // Initialize encryption first
    initializeEncryption(config.jwtSecret)
    logger.info('Encryption initialized')

    // Initialize mainline notifier
    initializeMainlineNotifier(config.mainlineBaseUrl, config.mainlineApiKey)
    logger.info('Mainline notifier initialized')

    // Initialize ad service database
    logger.info('Initializing ad service database...')
    // await initAdDatabase()
    logger.info('Ad service database initialized')

    // Initialize Google Ads
    logger.info('Initializing Google Ads...')
    // await initGoogleAds()
    logger.info('Google Ads initialized')

    // Initialize payment database
    const db = new PaymentDatabase(config.dbPath)
    logger.info('Payment database initialized')

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
      disableRequestLogging: true,
      genReqId: () => generateRequestId()
    })

    // Register CORS
    await fastify.register(cors, {
      origin: true, // Allow all origins in development; restrict in production
      credentials: true
    })

    // Register static file serving for frontend
    const frontendPath = join(__dirname, '..', 'frontend')
    await fastify.register(fastifyStatic, {
      root: frontendPath,
      prefix: '/payment/',
      decorateReply: true  // Enable sendFile method on reply
    })

    // Decorate fastify with database and JWT manager
    fastify.decorate('paymentDb', db)
    fastify.decorate('jwtManager', jwtManager)

    // Serve index.html at /payment route
    fastify.get('/payment', async (request, reply) => {
      return reply.sendFile('index.html')
    })

    // Serve success page
    fastify.get('/payment/success', async (request, reply) => {
      return reply.sendFile('success.html')
    })

    // Serve cancel page
    fastify.get('/payment/cancel', async (request, reply) => {
      return reply.sendFile('cancel.html')
    })

    // Root endpoint with integrated service information
    fastify.get('/', async (request, reply) => {
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>ClassGuru Integrated Service</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              max-width: 1000px;
              margin: 50px auto;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            h1 { font-size: 2.5em; margin-bottom: 10px; }
            .subtitle { font-size: 1.2em; opacity: 0.9; margin-bottom: 30px; }
            .info-box { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin: 20px 0; }
            .endpoint { background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; margin: 10px 0; font-family: monospace; }
            a { color: #50E3C2; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .service-section { margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>🎯 ClassGuru Integrated Service</h1>
          <p class="subtitle">Payment & Ad Service Integration</p>
          
          <div class="info-box">
            <h2>Status: ✅ Running</h2>
            <p>Port: ${config.port}</p>
            <p>Mode: ${config.isProduction ? '🌐 Production' : '🔧 Development'}</p>
          </div>
          
          <div class="service-section">
            <h2>💳 Payment Service</h2>
            <div class="endpoint">POST /api/payment/create-order - Create payment order</div>
            <div class="endpoint">GET /api/payment/query-subscription - Query subscription</div>
            <div class="endpoint">POST /api/payment/update-subscription - Update subscription</div>
            <div class="endpoint">POST /api/webhook/stripe - Stripe webhook</div>
            <div class="endpoint">GET /api/credits/balance - Get credits balance</div>
            <div class="endpoint">POST /api/credits/consume - Consume credits</div>
          </div>
          
          <div class="service-section">
            <h2>📡 Ad Service</h2>
            <div class="endpoint">GET /api/ads/health - Health check</div>
            <div class="endpoint">GET /api/ads/config - AdSense configuration</div>
            <div class="endpoint">POST /api/ads/request - Request an ad</div>
            <div class="endpoint">POST /api/ads/click - Track ad click</div>
            <div class="endpoint">GET /api/ads/metrics - Get ad metrics (auth required)</div>
          </div>
          
          <div class="info-box">
            <h2>🔗 Quick Links</h2>
            <p><a href="/api/ads/health" target="_blank">Ad Service Health</a></p>
            <p><a href="/api/ads/config" target="_blank">AdSense Config</a></p>
            <p><a href="/payment" target="_blank">Payment Demo</a></p>
          </div>
        </body>
        </html>
      `)
    })

    // Add raw body support for webhook signature verification
    fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      try {
        // Store raw body for webhook signature verification
        ;(req as any).rawBody = body
        
        // Parse JSON for normal request handling
        const json = JSON.parse(body.toString())
        done(null, json)
      } catch (err: any) {
        err.statusCode = 400
        done(err, undefined)
      }
    })

    // Register routes
    await registerPaymentRoutes(fastify, jwtManager, stripeManager, db, {
      priceId: config.stripePriceId,
      planAmount: config.planAmount,
      planCurrency: config.planCurrency,
      successUrl: config.successUrl,
      cancelUrl: config.cancelUrl,
      baseUrl: config.baseUrl,
      isProduction: !!config.isProduction
    })

    await registerWebhookRoutes(fastify, stripeManager, db, config.stripeWebhookSecret)

    // Register mainline-facing API routes
    await registerMainlineApiRoutes(fastify, jwtManager, stripeManager, db, {
      priceId: config.stripePriceId,
      planAmount: config.planAmount,
      planCurrency: config.planCurrency,
      successUrl: config.successUrl,
      cancelUrl: config.cancelUrl,
      baseUrl: config.baseUrl,
      isProduction: !!config.isProduction
    })

    // Register promo code routes
    await registerPromoRoutes(fastify, db)

    // Register credits routes for ad service integration
    await registerCreditsRoutes(fastify, jwtManager, db)

    // Register ad service routes
    // await registerAdRoutes(fastify)

    logger.info('Routes registered')

    // Start server
    await fastify.listen({ port: config.port, host: '0.0.0.0' })

    logger.info(`🚀 Payment service running on port ${config.port}`)
    logger.info(`✅ Database: ${config.dbPath}`)
    logger.info(`✅ Registered handlers: ${(await import('./lib/handler-registry.js')).handlerRegistry.list().join(', ')}`)

    // Start cleanup task for expired request IDs (every 5 minutes)
    const cleanupInterval = setInterval(() => {
      try {
        const cleanedCount = db.cleanExpiredRequestIds()
        if (cleanedCount > 0) {
          logger.info(`Cleaned ${cleanedCount} expired request IDs`)
        }
      } catch (error: any) {
        logger.error('Failed to clean expired request IDs', { error: error.message })
      }
    }, 5 * 60 * 1000) // 5 minutes

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...')
      clearInterval(cleanupInterval)
      await fastify.close()
      db.close()
      // await closeAdDatabase()
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

