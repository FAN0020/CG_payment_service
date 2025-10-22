import { FastifyRequest, FastifyReply } from 'fastify'
import { JWTManager } from './jwt.js'
import { JWTPayload } from '../types/index.js'
import { unauthorizedResponse, validationErrorResponse } from './api-response.js'
import { logger } from './logger.js'

/**
 * Extended request interface with user information
 */
export interface AuthenticatedRequest extends FastifyRequest {
  user: JWTPayload
}

/**
 * JWT authentication middleware
 * Validates bearer token and attaches user info to request
 */
export function createJwtMiddleware(jwtManager: JWTManager) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization
      
      if (!authHeader) {
        logger.warn('Missing authorization header', { 
          requestId: (request as any).requestId,
          path: request.url 
        })
        return reply.code(401).send(unauthorizedResponse('Missing authorization header'))
      }

      if (!authHeader.startsWith('Bearer ')) {
        logger.warn('Invalid authorization header format', { 
          requestId: (request as any).requestId,
          path: request.url 
        })
        return reply.code(401).send(unauthorizedResponse('Invalid authorization header format'))
      }

      const token = authHeader.substring(7) // Remove 'Bearer ' prefix
      
      if (!token) {
        logger.warn('Empty bearer token', { 
          requestId: (request as any).requestId,
          path: request.url 
        })
        return reply.code(401).send(unauthorizedResponse('Empty bearer token'))
      }

      // Verify JWT token
      const payload = jwtManager.verify(token)
      
      // Attach user info to request
      ;(request as AuthenticatedRequest).user = payload
      
      logger.debug('JWT authentication successful', {
        requestId: (request as any).requestId,
        userId: payload.sub,
        path: request.url
      })

    } catch (error: any) {
      logger.warn('JWT authentication failed', {
        requestId: (request as any).requestId,
        error: error.message,
        path: request.url
      })

      if (error.name === 'ValidationError') {
        return reply.code(401).send(validationErrorResponse(error.message))
      }

      return reply.code(401).send(unauthorizedResponse('Invalid or expired token'))
    }
  }
}

/**
 * Access control middleware
 * Ensures user can only access their own resources unless they're admin
 */
export function createAccessControlMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest
    const user = authRequest.user
    
    // Admin users can access everything
    const isAdmin = user.roles?.includes('admin') || user.role === 'admin'
    if (isAdmin) {
      logger.debug('Admin access granted', {
        requestId: (request as any).requestId,
        userId: user.sub,
        path: request.url
      })
      return
    }

    // For non-admin users, check if they're accessing their own resources
    const url = request.url
    const method = request.method

    // Extract user ID from URL parameters or request body
    let targetUserId: string | null = null

    // Check URL parameters for uid or userId
    const urlParams = request.params as any
    if (urlParams.uid) {
      targetUserId = urlParams.uid
    } else if (urlParams.userId) {
      targetUserId = urlParams.userId
    }

    // Check request body for uid
    if (!targetUserId && request.body) {
      const body = request.body as any
      if (body.uid) {
        targetUserId = body.uid
      }
    }

    // If no target user ID found, allow access (might be a general endpoint)
    if (!targetUserId) {
      logger.debug('No target user ID found, allowing access', {
        requestId: (request as any).requestId,
        userId: user.sub,
        path: request.url
      })
      return
    }

    // Check if user is accessing their own resources
    if (targetUserId !== user.sub) {
      logger.warn('Access denied: user trying to access another user\'s resources', {
        requestId: (request as any).requestId,
        userId: user.sub,
        targetUserId,
        path: request.url
      })
      return reply.code(403).send({
        code: 403,
        message: 'Forbidden: You can only access your own resources',
        date: new Date().toISOString(),
        requestId: (request as any).requestId,
        data: {}
      })
    }

    logger.debug('Access control passed', {
      requestId: (request as any).requestId,
      userId: user.sub,
      path: request.url
    })
  }
}

/**
 * Admin-only middleware
 * Restricts access to admin users only
 */
export function createAdminOnlyMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest
    const user = authRequest.user
    
    const isAdmin = user.roles?.includes('admin') || user.role === 'admin'
    if (!isAdmin) {
      logger.warn('Admin access denied', {
        requestId: (request as any).requestId,
        userId: user.sub,
        path: request.url
      })
      return reply.code(403).send({
        code: 403,
        message: 'Forbidden: Admin access required',
        date: new Date().toISOString(),
        requestId: (request as any).requestId,
        data: {}
      })
    }

    logger.debug('Admin access granted', {
      requestId: (request as any).requestId,
      userId: user.sub,
      path: request.url
    })
  }
}
