/**
 * Provider adapter interface definitions
 */

import type { AdObject, ProviderContext, ClickContext, ClickResult, RewardResult, RevenueBatch } from '../types/index.js';

/**
 * Ad Provider Interface
 * All providers must implement this interface
 */
export interface AdProvider {
  /** Provider name identifier */
  name: string;

  /** Display name for UI */
  displayName: string;

  /** Provider weight for selection (0-100) */
  weight: number;

  /** Whether provider is currently active */
  active: boolean;

  /** Request an ad from this provider */
  requestAd(ctx: ProviderContext): Promise<AdObject>;

  /** Handle click event from this provider */
  onClick(ctx: ClickContext): Promise<ClickResult>;

  /** Optional: Handle reward/completion event */
  onReward?(ctx: ClickContext): Promise<RewardResult>;

  /** Optional: Fetch revenue data for sync */
  fetchRevenue?(start: Date, end: Date): Promise<RevenueBatch[]>;

  /** Optional: Health check */
  healthCheck?(): Promise<boolean>;
}

/**
 * Provider selection strategy
 */
export type ProviderSelectionStrategy = 'round_robin' | 'weighted_random' | 'rules_based';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  id: string;
  displayName: string;
  weight: number;
  active: boolean;
  configJson?: Record<string, unknown>;
}
