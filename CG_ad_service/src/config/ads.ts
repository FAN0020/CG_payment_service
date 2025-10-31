/**
 * Ad service configuration
 */

const PROVIDER_LIST = (process.env.PROVIDER_LIST || 'google,affiliate,minigame').split(',').map(s => s.trim());

export const AD_CONFIG = {
  credits: {
    onClickEnabled: process.env.CREDITS_ON_CLICK_ENABLED === 'true',
    skipEnabled: process.env.CREDITS_SKIP_ENABLED !== 'false',
    ratio: parseFloat(process.env.AD_CREDIT_RATIO || '1'),
    conversionParam: parseFloat(process.env.AD_CREDIT_CONVERSION_PARAM || '1'),
  },
  providers: {
    list: PROVIDER_LIST,
    strategy: (process.env.PROVIDER_STRATEGY || 'round_robin') as 'round_robin' | 'weighted_random' | 'rules_based',
  },
  featureFlags: {
    dedupe: process.env.ADS_FEATURE_FLAGS?.includes('dedupe') ?? true,
    rateLimit: process.env.ADS_FEATURE_FLAGS?.includes('rate_limit') ?? true,
    minDisplayMs: parseInt(process.env.ADS_MIN_DISPLAY_MS || '0', 10),
  },
  mock: {
    scenario: process.env.MOCK_ADS_SCENARIO || 'success',
  },
};

const MOCK_ADS_MODE = process.env.MOCK_ADS_MODE === 'true';
const GOOGLE_ADS_ENABLED = process.env.GOOGLE_ADS_ENABLED === 'true' && !MOCK_ADS_MODE;

export const GOOGLE_ADS_CONFIG = {
  enabled: GOOGLE_ADS_ENABLED,
  adsense: {
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || process.env.ADSENSE_CLIENT_ID || '',
    slotId: process.env.GOOGLE_ADS_SLOT_ID || process.env.ADSENSE_SLOT_ID || '',
  },
  admob: {
    appId: process.env.ADMOB_APP_ID || '',
    bannerUnitId: process.env.ADMOB_BANNER_UNIT_ID || '',
  },
  mockMode: MOCK_ADS_MODE,
};
