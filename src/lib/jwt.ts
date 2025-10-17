import jwt from 'jsonwebtoken'
import { JWTPayload, JWTPayloadSchema, ValidationError } from '../types/index.js'

export class JWTManager {
  private secret: string

  constructor(secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters')
    }
    this.secret = secret
  }

  /**
   * Decode and validate JWT token
   */
  verify(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as any

      // Validate payload structure
      const result = JWTPayloadSchema.safeParse(decoded)
      if (!result.success) {
        throw new ValidationError(`Invalid JWT payload: ${result.error.message}`)
      }

      return result.data
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error
      }
      if (error.name === 'TokenExpiredError') {
        throw new ValidationError('JWT token has expired')
      }
      if (error.name === 'JsonWebTokenError') {
        throw new ValidationError(`Invalid JWT token: ${error.message}`)
      }
      throw new ValidationError(`JWT verification failed: ${error.message}`)
    }
  }

  /**
   * Sign a new JWT token (for testing or internal use)
   */
  sign(payload: JWTPayload, expiresIn?: string | number): string {
    if (expiresIn) {
      return jwt.sign(payload as any, this.secret, { expiresIn } as jwt.SignOptions)
    }
    return jwt.sign(payload as any, this.secret)
  }

  /**
   * Decode without verification (use with caution)
   */
  decode(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as any
      const result = JWTPayloadSchema.safeParse(decoded)
      return result.success ? result.data : null
    } catch {
      return null
    }
  }
}

