import { betterAuthPlugin } from './better-auth.plugin';
import { orgContextPlugin } from './org-context.plugin';
import { validateAuthMethodPlugin } from './validate-auth-method.plugin';
import { googleOAuthPlugin } from './google-oauth.plugin';
import type { FastifyInstance } from 'fastify';

/**
 * Register all auth plugins in correct order
 */
export async function registerAuthPlugins(fastify: FastifyInstance) {
  fastify.log.info('🔐 Registering auth plugins...');
  
  // 1. Better Auth plugin (provides auth instance and session hook)
  await fastify.register(betterAuthPlugin);
  fastify.log.info('🔐 Better Auth plugin registered');

  // 2. Organization context plugin (extracts orgId from various sources)
  await fastify.register(orgContextPlugin);
  fastify.log.info('🔐 Organization context plugin registered');

  // 3. Validate auth method plugin (depends on org-context)
  await fastify.register(validateAuthMethodPlugin);
  fastify.log.info('🔐 Validate auth method plugin registered');

  // 4. Google OAuth plugin (depends on better-auth and org-context)
  await fastify.register(googleOAuthPlugin);
  fastify.log.info('🔐 Google OAuth plugin registered');
  
  fastify.log.info('🔐 All auth plugins registered successfully');
}

