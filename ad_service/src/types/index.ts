export interface AdUnit {
  id: string;
  name: string;
  type: 'banner' | 'video' | 'native' | 'interstitial';
  format: string;
  clientId: string;
  slotId: string;
  size?: {
    width: number;
    height: number;
  };
  status: 'active' | 'paused' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface AdImpression {
  id: string;
  adUnitId: string;
  provider?: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  page: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  userAgent: string;
  ipAddress?: string;
  country?: string;
  revenue?: number;
}

export interface AdClick {
  id: string;
  impressionId: string;
  adUnitId: string;
  provider?: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  clickUrl: string;
  revenue?: number;
}

export interface AdMetrics {
  adUnitId: string;
  impressions: number;
  clicks: number;
  ctr: number; // Click-through rate
  revenue: number;
  rpm: number; // Revenue per 1000 impressions
  period: {
    start: Date;
    end: Date;
  };
}

export interface JWTPayload {
  sub: string; // User ID
  email?: string;
  iss: string; // Issuer
  iat: number; // Issued at
  exp: number; // Expiration
  role?: string;
}

export interface GoogleAdsConfig {
  enabled: boolean;
  clientId: string;
  credentials?: string;
  adsense?: {
    clientId: string;
    slotId: string;
  };
  admob?: {
    appId: string;
    bannerUnitId: string;
  };
}

export interface AdRequest {
  page: string;
  format: 'banner' | 'video' | 'native';
  size?: {
    width: number;
    height: number;
  };
  userId?: string;
  sessionId: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

export interface AdResponse {
  success: boolean;
  ad?: {
    id: string;
    type: string;
    content: string;
    clickUrl?: string;
    impressionId: string;
    provider?: string;
    viewabilityToken?: string;
  };
  skipReason?: 'premium_user' | 'has_credits';
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string } | null;
  requestId: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  services: {
    database: boolean;
    googleAds: boolean;
  };
}
