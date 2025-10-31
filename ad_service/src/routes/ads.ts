import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, extractToken } from '../lib/jwt.js';
import { handleAdRequest, handleAdClick, handleGetMetrics } from '../handlers/index.js';
import { getAdSenseConfig } from '../lib/google-ads.js';
import { getMockAdSenseConfig } from '../lib/mock-google-ads.js';
import { AD_CONFIG } from '../config/ads.js';
import { checkDatabaseHealth } from '../lib/database.js';
import { checkGoogleAdsHealth } from '../lib/google-ads.js';
import { logger } from '../lib/logger.js';
import type { AdRequest } from '../types/index.js';

interface AdRequestBody {
  page: string;
  format: 'banner' | 'video' | 'native';
  size?: {
    width: number;
    height: number;
  };
  sessionId: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

interface ClickTrackingBody {
  impressionId: string;
  clickUrl: string;
  viewabilityToken?: string;
}

interface MetricsQuery {
  adUnitId: string;
  startDate: string;
  endDate: string;
}

/**
 * Register ad service routes
 */
export async function registerAdRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check endpoint (no auth required)
  fastify.get('/api/ads/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dbHealth = await checkDatabaseHealth();
      const adsHealth = await checkGoogleAdsHealth();
      const isHealthy = dbHealth && adsHealth;

      const response = {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date(),
        uptime: process.uptime(),
        version: '1.0.0',
        services: {
          database: dbHealth,
          googleAds: adsHealth,
        },
      };

      reply.code(isHealthy ? 200 : 503).send(response);
    } catch (error) {
      logger.error('Health check failed', { error });
      reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date(),
        error: 'Health check failed',
      });
    }
  });

  // Get AdSense configuration (optional auth)
  fastify.get('/api/ads/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = AD_CONFIG.mock.enabled
        ? getMockAdSenseConfig()
        : getAdSenseConfig();

      if (!config) {
        reply.code(404).send({
          success: false,
          error: 'AdSense not configured',
        });
        return;
      }

      reply.send({
        success: true,
        config,
      });
    } catch (error) {
      logger.error('Failed to get AdSense config', { error });
      reply.code(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  // Request an ad (optional auth)
  fastify.post<{ Body: AdRequestBody }>(
    '/api/ads/request',
    async (request: FastifyRequest<{ Body: AdRequestBody }>, reply: FastifyReply) => {
      try {
        const { page, format, size, sessionId, deviceType } = request.body;

        // Validate required fields
        if (!page || !format || !sessionId) {
          reply.code(400).send({
            success: false,
            error: 'Missing required fields: page, format, sessionId',
          });
          return;
        }

        // Extract user ID from JWT if provided (optional)
        const authHeader = request.headers.authorization;
        let userId: string | undefined;

        if (authHeader) {
          const token = extractToken(authHeader);
          if (token) {
            const payload = verifyToken(token);
            userId = payload?.sub;
          }
        }

        const adRequest: AdRequest = {
          page,
          format,
          size,
          sessionId,
          deviceType: deviceType || 'desktop',
          userId,
        };

        // Extract JWT token if available for credits check
        const token = authHeader ? extractToken(authHeader) : undefined;
        const adResponse = await handleAdRequest(adRequest, userId, token);

        const requestId = (request as any).requestId || '';
        if (adResponse.success) {
          if (adResponse.skipReason) {
            // User skipped ads (premium or has credits)
            reply.send({ 
              success: true, 
              data: null, 
              skipReason: adResponse.skipReason,
              requestId 
            });
          } else {
            // Normal ad response
            reply.send({ success: true, data: adResponse.ad, requestId });
          }
        } else {
          reply.code(500).send({ success: false, error: adResponse.error, requestId });
        }
      } catch (error) {
        logger.error('Failed to request ad', { error });
        const requestId = (request as any).requestId || '';
        reply.code(500).send({ success: false, error: 'Internal server error', requestId });
      }
    }
  );

  // Track ad click (no auth required for better tracking)
  fastify.post<{ Body: ClickTrackingBody }>(
    '/api/ads/click',
    async (request: FastifyRequest<{ Body: ClickTrackingBody }>, reply: FastifyReply) => {
      try {
        const { impressionId, clickUrl } = request.body;

        if (!impressionId || !clickUrl) {
          reply.code(400).send({
            success: false,
            error: 'Missing required fields: impressionId, clickUrl',
          });
          return;
        }

        // Extract user ID from JWT if provided (optional)
        const authHeader = request.headers.authorization;
        let userId: string | undefined;

        if (authHeader) {
          const token = extractToken(authHeader);
          if (token) {
            const payload = verifyToken(token);
            userId = payload?.sub;
          }
        }

        const result = await handleAdClick(
          impressionId,
          clickUrl,
          userId,
          request.body.viewabilityToken,
          request.headers.authorization
        );

        const requestId = (request as any).requestId || '';
        if (result.success) {
          reply.send({ success: true, data: {}, requestId });
        } else {
          reply.code(400).send({ success: false, error: result.error || 'Click failed', requestId });
        }
      } catch (error) {
        logger.error('Failed to track click', { error });
        const requestId = (request as any).requestId || '';
        reply.code(500).send({ success: false, error: 'Internal server error', requestId });
      }
    }
  );

  // Get ad metrics (requires auth)
  fastify.get<{ Querystring: MetricsQuery }>(
    '/api/ads/metrics',
    async (request: FastifyRequest<{ Querystring: MetricsQuery }>, reply: FastifyReply) => {
      try {
        // Verify JWT
        const authHeader = request.headers.authorization;
        const token = extractToken(authHeader);

        if (!token) {
          reply.code(401).send({
            success: false,
            error: 'Missing authorization token',
          });
          return;
        }

        const payload = verifyToken(token);
        if (!payload) {
          reply.code(401).send({
            success: false,
            error: 'Invalid or expired token',
          });
          return;
        }

        const { adUnitId, startDate, endDate } = request.query;

        if (!adUnitId || !startDate || !endDate) {
          reply.code(400).send({
            success: false,
            error: 'Missing required query parameters: adUnitId, startDate, endDate',
          });
          return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          reply.code(400).send({
            success: false,
            error: 'Invalid date format',
          });
          return;
        }

        const metrics = await handleGetMetrics(adUnitId, start, end);

        if (!metrics) {
          reply.code(500).send({
            success: false,
            error: 'Failed to retrieve metrics',
          });
          return;
        }

        reply.send({
          success: true,
          metrics,
        });
      } catch (error) {
        logger.error('Failed to get metrics', { error });
        reply.code(500).send({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  );

  logger.info('Ad service routes registered');
}
