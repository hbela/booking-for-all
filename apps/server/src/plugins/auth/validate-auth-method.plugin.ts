import fp from 'fastify-plugin';
import { findMembership } from './membership.service';
import prisma from '@booking-for-all/db';
import type { FastifyRequest } from 'fastify';

/**
 * Auth Method Validation Plugin
 * Validates if a user can authenticate with a specific method for an organization
 * Called before actual authentication to provide early feedback
 */
export const validateAuthMethodPlugin = fp(async (fastify) => {
  fastify.post(
    '/org/:orgId/validate-auth-method',
    async (req: FastifyRequest, reply) => {
      const body = req.body as any;
      const { email, method } = body || {};

      // Validate request body
      if (!email || !method) {
        return reply.status(400).send({
          valid: false,
          reason: 'invalid_request',
          message: 'Email and method are required',
        });
      }

      if (method !== 'google') {
        return reply.status(400).send({
          valid: false,
          reason: 'invalid_request',
          message: 'Method must be "google"',
        });
      }

      const orgId = (req as any).orgId;

      if (!orgId) {
        return reply.status(400).send({
          valid: false,
          reason: 'invalid_request',
          message: 'Organization ID is required',
        });
      }

      try {
        // Check if organization exists and is enabled
        const organization = await prisma.organization.findUnique({
          where: { id: orgId },
        });

        if (!organization) {
          return reply.status(404).send({
            valid: false,
            reason: 'org_not_found',
            message: 'Organization not found',
          });
        }

        if (!organization.enabled) {
          return reply.status(403).send({
            valid: false,
            reason: 'org_not_enabled',
            message: 'Organization is not enabled',
          });
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return reply.status(404).send({
            valid: false,
            reason: 'user_not_found',
            message: 'User not found',
          });
        }

        // Check if user has membership in this organization
        const membership = await findMembership(user.id, orgId);

        if (!membership) {
          return reply.status(404).send({
            valid: false,
            reason: 'no_membership',
            message: 'User is not a member of this organization',
          });
        }

        // Check if auth method matches
        if (membership.authMethod !== method) {
          return reply.status(403).send({
            valid: false,
            reason: 'wrong_method',
            requiredMethod: membership.authMethod,
            message: `This account requires authentication with ${membership.authMethod}`,
          });
        }

        // All checks passed
        return reply.status(200).send({
          valid: true,
          canProceed: true,
          message: 'Authentication method is valid',
        });
      } catch (error) {
        fastify.log.error(error, 'Error validating auth method');
        return reply.status(500).send({
          valid: false,
          reason: 'server_error',
          message: 'Failed to validate authentication method',
        });
      }
    }
  );
});

