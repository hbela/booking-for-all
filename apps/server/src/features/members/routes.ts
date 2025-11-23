import type { FastifyPluginAsync } from 'fastify';
import prisma from '@booking-for-all/db';
import crypto from 'crypto';
import { requireAuthHook } from '../../plugins/authz';
import { AppError } from '../../errors/AppError';

const membersRoutes: FastifyPluginAsync = async (app) => {
  app.post('/join', { preValidation: [requireAuthHook] }, async (req, reply) => {
    try {
      // @ts-expect-error
      const user = req.user;
      const { organizationId } = (req.body as any) || {};

      if (!organizationId) {
        throw new AppError(
          'organizationId is required',
          'VALIDATION_ERROR',
          400
        );
      }

      // Verify organization exists and is enabled
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new AppError('Organization not found', 'ORG_NOT_FOUND', 404);
      }

      if (!organization.enabled) {
        throw new AppError(
          'Organization is not enabled',
          'ORG_NOT_ENABLED',
          403
        );
      }

      // Check if user is already a member
      const existingMember = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: user.id,
          },
        },
      });

      if (existingMember) {
        return reply.send({
          success: true,
          data: {
            message: 'User is already a member of this organization',
            member: existingMember,
          },
        });
      }

      // Create member record
      const member = await prisma.member.create({
        data: {
          id: crypto.randomUUID(),
          organizationId,
          userId: user.id,
          email: user.email,
          createdAt: new Date(),
        },
      });

      reply.code(201).send({
        success: true,
        data: {
          message: 'Successfully joined organization',
          member,
          organization: {
            id: organization.id,
            name: organization.name,
          },
        },
      });
    } catch (error) {
      if (error.isAppError) {
        throw error;
      }
      app.log.error(error, 'Error joining organization');
      throw new AppError(
        'Failed to join organization',
        'JOIN_ORG_FAILED',
        500
      );
    }
  });
};

export default membersRoutes;

