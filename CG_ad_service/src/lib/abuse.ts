/**
 * Anti-abuse controls: rate limiting, click deduplication, viewability tokens
 */

import { createHmac } from 'crypto';
import { AD_CONFIG } from '../config/ads.js';
import { logger } from './logger.js';

// In-memory stores for rate limiting and deduplication
// In production, use Redis or similar for distributed systems
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const dedupeStore = new Map<string, number>();

// Viewability token secret (should be in env, using fallback for now)
const VIEWABILITY_SECRET = process.env.VIEWABILITY_TOKEN_SECRET || 'change-me-in-production';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  max: number;
  windowMs: number;
}

/**
 * Parse rate limit string (e.g., "20/min" -> { max: 20, windowMs: 60000 })
 */
function parseRateLimit(rateLimit: string): RateLimitConfig {
  const parts = rateLimit.split('/');
  if (parts.length !== 2) {
    return { max: 20, windowMs: 60000 }; // Default: 20 per minute
  }

  const max = parseInt(parts[0], 10) || 20;
  const window = parts[1].toLowerCase();

  let windowMs = 60000; // Default to 1 minute
  if (window === 'sec' || window === 's') {
    windowMs = 1000;
  } else if (window === 'min' || window === 'm') {
    windowMs = 60000;
  } else if (window === 'hour' || window === 'h') {
    windowMs = 3600000;
  }

  return { max, windowMs };
}

/**
 * Get rate limit key for a user/IP combination
 */
export function getRateLimitKey(
  userId: string | undefined,
  ipAddress: string | null,
  userAgent: string | null
): string {
  if (userId) {
    return `rate:user:${userId}`;
  }
  // Fallback to IP + UA fingerprint
  const fingerprint = ipAddress || userAgent || 'anonymous';
  return `rate:ip:${fingerprint}`;
}

/**
 * Check if request is within rate limit
 */
export function checkRateLimit(key: string): boolean {
  if (!AD_CONFIG.featureFlags.rateLimit) {
    return true; // Rate limiting disabled
  }

  // Default rate limit config (10 requests per minute)
  const config = { maxRequests: 10, windowMs: 60 * 1000 };
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean expired entries periodically
  if (Math.random() < 0.01) {
    // 1% chance to clean
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    // New or expired entry
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return true;
  }

  if (entry.count >= config.max) {
    logger.warn('Rate limit exceeded', { key, count: entry.count, max: config.max });
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Generate deduplication key for a click
 */
export function dedupeClickKey(
  impressionId: string,
  userId: string | undefined,
  sessionId: string | undefined
): string {
  const identifier = userId || sessionId || 'anonymous';
  return `click:${impressionId}:${identifier}`;
}

/**
 * Check if click is a duplicate
 */
export function isDuplicateClick(key: string): boolean {
  if (!AD_CONFIG.featureFlags.dedupe) {
    return false; // Deduplication disabled
  }

  const windowMs = 60 * 60 * 1000; // 1 hour dedupe window
  const now = Date.now();
  const lastClick = dedupeStore.get(key);

  // Clean expired entries periodically
  if (Math.random() < 0.01) {
    // 1% chance to clean
    for (const [k, timestamp] of dedupeStore.entries()) {
      if (timestamp + windowMs < now) {
        dedupeStore.delete(k);
      }
    }
  }

  if (lastClick && now - lastClick < windowMs) {
    logger.warn('Duplicate click detected', { key, lastClick, now, windowMs });
    return true;
  }

  dedupeStore.set(key, now);
  return false;
}

/**
 * Issue a viewability token for an impression
 * Token includes timestamp and is signed to prevent tampering
 */
export function issueViewabilityToken(impressionId: string): string {
  const timestamp = Date.now();
  const payload = `${impressionId}:${timestamp}`;
  const signature = createHmac('sha256', VIEWABILITY_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}:${signature}`;
}

/**
 * Validate a viewability token and check minimum display time
 */
export function validateViewabilityToken(token: string): boolean {
  if (AD_CONFIG.featureFlags.minDisplayMs <= 0) {
    return true; // Validation disabled
  }

  try {
    const parts = token.split(':');
    if (parts.length < 3) {
      return false;
    }

    const signature = parts.pop()!;
    const timestamp = parseInt(parts[parts.length - 1], 10);
    const payload = parts.join(':');

    // Verify signature
    const expectedSignature = createHmac('sha256', VIEWABILITY_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Invalid viewability token signature', { token });
      return false;
    }

    // Check minimum display time
    const elapsed = Date.now() - timestamp;
    const minDisplayMs = AD_CONFIG.minDisplayMs;

    if (elapsed < minDisplayMs) {
      logger.warn('Viewability time not satisfied', {
        elapsed,
        minDisplayMs,
        token,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to validate viewability token', { error, token });
    return false;
  }
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupAbuseStores(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  const dedupeWindowMs = AD_CONFIG.dedupeWindowMs;
  for (const [key, timestamp] of dedupeStore.entries()) {
    if (timestamp + dedupeWindowMs < now) {
      dedupeStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug('Cleaned up abuse stores', { cleaned });
  }
}

// Periodic cleanup (every 5 minutes)
setInterval(cleanupAbuseStores, 5 * 60 * 1000);
