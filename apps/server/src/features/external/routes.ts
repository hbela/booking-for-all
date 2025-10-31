import type { FastifyPluginAsync } from 'fastify';
import { validateApiKeyHook } from '../../plugins/authz';

const externalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/validate-session', async (req, reply) => {
    const { sessionToken } = (req.query as any) || {};
    if (!sessionToken) return reply.status(401).send({ error: 'Session token required' });
    reply.send({ valid: true, message: 'Session validation endpoint - implement session checking' });
  });

  app.get('/verify', { preValidation: [validateApiKeyHook] }, async (req, reply) => {
    // @ts-expect-error set in hook
    const organizationId = req.organizationId;
    // @ts-expect-error set in hook
    const organization = req.organization;
    reply.send({
      organizationId,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      redirectUrl: `${process.env.CORS_ORIGIN}/login?org=${organizationId}&referrer=${encodeURIComponent((req.headers.referer as string) || '')}`,
    });
  });
};

export default externalRoutes;


