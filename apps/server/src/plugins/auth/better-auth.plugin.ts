import fp from 'fastify-plugin';
import { auth } from '@booking-for-all/auth';
import type { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    auth: typeof auth;
  }

  interface FastifyRequest {
    session?: any;
    user?: any;
  }
}

/**
 * Better Auth Plugin
 * Decorates Fastify with auth instance and session hook.
 * Supports both cookie-based (web) and token-based (mobile) sessions.
 */
export const betterAuthPlugin = fp(async (fastify) => {
  fastify.decorate('auth', auth);

  fastify.addHook('preHandler', async (req: FastifyRequest) => {
    try {
      const session = await auth.api.getSession({
        headers: req.headers as any,
      });

      if (session) {
        req.session = session.session;
        req.user = session.user;
      }
    } catch (error) {
      // Session check failed - not authenticated
      // Don't throw, let routes handle auth requirements
      fastify.log.debug(error, 'Session check failed');
    }
  });
});

