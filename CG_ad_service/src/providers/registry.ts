/**
 * Provider registry and selection logic
 */

import type { AdProvider, ProviderSelectionStrategy, ProviderConfig } from './types.js';
import type { ProviderContext } from '../types/index.js';
import { logger } from '../lib/logger.js';
import { AD_CONFIG } from '../config/ads.js';
import { googleProvider } from './google.js';
import { affiliateProvider } from './affiliate.js';
import { minigameProvider } from './minigame.js';

// Provider registry
const providers = new Map<string, AdProvider>();

// Selection state for round-robin
let roundRobinIndex = 0;

/**
 * Initialize provider registry
 */
export function initializeProviders(): void {
  // Register built-in providers
  if (AD_CONFIG.providers.list.includes('google')) {
    providers.set('google', googleProvider);
    logger.info('Registered provider: google');
  }

  if (AD_CONFIG.providers.list.includes('affiliate')) {
    providers.set('affiliate', affiliateProvider);
    logger.info('Registered provider: affiliate');
  }

  if (AD_CONFIG.providers.list.includes('minigame')) {
    providers.set('minigame', minigameProvider);
    logger.info('Registered provider: minigame');
  }

  // Load providers from database if needed
  loadProvidersFromDatabase();

  logger.info('Provider registry initialized', {
    count: providers.size,
    providers: Array.from(providers.keys()),
  });
}

/**
 * Load providers from database
 */
function loadProvidersFromDatabase(): void {
  // This would load custom providers from the database
  // For now, we only use built-in providers
}

/**
 * Get provider by name
 */
export function getProviderByName(name: string): AdProvider | undefined {
  return providers.get(name);
}

/**
 * Get all active providers
 */
export function getActiveProviders(): AdProvider[] {
  return Array.from(providers.values()).filter((p) => p.active);
}

/**
 * Select provider using configured strategy
 */
export function selectProvider(ctx: ProviderContext): AdProvider {
  const activeProviders = getActiveProviders();

  if (activeProviders.length === 0) {
    // Fallback to google if no providers available
    logger.warn('No active providers, falling back to google');
    return googleProvider;
  }

  if (activeProviders.length === 1) {
    return activeProviders[0];
  }

  const strategy: ProviderSelectionStrategy = AD_CONFIG.providers.selectionStrategy;

  switch (strategy) {
    case 'round_robin':
      return selectRoundRobin(activeProviders);

    case 'weighted_random':
      return selectWeightedRandom(activeProviders);

    case 'rules_based':
      return selectRulesBased(activeProviders, ctx);

    default:
      return selectWeightedRandom(activeProviders);
  }
}

/**
 * Round-robin selection
 */
function selectRoundRobin(activeProviders: AdProvider[]): AdProvider {
  const index = roundRobinIndex % activeProviders.length;
  roundRobinIndex++;
  return activeProviders[index];
}

/**
 * Weighted random selection
 */
function selectWeightedRandom(activeProviders: AdProvider[]): AdProvider {
  // Use provider weights directly
  const totalWeight = activeProviders.reduce((sum, p) => {
    return sum + (p.weight || 100);
  }, 0);

  let random = Math.random() * totalWeight;

  for (const provider of activeProviders) {
    const weight = provider.weight || 100;
    random -= weight;
    if (random <= 0) {
      return provider;
    }
  }

  // Fallback to first provider
  return activeProviders[0];
}

/**
 * Rules-based selection (device/page specific)
 */
function selectRulesBased(
  activeProviders: AdProvider[],
  ctx: ProviderContext
): AdProvider {
  // Rule: mobile -> prefer minigame, desktop -> prefer google
  if (ctx.deviceType === 'mobile' || ctx.deviceType === 'tablet') {
    const minigame = activeProviders.find((p) => p.name === 'minigame');
    if (minigame && minigame.active) {
      return minigame;
    }
  }

  // Rule: shopping/page -> prefer affiliate
  if (ctx.page?.includes('shop') || ctx.page?.includes('store')) {
    const affiliate = activeProviders.find((p) => p.name === 'affiliate');
    if (affiliate && affiliate.active) {
      return affiliate;
    }
  }

  // Default: weighted random
  return selectWeightedRandom(activeProviders);
}

/**
 * Register a custom provider (for future extensibility)
 */
export function registerProvider(provider: AdProvider): void {
  providers.set(provider.name, provider);
  logger.info('Registered custom provider', { name: provider.name });
}
