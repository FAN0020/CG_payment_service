import { AD_CONFIG } from '../config/ads.js';
import type { AdProvider, ProviderContext } from './types.js';
import { GoogleProvider } from './vendors/google.js';
import { AffiliateProvider } from './vendors/affiliate.js';
import { MinigameProvider } from './vendors/minigame.js';

const registry: Record<string, AdProvider> = {
  google: new GoogleProvider(),
  affiliate: new AffiliateProvider(),
  minigame: new MinigameProvider(),
};

export function getProviderByName(name: string): AdProvider | undefined {
  return registry[name];
}

let rrIndex = 0;

export function selectProvider(context: ProviderContext): AdProvider {
  const providers = AD_CONFIG.providers.length ? AD_CONFIG.providers : ['google'];
  const weights = AD_CONFIG.providerWeights;
  // Weighted random if weights configured for all active providers
  const allWeighted = providers.every(p => typeof weights[p] === 'number');
  if (allWeighted) {
    const total = providers.reduce((sum, p) => sum + (weights[p] || 0), 0);
    const r = Math.random() * total;
    let acc = 0;
    for (const p of providers) {
      acc += weights[p] || 0;
      if (r <= acc) {
        return registry[p] || registry.google;
      }
    }
    return registry.google;
  }
  // Fallback to round robin
  const pick = providers[rrIndex % providers.length] || 'google';
  rrIndex += 1;
  return registry[pick] || registry.google;
}



