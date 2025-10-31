import crypto from 'crypto';
import { AD_CONFIG } from '../config/ads.js';

const dedupeStore = new Map<string, number>();

export function makeFingerprint(ip?: string, ua?: string, sessionId?: string): string {
  const base = `${ip || ''}|${ua || ''}|${sessionId || ''}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}

export function issueViewabilityToken(impressionId: string, issuedAtMs: number = Date.now()): string {
  // lightweight token: impressionId|ts|hmac
  const ts = issuedAtMs.toString();
  const msg = `${impressionId}|${ts}`;
  const hmac = crypto.createHmac('sha256', process.env.JWT_SECRET || 'secret').update(msg).digest('hex');
  return `${impressionId}|${ts}|${hmac}`;
}

export function validateViewabilityToken(token: string): boolean {
  try {
    const [impressionId, ts, mac] = token.split('|');
    const msg = `${impressionId}|${ts}`;
    const expect = crypto.createHmac('sha256', process.env.JWT_SECRET || 'secret').update(msg).digest('hex');
    if (expect !== mac) return false;
    const elapsed = Date.now() - Number(ts);
    return elapsed >= AD_CONFIG.minDisplayMs;
  } catch {
    return false;
  }
}

export function dedupeClickKey(impressionId: string, userId?: string, sessionId?: string): string {
  return `${impressionId}|${userId || ''}|${sessionId || ''}`;
}

export function isDuplicateClick(key: string): boolean {
  const now = Date.now();
  const last = dedupeStore.get(key) || 0;
  const dup = now - last < AD_CONFIG.clickDedupeWindowMs;
  if (!dup) dedupeStore.set(key, now);
  return dup;
}



