import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import prisma from '@booking-for-all/db';
import crypto from 'crypto';
import { requireAuthHook, requireProviderHook } from '../../plugins/authz';

const eventsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', { preValidation: [requireAuthHook, requireProviderHook] }, async (req, reply) => {
    const { providerId, title, description, start, end } = (req.body as any) || {};
    if (!providerId || !title || !start || !end) {
      return reply.status(400).send({ error: 'providerId, title, start, and end are required' });
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    const now = new Date();
    if (startDate < now) {
      return reply.status(400).send({ error: 'Cannot create availability in the past' });
    }
    const startHour = startDate.getHours();
    const endHour = endDate.getHours();
    if (startHour < 8 || startHour >= 20 || endHour > 20) {
      return reply.status(400).send({ error: 'Availability must be between 8 AM and 8 PM' });
    }
    // @ts-expect-error from auth
    const user = req.user;
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || provider.userId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden - Only the provider can create their events' });
    }
    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    const event = await prisma.event.create({
      data: { id: crypto.randomUUID(), providerId, title, description, start: startDate, end: endDate, duration: durationMinutes, price: null },
      include: { provider: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    reply.code(201).send(event);
  });

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


