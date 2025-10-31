import { logger } from './logger.js';

export interface CreditsStatus {
  userId: string;
  isPremium: boolean;
  creditBalance: number;
  canSkipAds: boolean;
  requestId?: string;
}

export interface CreditsOperationResult {
  success: boolean;
  userId?: string;
  amountDeducted?: number;
  amountRewarded?: number;
  newBalance?: number;
  reason?: string;
  requestId?: string;
  error?: string;
}

const PAYMENT_SERVICE_BASE_URL = process.env.PAYMENT_SERVICE_BASE_URL || process.env.CREDITS_BASE_URL || 'http://localhost:8790';

/**
 * Get user credits status from payment service
 */

export async function getCreditsStatus(jwt: string): Promise<CreditsStatus | null> {
  try {
    const res = await fetch(`${PAYMENT_SERVICE_BASE_URL}/api/credits/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!res.ok) {
      logger.warn('Failed to get credits status', { status: res.status });
      return null;
    }

    const data = await res.json();
    return {
      userId: data.userId,
      isPremium: data.isPremium || false,
      creditBalance: data.creditBalance || 0,
      canSkipAds: data.canSkipAds ?? (data.isPremium || (data.creditBalance || 0) > 0),
      requestId: data.requestId,
    };
  } catch (error) {
    logger.error('Failed to get credits status', { error });
    // Silent fail - if credits service is down, we still serve ads
    return null;
  }
}

/**
 * Reward credits to user account
 */
export async function rewardCredits(jwt: string, amount: number, reason?: string): Promise<CreditsOperationResult> {
  try {
    const res = await fetch(`${PAYMENT_SERVICE_BASE_URL}/api/credits/reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ amount, reason: reason || 'ad_click_reward' }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || 'Failed to reward credits',
        requestId: errorData.requestId,
      };
    }

    const data = await res.json();
    return {
      success: true,
      userId: data.userId,
      amountRewarded: data.amountRewarded || amount,
      newBalance: data.newBalance,
      reason: data.reason,
      requestId: data.requestId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Deduct credits from user account
 */
export async function deductCredits(jwt: string, amount: number, reason?: string): Promise<CreditsOperationResult> {
  try {
    const res = await fetch(`${PAYMENT_SERVICE_BASE_URL}/api/credits/deduct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ amount, reason: reason || 'skip_ad' }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || 'Failed to deduct credits',
        currentBalance: errorData.currentBalance,
        required: errorData.required,
        requestId: errorData.requestId,
      };
    }

    const data = await res.json();
    return {
      success: true,
      userId: data.userId,
      amountDeducted: data.amountDeducted || amount,
      newBalance: data.newBalance,
      reason: data.reason,
      requestId: data.requestId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

