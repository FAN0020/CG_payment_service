/**
 * IP and User-Agent fingerprinting utilities
 */

import { createHash } from 'crypto';
import type { FastifyRequest } from 'fastify';

/**
 * Extract IP address from request headers
 */
export function extractIpAddress(
  headers: Record<string, string | string[] | undefined>
): string | null {
  // Check X-Forwarded-For (first IP in chain)
  const xForwardedFor = headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    return ips.split(',')[0].trim();
  }

  // Check X-Real-IP
  const xRealIp = headers['x-real-ip'];
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfIp = headers['cf-connecting-ip'];
  if (cfIp) {
    return Array.isArray(cfIp) ? cfIp[0] : cfIp;
  }

  return null;
}

/**
 * Extract User-Agent from request headers
 */
export function extractUserAgent(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const ua = headers['user-agent'];
  if (ua) {
    return Array.isArray(ua) ? ua[0] : ua;
  }
  return null;
}

/**
 * Generate a fingerprint from IP and User-Agent
 * Used for bot detection and abuse prevention
 */
export function generateFingerprint(
  ipAddress: string | null,
  userAgent: string | null
): string {
  const components: string[] = [];

  if (ipAddress) {
    components.push(ipAddress);
  }

  if (userAgent) {
    // Normalize user agent (remove version numbers for better matching)
    const normalized = userAgent
      .replace(/\/[\d.]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    components.push(normalized);
  }

  if (components.length === 0) {
    return 'unknown';
  }

  // Create hash of combined components
  const combined = components.join('|');
  return createHash('sha256').update(combined).digest('hex').substring(0, 16);
}
