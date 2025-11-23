import type { FastifyPluginAsync } from 'fastify';
import prisma from '@booking-for-all/db';
import { requireAuthHook } from '../../plugins/authz';
import { AppError } from '../../errors/AppError';

const bookingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preValidation: [requireAuthHook] }, async (req, reply) => {
    // @ts-expect-error from auth hook
    const user = req.user;
    const bookings = await prisma.booking.findMany({
      where: { memberId: user.id },
      include: {
        event: {
          include: {
            provider: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                department: {
                  include: {
                    organization: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        member: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    reply.send({
      success: true,
      data: bookings,
    });
  });

  app.post('/', { preValidation: [requireAuthHook] }, async (req, reply) => {
    // Minimal placeholder; extend to match original logic
    const data = (req.body as any) || {};
    // @ts-expect-error from auth hook
    const user = req.user;
    
    if (!data.eventId) {
      throw new AppError('eventId is required', 'VALIDATION_ERROR', 400);
    }
    
    const booking = await prisma.booking.create({ data: { ...data, memberId: user.id } });
    reply.code(201).send({
      success: true,
      data: booking,
    });
  });
};

export default bookingsRoutes;


