import type { FastifyPluginAsync } from "fastify";
import prisma from "@my-better-t-app/db";
import crypto from "crypto";
import { requireAuthHook } from "../../plugins/authz";

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
      reply.send(organizations);
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
      if (!organization)
        return reply.status(404).send({ error: "Organization not found" });
      reply.send(organization);
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
      reply.send(departments);
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
      if (!department)
        return reply.status(404).send({ error: "Department not found" });
      reply.send(department);
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
      reply.send(providers);
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
      if (!provider)
        return reply.status(404).send({ error: "Provider not found" });
      reply.send(provider);
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
      reply.send(events);
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
          return reply.status(400).send({ error: "eventId is required" });
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
          return reply.status(404).send({ error: "Event not found" });
        }

        if (event.isBooked) {
          return reply.status(400).send({ error: "Event is already booked" });
        }

        // Check if event is in the past
        if (new Date(event.start) < new Date()) {
          return reply
            .status(400)
            .send({ error: "Cannot book events in the past" });
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

          // Format date and time
          const startDate = new Date(event.start);
          const endDate = new Date(event.end);
          const dateStr = startDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const startTime = startDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });
          const endTime = endDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });

          // Send email to client
          console.log("📧 Sending confirmation email to client:", user.email);
          await resend.emails.send({
            from: fromEmail,
            to: user.email,
            subject: `Booking Confirmation - ${event.provider.user.name}`,
            html: `
            <h2>Booking Confirmation</h2>
            <p>Dear ${user.name},</p>
            <p>Your appointment has been successfully booked.</p>
            <h3>Appointment Details:</h3>
            <ul>
              <li><strong>Provider:</strong> ${event.provider.user.name}</li>
              <li><strong>Title:</strong> ${event.title}</li>
              ${
                event.description
                  ? `<li><strong>Description:</strong> ${event.description}</li>`
                  : ""
              }
              <li><strong>Date:</strong> ${dateStr}</li>
              <li><strong>Time:</strong> ${startTime} - ${endTime}</li>
              ${
                event.duration
                  ? `<li><strong>Duration:</strong> ${event.duration} minutes</li>`
                  : ""
              }
              ${
                event.price
                  ? `<li><strong>Price:</strong> $${event.price}</li>`
                  : ""
              }
              <li><strong>Organization:</strong> ${
                event.provider.department.organization.name
              }</li>
              <li><strong>Department:</strong> ${
                event.provider.department.name
              }</li>
            </ul>
            <p>If you need to cancel or reschedule, please contact us.</p>
            <p>Best regards,<br>${
              event.provider.department.organization.name
            }</p>
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
              subject: `New Booking - ${event.title}`,
              html: `
              <h2>New Booking Received</h2>
              <p>Dear ${event.provider.user.name},</p>
              <p>You have a new booking for your availability slot.</p>
              <h3>Booking Details:</h3>
              <ul>
                <li><strong>Client:</strong> ${user.name} (${user.email})</li>
                <li><strong>Title:</strong> ${event.title}</li>
                ${
                  event.description
                    ? `<li><strong>Description:</strong> ${event.description}</li>`
                    : ""
                }
                <li><strong>Date:</strong> ${dateStr}</li>
                <li><strong>Time:</strong> ${startTime} - ${endTime}</li>
                ${
                  event.duration
                    ? `<li><strong>Duration:</strong> ${event.duration} minutes</li>`
                    : ""
                }
              </ul>
              <p>Best regards,<br>Booking System</p>
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

        reply.status(201).send(bookingWithDetails);
      } catch (error) {
        app.log.error(error, "Error creating booking");
        return reply.status(500).send({ error: "Failed to create booking" });
      }
    }
  );
};

export default clientRoutes;
