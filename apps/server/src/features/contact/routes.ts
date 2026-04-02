import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { AppError } from "../../errors/AppError";

const SubscribeRequestSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  ownerName: z.string().min(1, "Owner name is required"),
  ownerEmail: z.string().email("Invalid email address"),
  description: z.string().optional(),
});

const contactRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/subscribe-request",
    { schema: { body: SubscribeRequestSchema } },
    async (req, reply) => {
      const { organizationName, ownerName, ownerEmail } = req.body;
      const lang = req.language || "en";
      const frontendUrl =
        process.env.CORS_ORIGIN ||
        process.env.FRONTEND_URL ||
        "http://localhost:3001";

      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail =
          process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

        await resend.emails.send({
          from: fromEmail,
          to: ownerEmail,
          subject: app.t("emails.subscribeRequest.subject", { lng: lang }),
          html: `
            <p>${app.t("emails.subscribeRequest.greeting", { lng: lang, name: ownerName })}</p>
            <p>${app.t("emails.subscribeRequest.body", { lng: lang, organizationName })}</p>
            <p>${app.t("emails.subscribeRequest.activation", { lng: lang })}</p>
            <ul>
              <li>${app.t("emails.subscribeRequest.pricingMonthly", { lng: lang })}</li>
              <li>${app.t("emails.subscribeRequest.pricingYearly", { lng: lang })}</li>
            </ul>
            <p>
              <a href="${frontendUrl}/subscribe"
                 style="background-color:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:16px;">
                ${app.t("emails.subscribeRequest.cta", { lng: lang })}
              </a>
            </p>
            <p>${app.t("emails.subscribeRequest.regards", { lng: lang })}<br>${app.t("emails.subscribeRequest.team", { lng: lang })}</p>
          `,
        });
      } catch (emailError) {
        app.log.error(emailError, "Failed to send subscribe-request email");
        throw new AppError(
          "Failed to send confirmation email",
          "EMAIL_FAILED",
          500,
        );
      }

      reply.code(200).send({ success: true });
    },
  );
};

export default contactRoutes;
