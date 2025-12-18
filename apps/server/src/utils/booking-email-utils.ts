import type { FastifyInstance } from "fastify";

interface BookingEmailData {
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
}

/**
 * Sends booking confirmation emails to both client and provider.
 * Uses graceful degradation - booking succeeds even if email fails.
 *
 * @param app - Fastify instance (for translations)
 * @param data - Booking email data including event and client information
 * @param language - Language code for translations (defaults to "en")
 *   Language should be determined by caller with priority:
 *   1. body.language (from request body)
 *   2. Accept-Language header
 *   3. Default to "en"
 */
export async function sendBookingConfirmationEmails(
  app: FastifyInstance,
  data: BookingEmailData,
  language: string = "en"
): Promise<void> {
  // Ensure the requested language is loaded before translating (critical for email accuracy)
  await app.ensureLanguageLoaded(language);
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    // Map language to locale for date formatting
    const localeMap: Record<string, string> = {
      en: "en-US",
      hu: "hu-HU",
      de: "de-DE",
    };
    const locale = localeMap[language] || "en-US";

    // Format date and time
    const startDate = new Date(data.event.start);
    const endDate = new Date(data.event.end);
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
    await resend.emails.send({
      from: fromEmail,
      to: data.client.email,
      subject: app.t("emails.bookingConfirmation.subject", {
        lng: language,
        providerName: data.event.provider.user.name,
      }),
      html: `
        <h2>${app.t("emails.bookingConfirmation.title", { lng: language })}</h2>
        <p>${app.t("emails.bookingConfirmation.dear", { lng: language, clientName: data.client.name })}</p>
        <p>${app.t("emails.bookingConfirmation.appointmentBooked", { lng: language })}</p>
        <h3>${app.t("emails.bookingConfirmation.appointmentDetails", { lng: language })}</h3>
        <ul>
          <li><strong>${app.t("emails.bookingConfirmation.provider", { lng: language })}</strong> ${data.event.provider.user.name}</li>
          <li><strong>${app.t("emails.bookingConfirmation.eventTitle", { lng: language })}</strong> ${data.event.title}</li>
          ${
            data.event.description
              ? `<li><strong>${app.t("emails.bookingConfirmation.description", { lng: language })}</strong> ${data.event.description}</li>`
              : ""
          }
          <li><strong>${app.t("emails.bookingConfirmation.date", { lng: language })}</strong> ${dateStr}</li>
          <li><strong>${app.t("emails.bookingConfirmation.time", { lng: language })}</strong> ${startTime} - ${endTime}</li>
          ${
            data.event.duration
              ? `<li><strong>${app.t("emails.bookingConfirmation.duration", { lng: language })}</strong> ${app.t("emails.bookingConfirmation.minutes", { lng: language, duration: data.event.duration })}</li>`
              : ""
          }
          ${
            data.event.price
              ? `<li><strong>${app.t("emails.bookingConfirmation.price", { lng: language })}</strong> $${data.event.price}</li>`
              : ""
          }
          <li><strong>${app.t("emails.bookingConfirmation.organization", { lng: language })}</strong> ${
            data.event.provider.department.organization.name
          }</li>
          <li><strong>${app.t("emails.bookingConfirmation.department", { lng: language })}</strong> ${
            data.event.provider.department.name
          }</li>
        </ul>
        <p>${app.t("emails.bookingConfirmation.cancelReschedule", { lng: language })}</p>
        <p>${app.t("emails.bookingConfirmation.bestRegards", { lng: language })}<br>${app.t(
          "emails.bookingConfirmation.fromOrganization",
          {
            lng: language,
            organizationName: data.event.provider.department.organization.name,
          }
        )}</p>
      `,
    });
    console.log("✅ Client email sent successfully");

    // Send notification email to provider
    if (data.event.provider.user.email) {
      console.log(
        "📧 Sending notification email to provider:",
        data.event.provider.user.email
      );
      await resend.emails.send({
        from: fromEmail,
        to: data.event.provider.user.email,
        subject: app.t("emails.bookingNotification.subject", {
          lng: language,
          eventTitle: data.event.title,
        }),
        html: `
          <h2>${app.t("emails.bookingNotification.title", { lng: language })}</h2>
          <p>${app.t("emails.bookingNotification.dear", { lng: language, providerName: data.event.provider.user.name })}</p>
          <p>${app.t("emails.bookingNotification.newBooking", { lng: language })}</p>
          <h3>${app.t("emails.bookingNotification.bookingDetails", { lng: language })}</h3>
          <ul>
            <li><strong>${app.t("emails.bookingNotification.client", { lng: language })}</strong> ${data.client.name} (${data.client.email})</li>
            <li><strong>${app.t("emails.bookingNotification.eventTitle", { lng: language })}</strong> ${data.event.title}</li>
            ${
              data.event.description
                ? `<li><strong>${app.t("emails.bookingNotification.description", { lng: language })}</strong> ${data.event.description}</li>`
                : ""
            }
            <li><strong>${app.t("emails.bookingNotification.date", { lng: language })}</strong> ${dateStr}</li>
            <li><strong>${app.t("emails.bookingNotification.time", { lng: language })}</strong> ${startTime} - ${endTime}</li>
            ${
              data.event.duration
                ? `<li><strong>${app.t("emails.bookingNotification.duration", { lng: language })}</strong> ${app.t("emails.bookingNotification.minutes", { lng: language, duration: data.event.duration })}</li>`
                : ""
            }
          </ul>
          <p>${app.t("emails.bookingNotification.bestRegards", { lng: language })}<br>${app.t("emails.bookingNotification.bookingSystem", { lng: language })}</p>
        `,
      });
      console.log("✅ Provider email sent successfully");
    }
  } catch (emailError) {
    console.error("❌ Failed to send booking emails:", emailError);
    // Re-throw to allow caller to handle if needed, or they can catch and ignore
    throw emailError;
  }
}

/**
 * Sends booking cancellation emails to both client and provider.
 * Uses graceful degradation - cancellation succeeds even if email fails.
 *
 * @param app - Fastify instance (for translations)
 * @param data - Booking email data including event and client information
 * @param language - Language code for translations (defaults to "en")
 * @param cancellationDate - Date when the booking was cancelled
 */
export async function sendBookingCancellationEmails(
  app: FastifyInstance,
  data: BookingEmailData,
  language: string = "en",
  cancellationDate: Date = new Date()
): Promise<void> {
  // Ensure the requested language is loaded before translating (critical for email accuracy)
  await app.ensureLanguageLoaded(language);
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    // Map language to locale for date formatting
    const localeMap: Record<string, string> = {
      en: "en-US",
      hu: "hu-HU",
      de: "de-DE",
    };
    const locale = localeMap[language] || "en-US";

    // Format date and time
    const startDate = new Date(data.event.start);
    const endDate = new Date(data.event.end);
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
    const cancellationDateStr = cancellationDate.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const cancellationTimeStr = cancellationDate.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    });

    // Send email to client
    await resend.emails.send({
      from: fromEmail,
      to: data.client.email,
      subject: app.t("emails.bookingCancellation.subject", {
        lng: language,
        eventTitle: data.event.title,
      }),
      html: `
        <h2>${app.t("emails.bookingCancellation.title", { lng: language })}</h2>
        <p>${app.t("emails.bookingCancellation.dear", { lng: language, clientName: data.client.name })}</p>
        <p>${app.t("emails.bookingCancellation.appointmentCancelled", { lng: language })}</p>
        <h3>${app.t("emails.bookingCancellation.appointmentDetails", { lng: language })}</h3>
        <ul>
          <li><strong>${app.t("emails.bookingCancellation.provider", { lng: language })}</strong> ${data.event.provider.user.name}</li>
          <li><strong>${app.t("emails.bookingCancellation.eventTitle", { lng: language })}</strong> ${data.event.title}</li>
          ${
            data.event.description
              ? `<li><strong>${app.t("emails.bookingCancellation.description", { lng: language })}</strong> ${data.event.description}</li>`
              : ""
          }
          <li><strong>${app.t("emails.bookingCancellation.date", { lng: language })}</strong> ${dateStr}</li>
          <li><strong>${app.t("emails.bookingCancellation.time", { lng: language })}</strong> ${startTime} - ${endTime}</li>
          ${
            data.event.duration
              ? `<li><strong>${app.t("emails.bookingCancellation.duration", { lng: language })}</strong> ${app.t("emails.bookingCancellation.minutes", { lng: language, duration: data.event.duration })}</li>`
              : ""
          }
          ${
            data.event.price
              ? `<li><strong>${app.t("emails.bookingCancellation.price", { lng: language })}</strong> $${data.event.price}</li>`
              : ""
          }
          <li><strong>${app.t("emails.bookingCancellation.organization", { lng: language })}</strong> ${
        data.event.provider.department.organization.name
      }</li>
          <li><strong>${app.t("emails.bookingCancellation.department", { lng: language })}</strong> ${
        data.event.provider.department.name
      }</li>
        </ul>
        <p><strong>${app.t("emails.bookingCancellation.cancelledOn", { lng: language })}</strong> ${cancellationDateStr} at ${cancellationTimeStr}</p>
        <p>${app.t("emails.bookingCancellation.bestRegards", { lng: language })}<br>${app.t(
        "emails.bookingCancellation.fromOrganization",
        {
          lng: language,
          organizationName: data.event.provider.department.organization.name,
        }
      )}</p>
      `,
    });
    console.log("✅ Client cancellation email sent successfully");

    // Send notification email to provider
    if (data.event.provider.user.email) {
      console.log(
        "📧 Sending cancellation notification email to provider:",
        data.event.provider.user.email
      );
      await resend.emails.send({
        from: fromEmail,
        to: data.event.provider.user.email,
        subject: app.t("emails.bookingCancellationNotification.subject", {
          lng: language,
          eventTitle: data.event.title,
        }),
        html: `
          <h2>${app.t("emails.bookingCancellationNotification.title", { lng: language })}</h2>
          <p>${app.t("emails.bookingCancellationNotification.dear", { lng: language, providerName: data.event.provider.user.name })}</p>
          <p>${app.t("emails.bookingCancellationNotification.bookingCancelled", { lng: language })}</p>
          <h3>${app.t("emails.bookingCancellationNotification.bookingDetails", { lng: language })}</h3>
          <ul>
            <li><strong>${app.t("emails.bookingCancellationNotification.client", { lng: language })}</strong> ${data.client.name} (${data.client.email})</li>
            <li><strong>${app.t("emails.bookingCancellationNotification.eventTitle", { lng: language })}</strong> ${data.event.title}</li>
            ${
              data.event.description
                ? `<li><strong>${app.t("emails.bookingCancellationNotification.description", { lng: language })}</strong> ${data.event.description}</li>`
                : ""
            }
            <li><strong>${app.t("emails.bookingCancellationNotification.date", { lng: language })}</strong> ${dateStr}</li>
            <li><strong>${app.t("emails.bookingCancellationNotification.time", { lng: language })}</strong> ${startTime} - ${endTime}</li>
            ${
              data.event.duration
                ? `<li><strong>${app.t("emails.bookingCancellationNotification.duration", { lng: language })}</strong> ${app.t("emails.bookingCancellationNotification.minutes", { lng: language, duration: data.event.duration })}</li>`
                : ""
            }
          </ul>
          <p><strong>${app.t("emails.bookingCancellationNotification.cancelledOn", { lng: language })}</strong> ${cancellationDateStr} at ${cancellationTimeStr}</p>
          <p>${app.t("emails.bookingCancellationNotification.bestRegards", { lng: language })}<br>${app.t("emails.bookingCancellationNotification.bookingSystem", { lng: language })}</p>
        `,
      });
      console.log("✅ Provider cancellation email sent successfully");
    }
  } catch (emailError) {
    console.error("❌ Failed to send cancellation emails:", emailError);
    // Re-throw to allow caller to handle if needed, or they can catch and ignore
    throw emailError;
  }
}