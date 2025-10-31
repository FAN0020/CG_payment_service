import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';

export function registerRequestId(app: FastifyInstance) {
  app.addHook('onRequest', async (req, _reply) => {
    (req as any).requestId = req.headers['x-request-id'] || randomUUID();
  });
}



