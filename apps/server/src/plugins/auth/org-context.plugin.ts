import fp from 'fastify-plugin';
import prisma from '@booking-for-all/db';
import type { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    orgId?: string | null;
  }
}

/**
 * Organization Context Plugin
 * Extracts organizationId from multiple sources:
 * 1. URL params (req.params.orgId)
 * 2. API key metadata (x-api-key header)
 * 3. Explicit header (x-org-id)
 */
export const orgContextPlugin = fp(async (fastify) => {
  fastify.decorateRequest('orgId', null);

  fastify.addHook('preHandler', async (req: FastifyRequest) => {
    // Priority 1: URL parameter
    if ((req.params as any)?.orgId) {
      req.orgId = (req.params as any).orgId;
      return;
    }

    // Priority 2: API key metadata (for mobile apps)
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (apiKey) {
      try {
        const apiKeyRecord = await prisma.apikey.findFirst({
          where: {
            key: apiKey,
            enabled: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        });

        if (apiKeyRecord) {
          let metadata: any;
          try {
            metadata =
              typeof apiKeyRecord.metadata === 'string'
                ? JSON.parse(apiKeyRecord.metadata)
                : apiKeyRecord.metadata;
          } catch {
            metadata = {};
          }

          const organizationId = metadata?.organizationId as string | undefined;
          if (organizationId) {
            req.orgId = organizationId;
            return;
          }
        }
      } catch (error) {
        fastify.log.warn(error, 'Failed to extract orgId from API key');
        // Continue to next priority
      }
    }

    // Priority 3: Explicit header
    if (req.headers['x-org-id']) {
      req.orgId = req.headers['x-org-id'] as string;
      return;
    }
  });
});

