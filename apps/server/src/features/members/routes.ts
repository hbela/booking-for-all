import type { FastifyPluginAsync } from 'fastify';
import prisma from '@my-better-t-app/db';
import crypto from 'crypto';
import { requireAuthHook } from '../../plugins/authz';

const membersRoutes: FastifyPluginAsync = async (app) => {
  app.post('/join', { preValidation: [requireAuthHook] }, async (req, reply) => {
    try {
      // @ts-expect-error
      const user = req.user;
      const { organizationId } = (req.body as any) || {};

      if (!organizationId) {
        return reply.status(400).send({ error: 'organizationId is required' });
      }

      // Verify organization exists and is enabled
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      if (!organization.enabled) {
        return reply.status(403).send({ error: 'Organization is not enabled' });
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
        return reply.status(200).send({
          message: 'User is already a member of this organization',
          member: existingMember,
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

      reply.status(201).send({
        message: 'Successfully joined organization',
        member,
        organization: {
          id: organization.id,
          name: organization.name,
        },
      });
    } catch (error) {
      app.log.error(error, 'Error joining organization');
      return reply.status(500).send({ error: 'Failed to join organization' });
    }
  });
};

export default membersRoutes;

