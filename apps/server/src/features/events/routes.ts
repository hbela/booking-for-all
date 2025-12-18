import type { FastifyPluginAsync } from 'fastify';
import prisma from '@booking-for-all/db';
import { requireAuthHook } from '../../plugins/authz';

const eventsRoutes: FastifyPluginAsync = async (app) => {
  // Note: POST, PUT, DELETE mutations have been moved to /api/provider/events/*

  app.get('/', { preValidation: [requireAuthHook] }, async (req, reply) => {
    const { providerId, departmentId, organizationId, available } = (req.query as any) || {};
    const where: any = {};
    
    // Build base where conditions
    if (providerId) where.providerId = providerId;
    else if (departmentId) where.provider = { departmentId };
    else if (organizationId) where.provider = { department: { organizationId } };
    
    if (available === 'true') {
      where.isBooked = false;
      where.start = { gte: new Date() };
    }
    
    // Exclude events with cancelled bookings - they should not appear in the calendar
    // Only include events that either have no booking OR have a booking that is not cancelled
    // Combine base conditions with booking filter using AND
    const baseConditions = { ...where };
    const finalWhere: any = {
      AND: [
        baseConditions,
        {
          OR: [
            { booking: null }, // Events with no booking
            { booking: { status: { not: 'CANCELLED' } } }, // Events with active (non-cancelled) bookings
          ],
        },
      ],
    };
    
    const events = await prisma.event.findMany({
      where: finalWhere,
      include: {
        provider: {
          include: { user: { select: { id: true, name: true, email: true } }, department: true },
        },
        booking: { 
          where: {
            status: { not: 'CANCELLED' }, // Only include non-cancelled bookings in the relation
          },
          select: {
            id: true,
            status: true,
            updatedAt: true,
            member: { select: { id: true, name: true, email: true } }
          }
        },
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
        booking: { 
          select: {
            id: true,
            status: true,
            updatedAt: true,
            member: { select: { id: true, name: true, email: true } }
          }
        },
      },
    });
    if (!event) return reply.status(404).send({ error: 'Event not found' });
    reply.send(event);
  });

};

export default eventsRoutes;


