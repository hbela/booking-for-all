import type { FastifyPluginAsync } from 'fastify';
import prisma from '@my-better-t-app/db';
import { requireAuthHook } from '../../plugins/authz';

const organizationsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    try {
      const organizations = await prisma.organization.findMany({
        select: { id: true, name: true, slug: true, logo: true },
        orderBy: { name: 'asc' },
      });
      reply.send(organizations);
    } catch (error) {
      app.log.error(error, 'Error fetching organizations');
      reply.status(500).send({ error: 'Failed to fetch organizations' });
    }
  });

  app.get('/my-organizations', { preValidation: [requireAuthHook] }, async (req, reply) => {
    try {
      // @ts-expect-error
      const user = req.user;
      
      // Return organizations where the user is a member (for owners, this returns their owned orgs)
      const memberships = await prisma.member.findMany({
        where: { userId: user.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              description: true,
              slug: true,
              logo: true,
              enabled: true,
              createdAt: true,
              _count: {
                select: {
                  departments: true,
                  members: true,
                },
              },
            },
          },
        },
      });
      
      const organizations = memberships
        .map((m) => m.organization)
        .filter(Boolean)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      
      reply.send(organizations);
    } catch (error) {
      app.log.error(error, 'Error fetching user organizations');
      reply.status(500).send({ error: 'Failed to fetch organizations' });
    }
  });
};

export default organizationsRoutes;


