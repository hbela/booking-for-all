import type { FastifyPluginAsync } from 'fastify';
import prisma from '@my-better-t-app/db';
import { requireAuthHook, requireOwnerHook, requireProviderHook } from '../../plugins/authz';

const providersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preValidation: [requireAuthHook] }, async (req, reply) => {
    const { userId, organizationId, departmentId } = req.query as any;
    
    // Build where clause based on filters
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (organizationId) {
      // @ts-expect-error
      const user = req.user;
      // For owners, allow access to disabled organizations
      const isOwner = user.role === 'OWNER';
      if (isOwner) {
        where.department = { organizationId };
      } else {
        where.department = { organizationId, organization: { enabled: true } };
      }
    }
    
    const providers = await prisma.provider.findMany({
      where,
      include: {
        department: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    reply.send(providers);
  });

  app.get('/:id', { preValidation: [requireAuthHook] }, async (req, reply) => {
    const { id } = req.params as any;
    const provider = await prisma.provider.findUnique({
      where: { id },
      include: {
        department: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    if (!provider) return reply.status(404).send({ error: 'Provider not found' });
    reply.send(provider);
  });

  app.post('/', { preValidation: [requireAuthHook, requireOwnerHook] }, async (req, reply) => {
    const data = (req.body as any) || {};
    const provider = await prisma.provider.create({ data });
    reply.code(201).send(provider);
  });
};

export default providersRoutes;


