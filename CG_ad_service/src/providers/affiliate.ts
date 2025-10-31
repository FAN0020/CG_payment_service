/**
 * Affiliate redirect provider adapter
 */

import { randomUUID } from 'crypto';
import type { AdProvider } from './types.js';
import type { AdObject, ProviderContext, ClickContext, ClickResult, RevenueBatch } from '../types/index.js';
import { AD_CONFIG } from '../config/ads.js';
import { logger } from '../lib/logger.js';

const AFFILIATE_API_KEY = process.env.AFFILIATE_API_KEY || '';
const AFFILIATE_BASE_URL = process.env.AFFILIATE_BASE_URL || 'https://api.affiliate.example.com';

/**
 * Affiliate Provider
 * Handles click-redirect ads (shopping, travel, etc.)
 */
export const affiliateProvider: AdProvider = {
  name: 'affiliate',
  displayName: 'Affiliate Networks',
  weight: 80,
  active: !!AFFILIATE_API_KEY && AFFILIATE_BASE_URL !== 'https://api.affiliate.example.com',

  async requestAd(ctx: ProviderContext): Promise<AdObject> {
    const impressionId = `imp_affiliate_${Date.now()}_${randomUUID().substring(0, 8)}`;

    // In production, this would call the affiliate API to get an offer
    // For now, we generate a mock affiliate redirect
    const mockOffers = [
      {
        title: 'Travel Deal',
        clickUrl: 'https://travel.example.com/deal?affid=CLASSGURU&ref=' + impressionId,
        imageUrl: 'https://via.placeholder.com/300x250?text=Travel+Deal',
      },
      {
        title: 'Shopping Offer',
        clickUrl: 'https://shop.example.com/offer?affid=CLASSGURU&ref=' + impressionId,
        imageUrl: 'https://via.placeholder.com/300x250?text=Shopping+Offer',
      },
    ];

    const offer = mockOffers[Math.floor(Math.random() * mockOffers.length)];

    // Generate HTML for affiliate ad
    const content = `
      <a href="${offer.clickUrl}" target="_blank" rel="noopener noreferrer" 
         data-impression-id="${impressionId}" 
         data-provider="affiliate"
         class="affiliate-ad">
        <img src="${offer.imageUrl}" alt="${offer.title}" 
             style="width: 300px; height: 250px; border: none;" />
        <p style="margin-top: 8px; font-size: 14px; color: #333;">${offer.title}</p>
      </a>
    `;

    return {
      id: `affiliate_${impressionId}`,
      type: 'rectangle',
      content,
      clickUrl: offer.clickUrl,
      redirectUrl: offer.clickUrl,
      provider: 'affiliate',
      impressionId,
      rewardType: 'credits', // Affiliate clicks can reward credits
    };
  },

  async onClick(ctx: ClickContext): Promise<ClickResult> {
    logger.info('Affiliate click', {
      adId: ctx.adId,
      impressionId: ctx.impressionId,
      clickUrl: ctx.clickUrl,
      userId: ctx.userId,
    });

    // In production, this would notify the affiliate network
    // For now, we estimate revenue based on a fixed CPC
    const estimatedCPC = 0.10; // $0.10 per click (example)

    return {
      success: true,
      revenue: estimatedCPC,
    };
  },

  async fetchRevenue?(start: Date, end: Date): Promise<RevenueBatch[]> {
    // In production, this would fetch from affiliate API
    logger.info('Fetching affiliate revenue', { start, end });

    // Mock revenue data
    return [];
  },

  async healthCheck?(): Promise<boolean> {
    // In production, ping the affiliate API
    return this.active;
  },
};
