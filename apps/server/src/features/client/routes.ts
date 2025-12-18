import type { FastifyPluginAsync } from "fastify";
import prisma from "@booking-for-all/db";
import crypto from "crypto";
import { requireAuthHook } from "../../plugins/authz";
import { AppError } from "../../errors/AppError";
import { sendBookingConfirmationEmails } from "../../utils/booking-email-utils";

const clientRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/organizations",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const user = req.user;
      // Return only organizations where the user is a member
      const memberships = await prisma.member.findMany({
        where: { userId: user.id, organization: { enabled: true } },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              description: true,
              _count: { select: { departments: true } },
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
    }
  );

  app.get(
    "/organizations/:id",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const { id } = req.params as any;
      const organization = await prisma.organization.findUnique({
        where: { id, enabled: true },
        select: { id: true, name: true, description: true },
      });
      if (!organization) {
        throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
      }
      reply.send({
        success: true,
        data: organization,
      });
    }
  );

  app.get(
    "/organizations/:id/departments",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const { id } = req.params as any;
      const departments = await prisma.department.findMany({
        where: { organizationId: id, organization: { enabled: true } },
        select: {
          id: true,
          name: true,
          description: true,
          _count: { select: { providers: true } },
        },
        orderBy: { name: "asc" },
      });
      reply.send({
        success: true,
        data: departments,
      });
    }
  );

  app.get(
    "/departments/:id",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const { id } = req.params as any;
      const department = await prisma.department.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          organization: { select: { id: true, name: true } },
        },
      });
      if (!department) {
        throw new AppError("Department not found", "DEPARTMENT_NOT_FOUND", 404);
      }
      reply.send({
        success: true,
        data: department,
      });
    }
  );

  app.get(
    "/departments/:id/providers",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const { id } = req.params as any;
      const providers = await prisma.provider.findMany({
        where: { departmentId: id },
        select: {
          id: true,
          userId: true,
          bio: true,
          specialization: true,
          user: { select: { name: true, email: true } },
          _count: {
            select: {
              events: {
                where: { isBooked: false, start: { gte: new Date() } },
              },
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      });
      reply.send({
        success: true,
        data: providers,
      });
    }
  );

  app.get(
    "/providers/:id",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const { id } = req.params as any;
      const provider = await prisma.provider.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          bio: true,
          specialization: true,
          user: { select: { name: true, email: true } },
        },
      });
      if (!provider) {
        throw new AppError("Provider not found", "PROVIDER_NOT_FOUND", 404);
      }
      reply.send({
        success: true,
        data: provider,
      });
    }
  );

  app.get(
    "/providers/:id/available-events",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const { id } = req.params as any;
      const { date } = (req.query as any) || {};
      let startDate = new Date();
      let endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      if (date && typeof date === "string") {
        startDate = new Date(date + "T00:00:00");
        endDate = new Date(date + "T23:59:59");
      }
      const events = await prisma.event.findMany({
        where: {
          providerId: id,
          isBooked: false,
          start: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          title: true,
          description: true,
          start: true,
          end: true,
          duration: true,
          price: true,
        },
        orderBy: { start: "asc" },
      });
      reply.send({
        success: true,
        data: events,
      });
    }
  );

  app.post(
    "/bookings",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      try {
        const user = req.user;
        const { eventId } = (req.body as any) || {};
        let eventIdForError: string | undefined = eventId; // Store for error handling

        if (!eventId) {
          throw new AppError("eventId is required", "VALIDATION_ERROR", 400);
        }

        // Find the event with all related data
        const event = await prisma.event.findUnique({
          where: { id: eventId },
          include: {
            provider: {
              include: {
                user: { select: { id: true, name: true, email: true } },
                department: {
                  include: {
                    organization: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        });

        if (!event) {
          throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
        }

        // Check if event is in the past
        if (new Date(event.start) < new Date()) {
          throw new AppError(
            "Cannot book events in the past",
            "EVENT_IN_PAST",
            400
          );
        }

        // Check if booking already exists (handles Prisma Accelerate cache issues)
        // This is important because event.isBooked might be stale with caching
        const existingBooking = await prisma.booking.findUnique({
          where: { eventId: event.id },
        });

        if (existingBooking) {
          throw new AppError(
            "Event is already booked",
            "EVENT_ALREADY_BOOKED",
            400
          );
        }

        // Double-check event.isBooked flag (additional safety check)
        if (event.isBooked) {
          throw new AppError(
            "Event is already booked",
            "EVENT_ALREADY_BOOKED",
            400
          );
        }

        // Create booking using transaction to ensure atomicity
        const booking = await prisma.$transaction(async (tx) => {
          // Re-check within transaction to prevent race conditions
          const bookingExists = await tx.booking.findUnique({
            where: { eventId: event.id },
          });

          if (bookingExists) {
            throw new AppError(
              "Event is already booked",
              "EVENT_ALREADY_BOOKED",
              400
            );
          }

          // Create booking
          const newBooking = await tx.booking.create({
            data: {
              id: crypto.randomUUID(),
              eventId: event.id,
              memberId: user.id,
              status: "CONFIRMED",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          // Mark event as booked atomically
          await tx.event.update({
            where: { id: eventId },
            data: { isBooked: true },
          });

          return newBooking;
        });


        // Send confirmation emails (graceful degradation - booking succeeds even if email fails)
        try {
          // Language detection priority for /api/client/bookings:
          // 1. body.language (from request body - highest priority for explicit language preference)
          // 2. Accept-Language header (from mobile app or web app)
          // 3. req.language (from i18n plugin - set from cookie or Accept-Language header)
          // 4. Default to "en"
          const supportedLanguages = ["en", "hu", "de"] as const;
          let lang: "en" | "hu" | "de" | undefined;

          // Priority 1: body.language (explicit language from request body)
          const bodyLanguage = (req.body as any)?.language;
          if (
            bodyLanguage &&
            supportedLanguages.includes(bodyLanguage as any)
          ) {
            lang = bodyLanguage as "en" | "hu" | "de";
          }

          // Priority 2: Accept-Language header
          if (!lang) {
            const acceptLanguageRaw =
              req.headers["accept-language"] || req.headers["Accept-Language"];
            const acceptLanguage = Array.isArray(acceptLanguageRaw)
              ? acceptLanguageRaw[0]
              : acceptLanguageRaw;

            if (acceptLanguage) {
              const extractedLang = acceptLanguage
                .split(",")[0]
                ?.split("-")[0]
                ?.toLowerCase();
              // Validate against supported languages
              if (
                extractedLang &&
                supportedLanguages.includes(extractedLang as any)
              ) {
                lang = extractedLang as "en" | "hu" | "de";
              }
            }
          }

          // Priority 3: req.language (from i18n plugin)
          if (!lang) {
            lang = req.language;
          }

          // Priority 4: Final fallback to "en"
          if (!lang) {
            lang = "en";
          }
          await sendBookingConfirmationEmails(
            app,
            {
              event: {
                id: event.id,
                title: event.title,
                description: event.description,
                start: event.start,
                end: event.end,
                duration: event.duration,
                price: event.price,
                provider: {
                  user: {
                    id: event.provider.user.id,
                    name: event.provider.user.name,
                    email: event.provider.user.email,
                  },
                  department: {
                    name: event.provider.department.name,
                    organization: {
                      name: event.provider.department.organization.name,
                    },
                  },
                },
              },
              client: {
                id: user.id,
                name: user.name,
                email: user.email,
              },
            },
            lang
          );
        } catch (emailError) {
          console.error("❌ Failed to send booking emails:", emailError);
          // Continue - booking is still successful
        }

        // Return booking with full details
        const bookingWithDetails = await prisma.booking.findUnique({
          where: { id: booking.id },
          include: {
            event: {
              include: {
                provider: {
                  include: {
                    user: { select: { id: true, name: true, email: true } },
                    department: {
                      include: {
                        organization: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
            member: { select: { id: true, name: true, email: true } },
          },
        });

        reply.code(201).send({
          success: true,
          data: bookingWithDetails,
        });
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        // Handle Prisma unique constraint errors (P2002)
        // This can happen with Prisma Accelerate caching or race conditions
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2002" &&
          "meta" in error &&
          error.meta &&
          typeof error.meta === "object" &&
          "target" in error.meta &&
          Array.isArray(error.meta.target) &&
          error.meta.target.includes("eventId")
        ) {
          app.log.warn(
            { eventId: eventIdForError, error },
            "Booking creation failed due to unique constraint (event already booked)"
          );
          throw new AppError(
            "Event is already booked",
            "EVENT_ALREADY_BOOKED",
            400
          );
        }

        app.log.error(error as Error, "Error creating booking");
        throw new AppError(
          "Failed to create booking",
          "CREATE_BOOKING_FAILED",
          500
        );
      }
    }
  );
};

export default clientRoutes;
