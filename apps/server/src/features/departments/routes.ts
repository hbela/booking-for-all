import type { FastifyPluginAsync } from 'fastify';
import prisma from '@my-better-t-app/db';
import crypto from 'crypto';
import { requireAuthHook, requireOwnerHook } from '../../plugins/authz';
import { tryEnableOrganization, checkAndDisableOrganization } from '../../utils/organization-utils';

const departmentsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/departments?organizationId=xxx
  app.get('/', { preValidation: [requireAuthHook] }, async (req, reply) => {
    try {
      const { organizationId } = req.query as any;
      
      if (!organizationId) {
        return reply.status(400).send({ error: 'organizationId query parameter is required' });
      }

      // @ts-expect-error
      const user = req.user;
      
      // For owners, allow access even if organization is disabled
      const isOwner = user.role === 'OWNER';
      
      // Build where clause - owners can see disabled orgs, others can't
      const where: any = { organizationId };
      if (!isOwner) {
        where.organization = { enabled: true };
      }
      
      // Verify user has access to this organization
      if (!isOwner) {
        const member = await prisma.member.findUnique({
          where: {
            organizationId_userId: {
              organizationId,
              userId: user.id,
            },
          },
        });
        if (!member) {
          return reply.status(403).send({ error: 'You do not have access to this organization' });
        }
      }

      const departments = await prisma.department.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              providers: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      reply.send(departments);
    } catch (error) {
      app.log.error(error, 'Error fetching departments');
      reply.status(500).send({ error: 'Failed to fetch departments' });
    }
  });

  // POST /api/departments
  app.post('/', { preValidation: [requireAuthHook, requireOwnerHook] }, async (req, reply) => {
    try {
      const { name, description, organizationId } = req.body as any;

      if (!name || !organizationId) {
        return reply.status(400).send({ error: 'Name and organizationId are required' });
      }

      // @ts-expect-error
      const user = req.user;

      // Verify user is owner and member of organization
      const member = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: user.id,
          },
        },
      });

      if (!member) {
        return reply.status(403).send({ error: 'You are not a member of this organization' });
      }

      // Check if organization is enabled (owners can create departments even if disabled)
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      const department = await prisma.department.create({
        data: {
          id: crypto.randomUUID(),
          name,
          description: description || null,
          organizationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Try to enable organization if all conditions are now met
      await tryEnableOrganization(organizationId);

      reply.status(201).send(department);
    } catch (error) {
      app.log.error(error, 'Error creating department');
      reply.status(500).send({ error: 'Failed to create department' });
    }
  });

  // DELETE /api/departments/:id
  app.delete('/:id', { preValidation: [requireAuthHook, requireOwnerHook] }, async (req, reply) => {
    try {
      const { id } = req.params as any;
      
      // @ts-expect-error
      const user = req.user;

      const department = await prisma.department.findUnique({
        where: { id },
        include: {
          organization: true,
        },
      });

      if (!department) {
        return reply.status(404).send({ error: 'Department not found' });
      }

      // Verify user is owner and member of organization
      const member = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId: department.organizationId,
            userId: user.id,
          },
        },
      });

      if (!member) {
        return reply.status(403).send({ error: 'You are not a member of this organization' });
      }

      const organizationId = department.organizationId;

      await prisma.department.delete({
        where: { id },
      });

      // Check if organization should be disabled (no departments or providers left)
      await checkAndDisableOrganization(organizationId);

      reply.send({ success: true });
    } catch (error) {
      app.log.error(error, 'Error deleting department');
      reply.status(500).send({ error: 'Failed to delete department' });
    }
  });
};

export default departmentsRoutes;

