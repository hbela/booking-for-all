import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../errors/AppError";
import { sendBookingConfirmationEmails } from "../../utils/booking-email-utils";

const testEmailRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/test-email", async (req, reply) => {
    const { to, subject, message } = (req.body as any) || {};
    if (!to || !subject || !message) {
      throw new AppError(
        "Missing required fields: to, subject, message",
        "VALIDATION_ERROR",
        400
      );
    }

    const emailData = {
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: [to],
      subject,
      html: `<p>${message}</p><p><strong>Test sent at:</strong> ${new Date().toISOString()}</p>`,
    } as const;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    });
    const result = (await response.json()) as { id?: string; message?: string };
    if (result.id) {
      return reply.send({
        success: true,
        data: {
          emailId: result.id,
          message: "Test email sent successfully",
          resendDashboard: `https://resend.com/emails/${result.id}`,
        },
      });
    }
    throw new AppError(
      result.message || "Failed to send email",
      "SEND_EMAIL_FAILED",
      400
    );
  });

  app.post("/api/sendmail", async (req, reply) => {
    const body = req.body as any;
    const {
      event,
      client,
      language: bodyLanguage,
    }: {
      event: {
        id: string;
        title: string;
        description: string | null;
        start: Date | string;
        end: Date | string;
        duration: number | null;
        price: number | null;
        provider: {
          user: {
            id: string;
            name: string;
            email: string;
          };
          department: {
            name: string;
            organization: {
              name: string;
            };
          };
        };
      };
      client: {
        id: string;
        name: string;
        email: string;
      };
      language?: string;
    } = body;

    // Language detection priority:
    // 1. body.language (from request body - highest priority)
    // 2. Accept-Language header (from mobile app)
    // 3. Default to "en"
    let language = bodyLanguage;
    if (!language) {
      // Check both lowercase and capitalized header names (HTTP headers are case-insensitive but Node.js preserves case)
      const acceptLanguageRaw =
        req.headers["accept-language"] || req.headers["Accept-Language"];
      // Handle both string and string[] (Fastify headers can be arrays)
      const acceptLanguage = Array.isArray(acceptLanguageRaw)
        ? acceptLanguageRaw[0]
        : acceptLanguageRaw;
      if (acceptLanguage) {
        // Extract first language code from Accept-Language header (e.g., "en-US,en;q=0.9" -> "en")
        language =
          acceptLanguage.split(",")[0]?.split("-")[0]?.toLowerCase() || "en";
      } else {
        language = "en";
      }
    }

    // Validate required fields
    if (!event || !client) {
      throw new AppError(
        "Missing required fields: event and client are required",
        "VALIDATION_ERROR",
        400
      );
    }

    if (!event.id || !event.title || !event.start || !event.end) {
      throw new AppError(
        "Event must have: id, title, start, and end",
        "VALIDATION_ERROR",
        400
      );
    }

    if (!client.id || !client.name || !client.email) {
      throw new AppError(
        "Client must have: id, name, and email",
        "VALIDATION_ERROR",
        400
      );
    }

    if (!event.provider || !event.provider.user || !event.provider.department) {
      throw new AppError(
        "Event must have: provider.user and provider.department",
        "VALIDATION_ERROR",
        400
      );
    }

    try {
      await sendBookingConfirmationEmails(app, { event, client }, language);
      return reply.send({
        success: true,
        message: "Booking confirmation emails sent successfully",
      });
    } catch (error) {
      app.log.error(
        error as Error,
        "Failed to send booking confirmation emails"
      );
      throw new AppError(
        error instanceof Error
          ? error.message
          : "Failed to send booking confirmation emails",
        "SEND_EMAIL_FAILED",
        500
      );
    }
  });
};

export default testEmailRoutes;
