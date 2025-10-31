import { requestAd as requestGoogleAd } from '../../lib/google-ads.js';
import { requestMockAd } from '../../lib/mock-google-ads.js';
import { AD_CONFIG } from '../../config/ads.js';
import type { AdProvider, ProviderContext, ClickContext, AdObject, ClickResult } from '../types.js';

export class GoogleProvider implements AdProvider {
  name = 'google';

  async requestAd(ctx: ProviderContext): Promise<AdObject> {
    const res = AD_CONFIG.mock.enabled
      ? await requestMockAd({ page: ctx.page, format: 'banner', size: undefined, sessionId: ctx.sessionId, deviceType: ctx.deviceType })
      : await requestGoogleAd({ page: ctx.page, format: 'banner', size: undefined, sessionId: ctx.sessionId, deviceType: ctx.deviceType });
    if (!res.success || !res.ad) throw new Error('No ad');
    return { ...res.ad, provider: 'google' };
  }

  async onClick(_ctx: ClickContext): Promise<ClickResult> {
    return { success: true };
  }
}



