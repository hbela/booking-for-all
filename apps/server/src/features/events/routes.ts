import type { FastifyPluginAsync } from 'fastify';
import prisma from '@booking-for-all/db';
import { requireAuthHook } from '../../plugins/authz';

const eventsRoutes: FastifyPluginAsync = async (app) => {
  // Note: POST, PUT, DELETE mutations have been moved to /api/provider/events/*

  app.get('/', { preValidation: [requireAuthHook] }, async (req, reply) => {
    const { providerId, departmentId, organizationId, available } = (req.query as any) || {};
    const where: any = {};
    if (providerId) where.providerId = providerId;
    else if (departmentId) where.provider = { departmentId };
    else if (organizationId) where.provider = { department: { organizationId } };
    if (available === 'true') {
      where.isBooked = false;
      where.start = { gte: new Date() };
    }
    const events = await prisma.event.findMany({
      where,
      include: {
        provider: {
          include: { user: { select: { id: true, name: true, email: true } }, department: true },
        },
        booking: { include: { member: { select: { id: true, name: true, email: true } } } },
      },
      orderBy: { start: 'asc' },
    });
    reply.send(events);
  });

  app.get('/:id', { preValidation: [requireAuthHook] }, async (req, reply) => {
    const { id } = req.params as any;
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        provider: { include: { user: { select: { id: true, name: true, email: true } }, department: { include: { organization: true } } } },
        booking: { include: { member: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!event) return reply.status(404).send({ error: 'Event not found' });
    reply.send(event);
  });

};

export default eventsRoutes;


