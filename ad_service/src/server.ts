import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from './lib/logger.js';
import { initDatabase, closeDatabase } from './lib/database.js';
import { initGoogleAds } from './lib/google-ads.js';
import { registerAdRoutes } from './routes/index.js';
import { registerRequestId } from './middleware/request-id.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || '8791', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];

/**
 * Initialize the ad service
 */
async function startServer(): Promise<void> {
  try {
    // Initialize database
    logger.info('Initializing database...');
    await initDatabase();

    // Initialize Google Ads
    logger.info('Initializing Google Ads...');
    await initGoogleAds();

    // Create Fastify instance
    const fastify = Fastify({
      logger: false, // Use our custom logger
      trustProxy: true,
    });

    // Register CORS
    await fastify.register(cors, {
      origin: CORS_ORIGIN,
      credentials: true,
    });

    // Register static file serving for frontend
    const frontendPath = join(__dirname, '..', 'frontend');
    try {
      await fastify.register(fastifyStatic, {
        root: frontendPath,
        prefix: '/demo/',
      });
      // Also expose under /public/ for compatibility
      await fastify.register(fastifyStatic, {
        root: frontendPath,
        prefix: '/public/',
        decorateReply: false,
      });
      logger.info('Static files registered', { path: frontendPath });
    } catch (error) {
      logger.warn('Failed to register static files', { error, path: frontendPath });
      // Continue without static files
    }

    // Register routes
    registerRequestId(fastify);
    await registerAdRoutes(fastify);

    // Root endpoint
    fastify.get('/', async (_request, reply) => {
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>ClassGuru Ad Service</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              max-width: 800px;
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
          </style>
        </head>
        <body>
          <h1>🎯 ClassGuru Ad Service</h1>
          <p class="subtitle">Google Ads Integration Microservice</p>
          
          <div class="info-box">
            <h2>Status: ✅ Running</h2>
            <p>Port: ${PORT}</p>
            <p>Mode: ${process.env.MOCK_ADS_MODE === 'true' ? '🎭 Mock' : '🌐 Production'}</p>
          </div>
          
          <div class="info-box">
            <h2>📡 Available Endpoints</h2>
            <div class="endpoint">GET /api/ads/health - Health check</div>
            <div class="endpoint">GET /api/ads/config - AdSense configuration</div>
            <div class="endpoint">POST /api/ads/request - Request an ad</div>
            <div class="endpoint">POST /api/ads/click - Track ad click</div>
            <div class="endpoint">GET /api/ads/metrics - Get ad metrics (auth required)</div>
          </div>
          
          <div class="info-box">
            <h2>🔗 Quick Links</h2>
            <p><a href="/api/ads/health" target="_blank">Health Check</a></p>
            <p><a href="/api/ads/config" target="_blank">AdSense Config</a></p>
            <p><a href="/demo" target="_blank">Demo Page</a></p>
          </div>
        </body>
        </html>
      `);
    });

    // Start server
    await fastify.listen({ port: PORT, host: HOST });

    logger.info(`🚀 Ad Service started successfully`);
    logger.info(`📍 Server running at: http://localhost:${PORT}`);
    logger.info(`🎭 Mock mode: ${process.env.MOCK_ADS_MODE === 'true' ? 'Enabled' : 'Disabled'}`);
    logger.info(`📊 Health check: http://localhost:${PORT}/api/ads/health`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await fastify.close();
        await closeDatabase();
        logger.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error });
    if (error instanceof Error) {
      logger.error('Error details', { message: error.message, stack: error.stack });
    }
    process.exit(1);
  }
}

// Start the server
startServer();
