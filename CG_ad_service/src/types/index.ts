/**
 * Core type definitions for Ad Service
 */

export interface JWTPayload {
  sub: string;
  email?: string;
  iss: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

export interface AdRequest {
  sessionId: string;
  page: string;
  format?: 'banner' | 'rectangle' | 'leaderboard' | 'skyscraper';
  size?: { width: number; height: number };
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

export interface AdObject {
  id: string;
  type?: string;
  content?: string;
  clickUrl?: string;
  redirectUrl?: string;
  provider?: string;
  impressionId: string;
  viewabilityToken?: string;
  rewardType?: 'credits' | 'redirect' | 'none';
}

export interface AdResponse {
  success: boolean;
  ad?: AdObject;
  error?: string;
}

export interface ClickResult {
  success: boolean;
  revenue?: number;
  error?: string;
}

export interface RewardResult {
  success: boolean;
  creditsAwarded?: number;
  error?: string;
}

export interface AdMetrics {
  adUnitId: string;
  impressions: number;
  clicks: number;
  ctr: number;
  revenue: number;
  rpm: number;
  period: {
    start: Date;
    end: Date;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  requestId: string;
}

export interface ImpressionRecord {
  id: string;
  adUnitId: string;
  provider: string;
  userId?: string;
  sessionId: string;
  page: string;
  deviceType: string;
  userAgent?: string;
  ipAddress?: string;
  fingerprint?: string;
}

export interface ClickRecord {
  id: string;
  impressionId: string;
  adUnitId: string;
  provider: string;
  userId?: string;
  sessionId: string;
  clickUrl?: string;
  revenue: number;
  creditsAwarded?: number;
}

export interface ProviderContext {
  userId?: string;
  sessionId: string;
  page: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

export interface ClickContext {
  adId: string;
  impressionId: string;
  userId?: string;
  clickUrl?: string;
}

export interface RevenueBatch {
  provider: string;
  date: Date;
  grossRevenue: number;
  currency: string;
  sourceRef?: string;
}