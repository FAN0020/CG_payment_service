import { randomUUID } from 'crypto';
import { recordImpression } from '../lib/database.js';
import { AD_CONFIG } from '../config/ads.js';
import { logger } from '../lib/logger.js';
import type { AdRequest, AdResponse } from '../types/index.js';
import { selectProvider } from '../providers/registry.js';
import { issueViewabilityToken } from '../lib/abuse.js';
import { getCreditsStatus } from '../lib/credits-client.js';

/**
 * Request an ad from Google Ads (or mock)
 * Checks credits/premium status first - skips ads for premium users or users with credits
 */
export async function handleAdRequest(
  request: AdRequest,
  userId?: string,
  jwt?: string
): Promise<AdResponse> {
  try {
    logger.info('Processing ad request', { request, userId });

    // Check credits/premium status if JWT provided
    if (jwt && userId) {
      const creditsStatus = await getCreditsStatus(jwt);
      if (creditsStatus) {
        // Premium users or users with credits can skip ads
        if (creditsStatus.canSkipAds) {
          logger.info('User can skip ads', { userId, isPremium: creditsStatus.isPremium, creditBalance: creditsStatus.creditBalance });
          return {
            success: true,
            ad: undefined,
            skipReason: creditsStatus.isPremium ? 'premium_user' : 'has_credits',
          };
        }
      }
    }

    // User needs to see ads - proceed with ad request
    const provider = selectProvider({
      userId,
      sessionId: request.sessionId,
      page: request.page,
      deviceType: request.deviceType,
    });
    const ad = await provider.requestAd({
      userId,
      sessionId: request.sessionId,
      page: request.page,
      deviceType: request.deviceType,
    });
    const viewabilityToken = issueViewabilityToken(ad.impressionId);
    const enrichedAd = { ...ad, provider: ad.provider || provider.name, impressionId: ad.impressionId, viewabilityToken };

    // Record impression in database
    try {
      await recordImpression({
        id: enrichedAd.impressionId,
        adUnitId: enrichedAd.id,
        provider: enrichedAd.provider,
        userId,
        sessionId: request.sessionId,
        page: request.page,
        deviceType: request.deviceType || 'desktop',
        userAgent: '',
      });
    } catch (error) {
      logger.error('Failed to record impression', { error });
      // Continue even if recording fails
    }

    return { success: true, ad: enrichedAd };
  } catch (error) {
    logger.error('Failed to handle ad request', { error, request });
    return {
      success: false,
      error: 'Internal server error',
    };
  }
}
