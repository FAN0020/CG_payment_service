/**
 * Mini-game provider adapter
 */

import { randomUUID } from 'crypto';
import type { AdProvider } from './types.js';
import type { AdObject, ProviderContext, ClickContext, ClickResult, RewardResult, RevenueBatch } from '../types/index.js';
import { logger } from '../lib/logger.js';

/**
 * Mini-game Provider
 * Handles HTML5 playable ads and mini-games
 */
export const minigameProvider: AdProvider = {
  name: 'minigame',
  displayName: 'Mini-Games & Playable Ads',
  weight: 60,
  active: true, // Always available as fallback

  async requestAd(ctx: ProviderContext): Promise<AdObject> {
    const impressionId = `imp_minigame_${Date.now()}_${randomUUID().substring(0, 8)}`;

    // Generate a mini-game ad
    const games = [
      {
        name: 'Quiz Challenge',
        gameUrl: '/games/quiz?ref=' + impressionId,
        imageUrl: 'https://via.placeholder.com/300x250?text=Quiz+Challenge',
      },
      {
        name: 'Word Puzzle',
        gameUrl: '/games/puzzle?ref=' + impressionId,
        imageUrl: 'https://via.placeholder.com/300x250?text=Word+Puzzle',
      },
    ];

    const game = games[Math.floor(Math.random() * games.length)];

    // Generate iframe or embed HTML for mini-game
    const content = `
      <div class="minigame-ad" data-impression-id="${impressionId}" data-provider="minigame">
        <a href="${game.gameUrl}" target="_blank" rel="noopener noreferrer">
          <img src="${game.imageUrl}" alt="${game.name}" 
               style="width: 300px; height: 250px; border: none; cursor: pointer;" />
          <div style="margin-top: 8px; text-align: center;">
            <p style="font-size: 16px; font-weight: bold; color: #333;">${game.name}</p>
            <p style="font-size: 12px; color: #666;">Play and earn credits!</p>
          </div>
        </a>
      </div>
    `;

    return {
      id: `minigame_${impressionId}`,
      type: 'rectangle',
      content,
      clickUrl: game.gameUrl,
      redirectUrl: game.gameUrl,
      provider: 'minigame',
      impressionId,
      rewardType: 'credits', // Mini-games reward credits on completion
    };
  },

  async onClick(ctx: ClickContext): Promise<ClickResult> {
    logger.info('Mini-game click', {
      adId: ctx.adId,
      impressionId: ctx.impressionId,
      clickUrl: ctx.clickUrl,
      userId: ctx.userId,
    });

    // Mini-games typically don't generate direct revenue
    // Revenue comes from engagement/advertiser payments
    return {
      success: true,
      revenue: 0, // Revenue calculated separately
    };
  },

  async onReward?(ctx: ClickContext): Promise<RewardResult> {
    // This is called when a mini-game is completed
    logger.info('Mini-game reward', {
      adId: ctx.adId,
      impressionId: ctx.impressionId,
      userId: ctx.userId,
    });

    // Credits are awarded in the click handler, but this can provide additional rewards
    return {
      success: true,
      creditsAwarded: 0, // Will be set by credits service
    };
  },

  async fetchRevenue?(start: Date, end: Date): Promise<RevenueBatch[]> {
    // Mini-games revenue is typically based on engagement metrics
    logger.info('Fetching mini-game revenue', { start, end });
    return [];
  },

  async healthCheck?(): Promise<boolean> {
    return true; // Always available
  },
};
