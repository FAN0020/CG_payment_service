import { randomUUID } from 'crypto';
import type { AdProvider, ProviderContext, ClickContext, AdObject, ClickResult } from '../types.js';
import { AFFILIATE_CONFIG } from '../../config/ads.js';

export class AffiliateProvider implements AdProvider {
  name = 'affiliate';

  async requestAd(ctx: ProviderContext): Promise<AdObject> {
    // For now, create a simple redirect ad using configured base URL
    const id = randomUUID();
    const impressionId = randomUUID();
    const clickUrl = `${AFFILIATE_CONFIG.baseUrl || 'https://example.com/offer'}?affid=${encodeURIComponent(AFFILIATE_CONFIG.apiKey)}&sid=${encodeURIComponent(ctx.sessionId)}&pid=${encodeURIComponent(id)}`;
    return {
      id,
      type: 'redirect',
      content: 'Affiliate Offer',
      clickUrl,
      impressionId,
      provider: 'affiliate',
    };
  }

  async onClick(_ctx: ClickContext): Promise<ClickResult> {
    return { success: true };
  }
}



