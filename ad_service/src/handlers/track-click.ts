import { randomUUID } from 'crypto';
import { recordClick, getDatabase } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { isDuplicateClick, dedupeClickKey, validateViewabilityToken } from '../lib/abuse.js';
import { getProviderByName } from '../providers/registry.js';
import { AD_CONFIG } from '../config/ads.js';
import { rewardCredits } from '../lib/credits-client.js';
import { extractToken, verifyToken } from '../lib/jwt.js';

/**
 * Track ad click
 */
export async function handleAdClick(
  impressionId: string,
  clickUrl: string,
  userId?: string,
  viewabilityToken?: string,
  authHeader?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Processing ad click', { impressionId, userId });

    // Verify impression exists
    const db = getDatabase();
    const impression = await db.get(
      'SELECT * FROM ad_impressions WHERE id = ?',
      [impressionId]
    );

    if (!impression) {
      logger.warn('Impression not found', { impressionId });
      return {
        success: false,
        error: 'Impression not found',
      };
    }

    // Validate viewability token
    if (AD_CONFIG.featureFlags.includes('min_display_ms')) {
      if (!viewabilityToken || !validateViewabilityToken(viewabilityToken)) {
        return { success: false, error: 'Viewability not satisfied' };
      }
    }

    // Click dedupe
    if (AD_CONFIG.featureFlags.includes('dedupe')) {
      const key = dedupeClickKey(impressionId, userId, impression.session_id);
      if (isDuplicateClick(key)) {
        return { success: false, error: 'Duplicate click' };
      }
    }

    // Record click
    const clickId = randomUUID();
    await recordClick({
      id: clickId,
      impressionId,
      adUnitId: impression.ad_unit_id,
      provider: impression.provider || 'google',
      userId,
      sessionId: impression.session_id,
      clickUrl,
      revenue: 0, // Can be updated later with actual revenue
    });

    logger.info('Ad click recorded', { clickId, impressionId });

    // Provider onClick hook
    const provider = getProviderByName(impression.provider || 'google');
    if (provider) {
      await provider.onClick({ adId: impression.ad_unit_id, impressionId, userId, clickUrl });
    }

    // Credits on click (optional)
    if (AD_CONFIG.creditsOnClickEnabled) {
      const token = extractToken(authHeader);
      const jwtPayload = token ? verifyToken(token) : null;
      if (jwtPayload && jwtPayload.sub && token) {
        const base = AD_CONFIG.creditRatio * AD_CONFIG.creditConversionParam;
        const amount = Math.floor(base);
        if (amount > 0) {
          const result = await rewardCredits(token, amount, 'ad_click_reward');
          if (result.success) {
            logger.info('Credits rewarded', { 
              userId: result.userId, 
              amount: result.amountRewarded,
              newBalance: result.newBalance 
            });
          } else {
            logger.warn('Failed to reward credits', { error: result.error });
          }
        }
      }
    }

    return { success: true };
  } catch (error) {
    logger.error('Failed to handle ad click', { error, impressionId });
    return {
      success: false,
      error: 'Internal server error',
    };
  }
}
