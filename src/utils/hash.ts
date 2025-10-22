import { createHash } from 'crypto'

/**
 * Generate SHA-256 hash for idempotency keys
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Generate idempotency key based on JWT UID, product ID, and time bucket
 * @param userId - User ID from JWT payload
 * @param productId - Product ID from request
 * @param bucketMinutes - Time bucket size in minutes (default: 1)
 * @returns Deterministic idempotency key
 */
export function generateIdempotencyKey(
  userId: string, 
  productId: string, 
  bucketMinutes: number = 1
): string {
  const bucket = Math.floor(Date.now() / (bucketMinutes * 60 * 1000))
  const keyInput = `${userId}:${productId}:${bucket}`
  return sha256(keyInput)
}

/**
 * Generate idempotency key with custom timestamp (for testing)
 */
export function generateIdempotencyKeyWithTimestamp(
  userId: string, 
  productId: string, 
  timestamp: number,
  bucketMinutes: number = 1
): string {
  const bucket = Math.floor(timestamp / (bucketMinutes * 60 * 1000))
  const keyInput = `${userId}:${productId}:${bucket}`
  return sha256(keyInput)
}
