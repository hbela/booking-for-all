import type { FastifyPluginAsync } from 'fastify';
import prisma from '@booking-for-all/db';
import { requireAuthHook } from '../../plugins/authz';
import { AppError } from '../../errors/AppError';

const organizationsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true, logo: true },
      orderBy: { name: 'asc' },
    });
    reply.send({
      success: true,
      data: organizations,
    });
  });

  // Public search endpoint for voice agent
  app.get('/search', async (req, reply) => {
    try {
      const { q } = req.query as { q?: string };
      
      if (!q || q.trim().length === 0) {
        return reply.send({
          success: true,
          data: [],
        });
      }

      const searchTerm = q.trim().toLowerCase();
      
      const organizations = await prisma.organization.findMany({
        where: {
          enabled: true,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { slug: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          description: true,
        },
        orderBy: { name: 'asc' },
        take: 20, // Limit results
      });

      reply.send({
        success: true,
        data: organizations,
      });
    } catch (error) {
      app.log.error(error, 'Error searching organizations');
      throw new AppError(
        'Failed to search organizations',
        'SEARCH_ORGS_FAILED',
        500
      );
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
              status: true,
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
      
      reply.send({
        success: true,
        data: organizations,
      });
    } catch (error) {
      app.log.error(error, 'Error fetching user organizations');
      throw new AppError(
        'Failed to fetch organizations',
        'FETCH_ORGS_FAILED',
        500
      );
    }
  });
};

export default organizationsRoutes;


