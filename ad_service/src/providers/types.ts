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

export interface AdObject {
  id: string;
  type: string;
  content: string;
  clickUrl?: string;
  impressionId: string;
  provider?: string;
  viewabilityToken?: string;
}

export interface ClickResult {
  success: boolean;
}

export interface RewardResult {
  success: boolean;
  creditsAwarded?: number;
}

export interface RevenueBatch {
  provider: string;
  date: string; // ISO date
  grossRevenue: number;
  currency?: string;
  sourceRef?: string;
}

export interface AdProvider {
  name: string;
  requestAd(ctx: ProviderContext): Promise<AdObject>;
  onClick(ctx: ClickContext): Promise<ClickResult>;
  onReward?(ctx: ClickContext): Promise<RewardResult>;
  fetchRevenue?(start: Date, end: Date): Promise<RevenueBatch[]>;
}



