/**
 * Ad service routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleAdRequest } from '../handlers/request-ad.js';
import { handleAdClick } from '../handlers/track-click.js';
import { getCreditsStatus, deductCredits } from '../lib/credits-client.js';
import { extractToken, verifyToken } from '../lib/jwt.js';
import { getDatabase } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { AD_CONFIG } from '../config/ads.js';
import type { AdRequest } from '../types/index.js';
import { createSuccessResponse, createErrorResponse } from '../lib/api-response.js';

/**
 * Register all ad-related routes
 */
export async function registerAdRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check
  fastify.get('/api/ads/health', async (_request, reply) => {
    reply.send({ status: 'ok' });
  });

  // Ad request endpoint
  fastify.post<{ Body: AdRequest }>(
    '/api/ads/request',
    async (request: FastifyRequest<{ Body: AdRequest }>, reply: FastifyReply) => {
      const requestId = request.requestId || 'unknown';
      
      try {
        // Extract and verify JWT
        const authHeader = request.headers.authorization;
        const token = extractToken(authHeader);
        let userId: string | undefined;
        let isPremium = false;
        let creditBalance = 0;
        let canSkipAds = false;

        if (token) {
          const jwtPayload = verifyToken(token);
          if (jwtPayload?.sub) {
            userId = jwtPayload.sub;

            // Check credits status
            const creditsStatus = await getCreditsStatus(token);
            if (creditsStatus) {
              isPremium = creditsStatus.isPremium;
              creditBalance = creditsStatus.creditBalance;
              canSkipAds = creditsStatus.canSkipAds;
            }
          }
        }

        // Check if user should skip ads
        if (isPremium) {
          logger.info('Ad skipped: premium user', { userId, requestId });
          return reply.send(
            createSuccessResponse(
              {
                ad: null,
                skipReason: 'premium_user',
                message: 'Premium users skip ads',
              },
              requestId
            )
          );
        }

        if (canSkipAds && creditBalance > 0 && AD_CONFIG.credits.skipEnabled) {
          // Deduct 1 credit for skipping ad
          if (token) {
            try {
              const deductResult = await deductCredits(token, 1, 'skip_ad');
              if (deductResult.success) {
                logger.info('Ad skipped: credits deducted', {
                  userId,
                  creditsDeducted: deductResult.amountDeducted,
                  newBalance: deductResult.newBalance,
                  requestId,
                });
                return reply.send(
                  createSuccessResponse(
                    {
                      ad: null,
                      skipReason: 'has_credits',
                      message: 'Ad skipped using credits',
                      creditsDeducted: deductResult.amountDeducted,
                      newBalance: deductResult.newBalance,
                    },
                    requestId
                  )
                );
              }
            } catch (error) {
              logger.error('Failed to deduct credits for skip', { error, userId, requestId });
              // Continue to show ad if deduct fails
            }
          }
        }

        // Process ad request
        const result = await handleAdRequest(
          request.body,
          userId,
          request.headers,
          requestId
        );

        if (!result.success) {
          return reply.code(400).send(result);
        }

        return reply.send(result);
      } catch (error) {
        logger.error('Route error in /api/ads/request', { error, requestId });
        return reply
          .code(500)
          .send(createErrorResponse('AD_INTERNAL_ERROR', 'Internal server error', requestId));
      }
    }
  );

  // Ad click endpoint
  fastify.post<{
    Body: {
      impressionId: string;
      clickUrl?: string;
      adId?: string;
      viewabilityToken?: string;
    };
  }>(
    '/api/ads/click',
    async (
      request: FastifyRequest<{
        Body: {
          impressionId: string;
          clickUrl?: string;
          adId?: string;
          viewabilityToken?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const requestId = request.requestId || 'unknown';
      
      try {
        const { impressionId, clickUrl, adId, viewabilityToken } = request.body;

        if (!impressionId) {
          return reply
            .code(400)
            .send(createErrorResponse('AD_INVALID_REQUEST', 'Missing impressionId', requestId));
        }

        // Extract user from JWT if available
        const authHeader = request.headers.authorization;
        const token = extractToken(authHeader);
        let userId: string | undefined;

        if (token) {
          const jwtPayload = verifyToken(token);
          if (jwtPayload?.sub) {
            userId = jwtPayload.sub;
          }
        }

        // Handle click
        const result = await handleAdClick(
          impressionId,
          clickUrl || 'https://example.com',
          userId,
          viewabilityToken,
          authHeader,
          request.headers,
          requestId
        );

        if (!result.success) {
          return reply.code(400).send(result);
        }

        // Return normalized response
        return reply.send(result);
      } catch (error) {
        logger.error('Route error in /api/ads/click', { error, requestId });
        return reply
          .code(500)
          .send(createErrorResponse('AD_INTERNAL_ERROR', 'Internal server error', requestId));
      }
    }
  );

  // Metrics endpoint (requires auth)
  fastify.get('/api/ads/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.requestId || 'unknown';
    
    try {
      const authHeader = request.headers.authorization;
      const token = extractToken(authHeader);

      if (!token) {
        return reply
          .code(401)
          .send(createErrorResponse('AD_UNAUTHORIZED', 'Authentication required', requestId));
      }

      const jwtPayload = verifyToken(token);
      if (!jwtPayload?.sub) {
        return reply
          .code(401)
          .send(createErrorResponse('AD_UNAUTHORIZED', 'Invalid token', requestId));
      }

      const db = getDatabase();
      
      // Get metrics per provider
      const providerMetrics = db
        .prepare(`
          SELECT 
            provider,
            COUNT(DISTINCT i.id) as impressions,
            COUNT(DISTINCT c.id) as clicks,
            COALESCE(SUM(c.revenue), 0) as revenue,
            CASE 
              WHEN COUNT(DISTINCT i.id) > 0 
              THEN ROUND(CAST(COUNT(DISTINCT c.id) AS REAL) / COUNT(DISTINCT i.id) * 100, 2)
              ELSE 0 
            END as ctr
          FROM ad_impressions i
          LEFT JOIN ad_clicks c ON c.impression_id = i.id
          WHERE i.created_at >= datetime('now', '-30 days')
          GROUP BY provider
          ORDER BY impressions DESC
        `)
        .all();

      return reply.send(
        createSuccessResponse(
          {
            providers: providerMetrics,
            period: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
            },
          },
          requestId
        )
      );
    } catch (error) {
      logger.error('Route error in /api/ads/metrics', { error, requestId });
      return reply
        .code(500)
        .send(createErrorResponse('AD_INTERNAL_ERROR', 'Internal server error', requestId));
    }
  });
}
