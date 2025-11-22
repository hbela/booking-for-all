import type { FastifyPluginAsync } from 'fastify';
import prisma from '@booking-for-all/db';
import crypto from 'crypto';
import { requireAuthHook, requireProviderHook } from '../../plugins/authz';

const AVAILABILITY_START_HOUR =
  Number.parseInt(process.env.AVAILABILITY_START_HOUR ?? '8', 10) || 8;
const AVAILABILITY_END_HOUR =
  Number.parseInt(process.env.AVAILABILITY_END_HOUR ?? '20', 10) || 20;
const AVAILABILITY_TIME_ZONE =
  process.env.AVAILABILITY_TIME_ZONE || 'Europe/Budapest';

const getHourMinuteInTimeZone = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: AVAILABILITY_TIME_ZONE,
  });

  const parts = formatter.formatToParts(date);
  const hourPart = parts.find((part) => part.type === 'hour');
  const minutePart = parts.find((part) => part.type === 'minute');

  return {
    hour: Number.parseInt(hourPart?.value ?? '0', 10),
    minute: Number.parseInt(minutePart?.value ?? '0', 10),
  };
};

const providerRoutes: FastifyPluginAsync = async (app) => {
  // ============ EVENT MANAGEMENT ============
  // POST /api/provider/events - Create event
  app.post('/events', { preValidation: [requireAuthHook, requireProviderHook] }, async (req, reply) => {
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
    const { hour: startHour, minute: startMinute } = getHourMinuteInTimeZone(startDate);
    const { hour: endHour, minute: endMinute } = getHourMinuteInTimeZone(endDate);

    const startsTooEarly = startHour < AVAILABILITY_START_HOUR;
    const startsTooLate = startHour >= AVAILABILITY_END_HOUR;
    const endsTooLate =
      endHour > AVAILABILITY_END_HOUR || (endHour === AVAILABILITY_END_HOUR && endMinute > 0);

    if (startsTooEarly || startsTooLate || endsTooLate) {
      return reply.status(400).send({
        error: `Availability must be between ${AVAILABILITY_START_HOUR}:00 and ${AVAILABILITY_END_HOUR}:00 (${AVAILABILITY_TIME_ZONE})`,
      });
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

  // PUT /api/provider/events/:id - Update event
  app.put('/events/:id', { preValidation: [requireAuthHook] }, async (req, reply) => {
    const { id } = req.params as any;
    const { title, description } = (req.body as any) || {};
    
    // @ts-expect-error from auth
    const user = req.user;
    
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        provider: { include: { user: { select: { id: true } } } },
        booking: true,
      },
    });

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    // Verify the event belongs to the provider
    if (event.provider.userId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden - Only the provider can update their events' });
    }

    // Can't update booked events
    if (event.isBooked) {
      return reply.status(400).send({ error: 'Cannot update a booked event' });
    }

    if (!title) {
      return reply.status(400).send({ error: 'Title is required' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        title,
        description: description || null,
      },
      include: {
        provider: { include: { user: { select: { id: true, name: true, email: true } } } },
        booking: { include: { member: { select: { id: true, name: true, email: true } } } },
      },
    });

    reply.send(updatedEvent);
  });

  // DELETE /api/provider/events/:id - Delete event
  app.delete('/events/:id', { preValidation: [requireAuthHook] }, async (req, reply) => {
    const { id } = req.params as any;
    
    // @ts-expect-error from auth
    const user = req.user;
    
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        provider: { include: { user: { select: { id: true } } } },
        booking: true,
      },
    });

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    // Verify the event belongs to the provider
    if (event.provider.userId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden - Only the provider can delete their events' });
    }

    // Can't delete booked events
    if (event.isBooked) {
      return reply.status(400).send({ error: 'Cannot delete a booked event' });
    }

    await prisma.event.delete({
      where: { id },
    });

    reply.status(204).send();
  });
};

export default providerRoutes;

