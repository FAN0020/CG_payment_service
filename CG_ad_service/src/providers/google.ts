/**
 * Google Ads provider adapter
 */

import { randomUUID } from 'crypto';
import type { AdProvider } from './types.js';
import type { AdObject, ProviderContext, ClickContext, ClickResult } from '../types/index.js';
import { GOOGLE_ADS_CONFIG } from '../config/ads.js';
import { logger } from '../lib/logger.js';
import { getAdSenseConfig } from '../lib/google-ads.js';

/**
 * Google Ads Provider
 */
export const googleProvider: AdProvider = {
  name: 'google',
  displayName: 'Google AdSense',
  weight: 100,
  active: GOOGLE_ADS_CONFIG.enabled,

  async requestAd(ctx: ProviderContext): Promise<AdObject> {
    const impressionId = `imp_google_${Date.now()}_${randomUUID().substring(0, 8)}`;
    const config = getAdSenseConfig();

    if (!config) {
      throw new Error('Google AdSense not configured');
    }

    // Generate AdSense HTML snippet
    const adId = config.slotId;
    const content = `
      <ins class="adsbygoogle"
           style="display:inline-block;width:728px;height:90px"
           data-ad-client="${config.clientId}"
           data-ad-slot="${config.slotId}"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      <script>
           (adsbygoogle = window.adsbygoogle || []).push({});
      </script>
    `;

    return {
      id: adId,
      type: 'banner',
      content,
      provider: 'google',
      impressionId,
      rewardType: 'none', // Google Ads don't provide direct rewards
    };
  },

  async onClick(ctx: ClickContext): Promise<ClickResult> {
    // Google Ads clicks are tracked client-side via Google's system
    // We just log the event server-side
    logger.info('Google Ads click', {
      adId: ctx.adId,
      impressionId: ctx.impressionId,
      userId: ctx.userId,
    });

    // Revenue will be fetched later from Google Ads API reports
    return {
      success: true,
      revenue: 0, // Will be updated from revenue sync
    };
  },

  async fetchRevenue(start: Date, end: Date) {
    // In production, this would fetch from Google Ads API
    // For now, return empty array
    logger.info('Fetching Google Ads revenue', { start, end });
    return [];
  },

  async healthCheck(): Promise<boolean> {
    return GOOGLE_ADS_CONFIG.enabled && !!getAdSenseConfig();
  },
};
