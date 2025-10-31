export const AD_CONFIG = {
  // Ad display settings
  adsPerPage: parseInt(process.env.ADS_PER_PAGE || '3', 10),
  refreshInterval: parseInt(process.env.AD_REFRESH_INTERVAL || '30000', 10),
  minDisplayTime: parseInt(process.env.MIN_AD_DISPLAY_TIME || '5000', 10),

  // Ad formats
  formats: {
    banner: {
      desktop: { width: 728, height: 90 },
      mobile: { width: 320, height: 50 },
      tablet: { width: 468, height: 60 },
    },
    rectangle: {
      desktop: { width: 300, height: 250 },
      mobile: { width: 300, height: 250 },
      tablet: { width: 300, height: 250 },
    },
    leaderboard: {
      desktop: { width: 970, height: 90 },
      mobile: { width: 320, height: 100 },
      tablet: { width: 728, height: 90 },
    },
    skyscraper: {
      desktop: { width: 160, height: 600 },
      mobile: { width: 120, height: 240 },
      tablet: { width: 160, height: 600 },
    },
  },

  // Rate limiting
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_TIMEWINDOW || '60000', 10),
  },

  // Mock settings
  mock: {
    enabled: process.env.MOCK_ADS_MODE === 'true',
    scenario: process.env.MOCK_ADS_SCENARIO || 'success',
  },

  // Dynamic provider selection
  providers: (process.env.PROVIDER_LIST || 'google').split(',').map(p => p.trim()).filter(Boolean),
  providerWeights: (process.env.PROVIDER_WEIGHTS || '')
    .split(',')
    .map(kv => kv.trim())
    .filter(Boolean)
    .reduce<Record<string, number>>((acc, kv) => {
      const [k, v] = kv.split(':');
      if (k && v && !Number.isNaN(Number(v))) acc[k] = Number(v);
      return acc;
    }, {}),

  // Credits configuration (disabled by default; enable via env)
  creditsOnClickEnabled: (process.env.CREDITS_ON_CLICK_ENABLED || 'false') === 'true',
  creditRatio: parseFloat(process.env.AD_CREDIT_RATIO || '1'),
  creditConversionParam: parseFloat(process.env.CREDIT_CONVERSION_PARAM || '1'),

  // Anti-abuse toggles
  featureFlags: (process.env.ADS_FEATURE_FLAGS || '').split(',').map(f => f.trim()).filter(Boolean),
  minDisplayMs: parseInt(process.env.AD_MIN_DISPLAY_MS || '5000', 10),
  clickRateLimit: process.env.CLICK_RATE_LIMIT || '20/min',
  clickDedupeWindowMs: parseInt(process.env.CLICK_DEDUPE_WINDOW_MS || '5000', 10),
} as const;

export const GOOGLE_ADS_CONFIG = {
  enabled: process.env.GOOGLE_ADS_ENABLED === 'true',
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  adsense: {
    clientId: process.env.ADSENSE_CLIENT_ID || '',
    slotId: process.env.ADSENSE_SLOT_ID || '',
  },
  admob: {
    appId: process.env.ADMOB_APP_ID || '',
    bannerUnitId: process.env.ADMOB_BANNER_UNIT_ID || '',
  },
} as const;

export const AFFILIATE_CONFIG = {
  apiKey: process.env.AFFILIATE_API_KEY || '',
  baseUrl: process.env.AFFILIATE_BASE_URL || '',
} as const;
