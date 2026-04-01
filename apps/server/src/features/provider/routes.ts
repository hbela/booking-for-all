import type { FastifyPluginAsync } from "fastify";
import prisma from "@booking-for-all/db";
import crypto from "crypto";
import { requireAuthHook, requireProviderHook } from "../../plugins/authz";
import { AppError } from "../../errors/AppError";
import { verifyOrganizationActive } from "../../utils/organization-utils";

// Fallback defaults (used if organization settings are missing)
const DEFAULT_AVAILABILITY_START_HOUR =
  Number.parseInt(process.env.AVAILABILITY_START_HOUR ?? "8", 10) || 8;
const DEFAULT_AVAILABILITY_END_HOUR =
  Number.parseInt(process.env.AVAILABILITY_END_HOUR ?? "20", 10) || 20;
const DEFAULT_TIME_ZONE =
  process.env.AVAILABILITY_TIME_ZONE || "Europe/Budapest";

/**
 * Gets the hour and minute of a date in a specific timezone
 * @param date - The date to convert
 * @param timeZone - IANA timezone identifier (e.g., "Europe/London", "America/New_York")
 * @returns Object with hour (0-23) and minute (0-59)
 */
const getHourMinuteInTimeZone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });

  const parts = formatter.formatToParts(date);
  const hourPart = parts.find((part) => part.type === "hour");
  const minutePart = parts.find((part) => part.type === "minute");

  return {
    hour: Number.parseInt(hourPart?.value ?? "0", 10),
    minute: Number.parseInt(minutePart?.value ?? "0", 10),
  };
};

const providerRoutes: FastifyPluginAsync = async (app) => {
  // ============ EVENT MANAGEMENT ============
  // POST /api/provider/events - Create event
  app.post(
    "/events",
    { preValidation: [requireAuthHook, requireProviderHook] },
    async (req, reply) => {
      const { providerId, title, description, start, end } =
        (req.body as any) || {};
      if (!providerId || !title || !start || !end) {
        throw new AppError(
          "providerId, title, start, and end are required",
          "VALIDATION_ERROR",
          400
        );
      }
      const startDate = new Date(start);
      const endDate = new Date(end);
      const now = new Date();
      if (startDate < now) {
        throw new AppError(
          "Cannot create availability in the past",
          "INVALID_DATE",
          400
        );
      }

      const user = req.user;
      // Fetch provider with organization details to get timezone and business hours
      const provider = await prisma.provider.findUnique({
        where: { id: providerId },
        include: {
          department: {
            include: {
              organization: true,
            },
          },
        },
      });
      if (!provider || provider.userId !== user.id) {
        throw new AppError(
          "Forbidden - Only the provider can create their events",
          "FORBIDDEN",
          403
        );
      }

      // Get organization timezone and business hours (fallback to defaults if not set)
      const organization = provider.department?.organization;
      const timeZone = organization?.timeZone || DEFAULT_TIME_ZONE;
      const availabilityStartHour =
        organization?.availabilityStartHour ?? DEFAULT_AVAILABILITY_START_HOUR;
      const availabilityEndHour =
        organization?.availabilityEndHour ?? DEFAULT_AVAILABILITY_END_HOUR;

      // Validate business hours using organization's timezone
      const { hour: startHour } = getHourMinuteInTimeZone(startDate, timeZone);
      const { hour: endHour, minute: endMinute } = getHourMinuteInTimeZone(
        endDate,
        timeZone
      );

      const startsTooEarly = startHour < availabilityStartHour;
      const startsTooLate = startHour >= availabilityEndHour;
      const endsTooLate =
        endHour > availabilityEndHour ||
        (endHour === availabilityEndHour && endMinute > 0);

      if (startsTooEarly || startsTooLate || endsTooLate) {
        throw new AppError(
          `Availability must be between ${availabilityStartHour}:00 and ${availabilityEndHour}:00 (${timeZone})`,
          "OUTSIDE_BUSINESS_HOURS",
          400
        );
      }

      const durationMinutes = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60)
      );

      // Check if organization activities are frozen
      await verifyOrganizationActive(provider.department.organizationId);

      const event = await prisma.event.create({
        data: {
          id: crypto.randomUUID(),
          providerId,
          organizationId: provider.department.organizationId, // Required after schema migration
          title,
          description,
          start: startDate,
          end: endDate,
          duration: durationMinutes,
          price: null,
        },
        include: {
          provider: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
      reply.code(201).send({
        success: true,
        data: event,
      });
    }
  );

  // PUT /api/provider/events/:id - Update event
  app.put(
    "/events/:id",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const { id } = req.params as any;
      const { title, description } = (req.body as any) || {};

      const user = req.user;

      const event = await prisma.event.findUnique({
        where: { id },
        include: {
          provider: { include: { user: { select: { id: true } } } },
          booking: true,
        },
      });

      if (!event) {
        throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
      }

      // Verify the event belongs to the provider
      if (event.provider.userId !== user.id) {
        throw new AppError(
          "Forbidden - Only the provider can update their events",
          "FORBIDDEN",
          403
        );
      }

      // Check if organization activities are frozen
      await verifyOrganizationActive(event.organizationId);

      // Can't update booked events
      if (event.isBooked) {
        throw new AppError(
          "Cannot update a booked event",
          "EVENT_BOOKED",
          400
        );
      }

      if (!title) {
        throw new AppError("Title is required", "VALIDATION_ERROR", 400);
      }

      const updatedEvent = await prisma.event.update({
        where: { id },
        data: {
          title,
          description: description || null,
        },
        include: {
          provider: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          booking: {
            include: {
              member: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      reply.send({
        success: true,
        data: updatedEvent,
      });
    }
  );

  // DELETE /api/provider/events/:id - Delete event
  app.delete(
    "/events/:id",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const { id } = req.params as any;

      const user = req.user;

      const event = await prisma.event.findUnique({
        where: { id },
        include: {
          provider: { include: { user: { select: { id: true } } } },
          booking: true,
        },
      });

      if (!event) {
        throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
      }

      // Verify the event belongs to the provider
      if (event.provider.userId !== user.id) {
        throw new AppError(
          "Forbidden - Only the provider can delete their events",
          "FORBIDDEN",
          403
        );
      }

      // Check if organization activities are frozen
      await verifyOrganizationActive(event.organizationId);

      // Can't delete booked events
      if (event.isBooked) {
        throw new AppError(
          "Cannot delete a booked event",
          "EVENT_BOOKED",
          400
        );
      }

      await prisma.event.delete({
        where: { id },
      });

      reply.status(204).send();
    }
  );
};

export default providerRoutes;
