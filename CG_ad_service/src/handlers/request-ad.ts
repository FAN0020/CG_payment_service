import { recordImpression, getDatabase } from '../lib/database.js';
import { AD_CONFIG } from '../config/ads.js';
import { logger } from '../lib/logger.js';
import type { AdRequest } from '../types/index.js';
import type { ApiResponse, AdObject } from '../types/index.js';
import { selectProvider } from '../providers/registry.js';
import { issueViewabilityToken } from '../lib/abuse.js';
import { generateFingerprint, extractIpAddress, extractUserAgent } from '../lib/fingerprint.js';
import { createSuccessResponse, createErrorResponse } from '../lib/api-response.js';

/**
 * Request an ad from selected provider
 */
export async function handleAdRequest(
  request: AdRequest,
  userId: string | undefined,
  headers: Record<string, string | string[] | undefined>,
  requestId: string
): Promise<ApiResponse<{ ad: AdObject & { viewabilityToken: string } }>> {
  try {
    logger.info('Processing ad request', { request, userId, requestId });

    // Select provider
    const provider = selectProvider({
      userId,
      sessionId: request.sessionId,
      page: request.page,
      deviceType: request.deviceType,
    });

    // Request ad from provider
    const ad = await provider.requestAd({
      userId,
      sessionId: request.sessionId,
      page: request.page,
      deviceType: request.deviceType,
    });

    // Issue viewability token
    const viewabilityToken = issueViewabilityToken(ad.impressionId);
    const enrichedAd = {
      ...ad,
      provider: ad.provider || provider.name,
      viewabilityToken,
    };

    // Extract fingerprint data
    const ipAddress = extractIpAddress(headers);
    const userAgent = extractUserAgent(headers);
    const fingerprint = generateFingerprint(ipAddress, userAgent);

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
        userAgent: userAgent || undefined,
        ipAddress: ipAddress || undefined,
        fingerprint,
      });
    } catch (error) {
      logger.error('Failed to record impression', { error, requestId });
      // Continue even if recording fails
    }

    logger.info('Ad requested successfully', {
      requestId,
      provider: enrichedAd.provider,
      impressionId: enrichedAd.impressionId,
    });

    return createSuccessResponse({ ad: enrichedAd }, requestId);
  } catch (error) {
    logger.error('Failed to handle ad request', { error, request, requestId });
    return createErrorResponse(
      'AD_INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Internal server error',
      requestId
    );
  }
}
