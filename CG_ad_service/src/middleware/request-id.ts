/**
 * Request ID middleware - injects unique request ID into each request
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string;
  }
}

/**
 * Register request ID middleware
 */
export function registerRequestId(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if request ID is already present (from gateway/proxy)
    const existingId =
      request.headers['x-request-id'] ||
      request.headers['request-id'] ||
      request.headers['x-correlation-id'];

    request.requestId = existingId
      ? (Array.isArray(existingId) ? existingId[0] : existingId)
      : randomUUID();

    // Add request ID to response headers
    reply.header('X-Request-ID', request.requestId);
  });
}
