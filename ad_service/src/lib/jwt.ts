import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types/index.js';
import { logger } from './logger.js';

const JWT_SECRET = process.env.JWT_SECRET || '';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  logger.warn('JWT_SECRET is not set or too short. JWT verification will fail.');
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Validate required fields
    if (!decoded.sub || !decoded.iss || !decoded.iat || !decoded.exp) {
      logger.error('JWT missing required fields');
      return null;
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.error('JWT expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.error('JWT invalid', { error: error.message });
    } else {
      logger.error('JWT verification failed', { error });
    }
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Generate a test JWT token (for development only)
 */
export function generateTestToken(
  userId: string,
  email?: string,
  expiresIn: string = '24h'
): string {
  const payload: JWTPayload = {
    sub: userId,
    email,
    iss: 'classguru-ad-service',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
