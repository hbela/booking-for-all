import type { FastifyPluginAsync } from 'fastify';
import prisma from '@booking-for-all/db';
import { requireAuthHook } from '../../plugins/authz';
import { AppError } from '../../errors/AppError';
import { sendBookingCancellationEmails } from '../../utils/booking-email-utils';

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

    const event = await prisma.event.findUnique({
      where: { id: data.eventId },
      select: { organizationId: true },
    });

    if (!event) {
      throw new AppError('Event not found', 'NOT_FOUND', 404);
    }

    const { verifyOrganizationActive } = await import('../../utils/organization-utils');
    await verifyOrganizationActive(event.organizationId);
    
    const booking = await prisma.booking.create({ data: { ...data, memberId: user.id } });
    reply.code(201).send({
      success: true,
      data: booking,
    });
  });

  app.delete('/:id', { preValidation: [requireAuthHook] }, async (req, reply) => {
    // @ts-expect-error from auth hook
    const user = req.user;
    const { id } = req.params as { id: string };

    // Fetch booking with full relations
    const booking = await prisma.booking.findUnique({
      where: { id },
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
    });

    if (!booking) {
      throw new AppError('Booking not found', 'NOT_FOUND', 404);
    }

    // Validate booking belongs to the authenticated user
    if (booking.memberId !== user.id) {
      throw new AppError('You do not have permission to cancel this booking', 'FORBIDDEN', 403);
    }

    // Check if booking is already cancelled
    if (booking.status === 'CANCELLED') {
      throw new AppError('Booking is already cancelled', 'VALIDATION_ERROR', 400);
    }

    // Check if event date is in the future
    const eventStart = new Date(booking.event.start);
    const now = new Date();
    if (eventStart < now) {
      throw new AppError('Cannot cancel a past event', 'VALIDATION_ERROR', 400);
    }

    // Update booking status to CANCELLED
    const cancelledBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });

    // Update event isBooked to false
    await prisma.event.update({
      where: { id: booking.eventId },
      data: {
        isBooked: false,
      },
    });

    // Determine language from request
    const acceptLanguage = req.headers['accept-language'] || '';
    const language = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase() || 'en';

    // Send cancellation emails (graceful degradation - don't fail if email fails)
    try {
      await sendBookingCancellationEmails(
        app,
        {
          event: {
            id: booking.event.id,
            title: booking.event.title,
            description: booking.event.description,
            start: booking.event.start,
            end: booking.event.end,
            duration: booking.event.duration,
            price: booking.event.price,
            provider: {
              user: {
                id: booking.event.provider.user.id,
                name: booking.event.provider.user.name,
                email: booking.event.provider.user.email,
              },
              department: {
                name: booking.event.provider.department.name,
                organization: {
                  name: booking.event.provider.department.organization.name,
                },
              },
            },
          },
          client: {
            id: booking.member.id,
            name: booking.member.name,
            email: booking.member.email,
          },
        },
        language,
        new Date()
      );
    } catch (emailError) {
      // Log error but don't fail the cancellation
      app.log.error(emailError, 'Failed to send cancellation emails');
    }

    reply.send({
      success: true,
      data: cancelledBooking,
    });
  });
};

export default bookingsRoutes;


