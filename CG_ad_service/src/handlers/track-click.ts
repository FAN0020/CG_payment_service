import { randomUUID } from 'crypto';
import { recordClick, getDatabase } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import {
  isDuplicateClick,
  dedupeClickKey,
  validateViewabilityToken,
  checkRateLimit,
  getRateLimitKey,
} from '../lib/abuse.js';
import { getProviderByName } from '../providers/registry.js';
import { AD_CONFIG } from '../config/ads.js';
import { rewardCredits } from '../lib/credits-client.js';
import { extractToken, verifyToken } from '../lib/jwt.js';
import type { ApiResponse } from '../types/index.js';
import { createSuccessResponse, createErrorResponse } from '../lib/api-response.js';
import { extractIpAddress, extractUserAgent } from '../lib/fingerprint.js';

/**
 * Track ad click with anti-abuse checks
 */
export async function handleAdClick(
  impressionId: string,
  clickUrl: string,
  userId: string | undefined,
  viewabilityToken: string | undefined,
  authHeader: string | undefined,
  headers: Record<string, string | string[] | undefined>,
  requestId: string
): Promise<ApiResponse<{ clickId: string; creditsAwarded?: number }>> {
  try {
    logger.info('Processing ad click', { impressionId, userId, requestId });

    // Verify impression exists
    const db = getDatabase();
    const impression = db.prepare('SELECT * FROM ad_impressions WHERE id = ?').get(impressionId) as any;

    if (!impression) {
      logger.warn('Impression not found', { impressionId, requestId });
      return createErrorResponse('AD_IMPRESSION_NOT_FOUND', 'Impression not found', requestId);
    }

    // Extract fingerprint data for rate limiting
    const ipAddress = extractIpAddress(headers);
    const userAgent = extractUserAgent(headers);
    const rateLimitKey = getRateLimitKey(userId, ipAddress, userAgent);

    // Rate limiting
    if (AD_CONFIG.featureFlags.rateLimit) {
      if (!checkRateLimit(rateLimitKey)) {
        return createErrorResponse('AD_RATE_LIMITED', 'Too many requests', requestId);
      }
    }

    // Validate viewability token
    if (AD_CONFIG.featureFlags.minDisplayMs > 0) {
      if (!viewabilityToken || !validateViewabilityToken(viewabilityToken)) {
        return createErrorResponse(
          'AD_VIEWABILITY_NOT_SATISFIED',
          'Minimum display time not satisfied',
          requestId
        );
      }
    }

    // Click dedupe
    if (AD_CONFIG.featureFlags.dedupe) {
      const key = dedupeClickKey(impressionId, userId, impression.session_id);
      if (isDuplicateClick(key)) {
        return createErrorResponse('AD_CLICK_DEDUPE', 'Duplicate click detected', requestId);
      }
    }

    // Record click
    const clickId = `click_${randomUUID()}`;
    const provider = impression.provider || 'google';

    await recordClick({
      id: clickId,
      impressionId,
      adUnitId: impression.ad_unit_id,
      provider,
      userId,
      sessionId: impression.session_id,
      clickUrl,
      revenue: 0, // Can be updated later with actual revenue
    });

    logger.info('Ad click recorded', { clickId, impressionId, requestId });

    // Provider onClick hook
    const providerInstance = getProviderByName(provider);
    let clickResult: { success: boolean; revenue?: number } = { success: true, revenue: 0 };
    if (providerInstance) {
      try {
        clickResult = await providerInstance.onClick({
          adId: impression.ad_unit_id,
          impressionId,
          userId,
          clickUrl,
        });

        // Update click record with revenue if provider returned it
        if (clickResult.revenue !== undefined && clickResult.revenue > 0) {
          db.prepare('UPDATE ad_clicks SET revenue = ? WHERE id = ?').run(clickResult.revenue, clickId);
        }
      } catch (error) {
        logger.error('Provider onClick hook failed', { error, provider, requestId });
      }
    }

    // Credits on click (optional)
    let creditsAwarded = 0;
    if (AD_CONFIG.credits.onClickEnabled && userId) {
      const token = extractToken(authHeader);
      const jwtPayload = token ? verifyToken(token) : null;

      if (jwtPayload && jwtPayload.sub && token) {
        // Calculate credits based on config
        const base = AD_CONFIG.credits.ratio * AD_CONFIG.credits.conversionParam;
        const providerMultiplier = provider === 'minigame' ? 1.5 : provider === 'affiliate' ? 1.2 : 1.0;
        const amount = Math.floor(base * providerMultiplier);

        if (amount > 0) {
          try {
            const result = await rewardCredits(token, amount, 'ad_click_reward');
            if (result.success && result.amountRewarded) {
              creditsAwarded = result.amountRewarded;
              
              // Update click record with credits awarded
              db.prepare('UPDATE ad_clicks SET credits_awarded = ? WHERE id = ?').run(creditsAwarded, clickId);
              
              logger.info('Credits awarded', {
                clickId,
                userId,
                amount: creditsAwarded,
                requestId,
              });
            }
          } catch (error) {
            logger.error('Failed to reward credits', { error, clickId, requestId });
            // Don't fail the click if credits fail
          }
        }
      }
    }

    return createSuccessResponse(
      {
        clickId,
        creditsAwarded: creditsAwarded > 0 ? creditsAwarded : undefined,
      },
      requestId
    );
  } catch (error) {
    logger.error('Failed to handle ad click', { error, impressionId, requestId });
    return createErrorResponse(
      'AD_INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Internal server error',
      requestId
    );
  }
}
