import type { FastifyPluginAsync } from "fastify";
import prisma from "@booking-for-all/db";
import crypto from "crypto";
import { requireAuthHook } from "../../plugins/authz";
import { AppError } from "../../errors/AppError";

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

        if (event.isBooked) {
          throw new AppError(
            "Event is already booked",
            "EVENT_ALREADY_BOOKED",
            400
          );
        }

        // Check if event is in the past
        if (new Date(event.start) < new Date()) {
          throw new AppError(
            "Cannot book events in the past",
            "EVENT_IN_PAST",
            400
          );
        }

        // Create booking
        const booking = await prisma.booking.create({
          data: {
            id: crypto.randomUUID(),
            eventId: event.id,
            memberId: user.id,
            status: "CONFIRMED",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Mark event as booked
        await prisma.event.update({
          where: { id: eventId },
          data: { isBooked: true },
        });

        // Send confirmation emails (graceful degradation - booking succeeds even if email fails)
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          const fromEmail =
            process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

          // Get language preference (default to "en", can be enhanced with user preference)
          const lang = req.language || "en";
          
          // Map language to locale for date formatting
          const localeMap: Record<string, string> = {
            en: "en-US",
            hu: "hu-HU",
            de: "de-DE",
          };
          const locale = localeMap[lang] || "en-US";

          // Format date and time
          const startDate = new Date(event.start);
          const endDate = new Date(event.end);
          const dateStr = startDate.toLocaleDateString(locale, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const startTime = startDate.toLocaleTimeString(locale, {
            hour: "numeric",
            minute: "2-digit",
          });
          const endTime = endDate.toLocaleTimeString(locale, {
            hour: "numeric",
            minute: "2-digit",
          });

          // Send email to client
          console.log("📧 Sending confirmation email to client:", user.email);
          await resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: app.t("emails.bookingConfirmation.subject", {
              lng: lang,
              providerName: event.provider.user.name,
            }),
            html: `
            <h2>${app.t("emails.bookingConfirmation.title", { lng: lang })}</h2>
            <p>${app.t("emails.bookingConfirmation.dear", { lng: lang, clientName: user.name })}</p>
            <p>${app.t("emails.bookingConfirmation.appointmentBooked", { lng: lang })}</p>
            <h3>${app.t("emails.bookingConfirmation.appointmentDetails", { lng: lang })}</h3>
            <ul>
              <li><strong>${app.t("emails.bookingConfirmation.provider", { lng: lang })}</strong> ${event.provider.user.name}</li>
              <li><strong>${app.t("emails.bookingConfirmation.eventTitle", { lng: lang })}</strong> ${event.title}</li>
              ${
                event.description
                  ? `<li><strong>${app.t("emails.bookingConfirmation.description", { lng: lang })}</strong> ${event.description}</li>`
                  : ""
              }
              <li><strong>${app.t("emails.bookingConfirmation.date", { lng: lang })}</strong> ${dateStr}</li>
              <li><strong>${app.t("emails.bookingConfirmation.time", { lng: lang })}</strong> ${startTime} - ${endTime}</li>
              ${
                event.duration
                  ? `<li><strong>${app.t("emails.bookingConfirmation.duration", { lng: lang })}</strong> ${app.t("emails.bookingConfirmation.minutes", { lng: lang, duration: event.duration })}</li>`
                  : ""
              }
              ${
                event.price
                  ? `<li><strong>${app.t("emails.bookingConfirmation.price", { lng: lang })}</strong> $${event.price}</li>`
                  : ""
              }
              <li><strong>${app.t("emails.bookingConfirmation.organization", { lng: lang })}</strong> ${
                event.provider.department.organization.name
              }</li>
              <li><strong>${app.t("emails.bookingConfirmation.department", { lng: lang })}</strong> ${
                event.provider.department.name
              }</li>
            </ul>
            <p>${app.t("emails.bookingConfirmation.cancelReschedule", { lng: lang })}</p>
            <p>${app.t("emails.bookingConfirmation.bestRegards", { lng: lang })}<br>${app.t("emails.bookingConfirmation.fromOrganization", {
              lng: lang,
              organizationName: event.provider.department.organization.name,
            })}</p>
          `,
          });
          console.log("✅ Client email sent successfully");

          // Send notification email to provider
          if (event.provider.user.email) {
            console.log(
              "📧 Sending notification email to provider:",
              event.provider.user.email
            );
            await resend.emails.send({
              from: fromEmail,
              to: event.provider.user.email,
              subject: app.t("emails.bookingNotification.subject", {
                lng: lang,
                eventTitle: event.title,
              }),
              html: `
              <h2>${app.t("emails.bookingNotification.title", { lng: lang })}</h2>
              <p>${app.t("emails.bookingNotification.dear", { lng: lang, providerName: event.provider.user.name })}</p>
              <p>${app.t("emails.bookingNotification.newBooking", { lng: lang })}</p>
              <h3>${app.t("emails.bookingNotification.bookingDetails", { lng: lang })}</h3>
              <ul>
                <li><strong>${app.t("emails.bookingNotification.client", { lng: lang })}</strong> ${user.name} (${user.email})</li>
                <li><strong>${app.t("emails.bookingNotification.eventTitle", { lng: lang })}</strong> ${event.title}</li>
                ${
                  event.description
                    ? `<li><strong>${app.t("emails.bookingNotification.description", { lng: lang })}</strong> ${event.description}</li>`
                    : ""
                }
                <li><strong>${app.t("emails.bookingNotification.date", { lng: lang })}</strong> ${dateStr}</li>
                <li><strong>${app.t("emails.bookingNotification.time", { lng: lang })}</strong> ${startTime} - ${endTime}</li>
                ${
                  event.duration
                    ? `<li><strong>${app.t("emails.bookingNotification.duration", { lng: lang })}</strong> ${app.t("emails.bookingNotification.minutes", { lng: lang, duration: event.duration })}</li>`
                    : ""
                }
              </ul>
              <p>${app.t("emails.bookingNotification.bestRegards", { lng: lang })}<br>${app.t("emails.bookingNotification.bookingSystem", { lng: lang })}</p>
            `,
            });
            console.log("✅ Provider email sent successfully");
          }
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
        if (error.isAppError) {
          throw error;
        }
        app.log.error(error, "Error creating booking");
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
