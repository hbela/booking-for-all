import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import cors from "@fastify/cors";
import healthRoutes from "./features/health/routes";
import organizationsRoutes from "./features/organizations/routes";
import adminRoutes from "./features/admin/routes";
import providersRoutes from "./features/providers/routes";
import bookingsRoutes from "./features/bookings/routes";
import eventsRoutes from "./features/events/routes";
import clientRoutes from "./features/client/routes";
import externalRoutes from "./features/external/routes";
import membersRoutes from "./features/members/routes";
import debugRoutes from "./features/debug/routes";
import testEmailRoutes from "./features/testEmail/routes";
import rawBody from "fastify-raw-body";
import polarWebhook from "./features/webhooks/polar";
import sentryTunnel from "./features/webhooks/sentry-tunnel";
import { auth } from "@booking-for-all/auth";
import { toNodeHandler } from "better-auth/node";
import subscriptionsRoutes from "./features/subscriptions/routes";
import departmentsRoutes from "./features/departments/routes";
import authRoutes from "./features/auth/routes";
import { instrument } from "./instrument";
import * as Sentry from "@sentry/node";

export function buildApp() {
  instrument();
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : { target: "pino-pretty", options: { colorize: true } },
    },
  });

  Sentry.setupFastifyErrorHandler(app);

  // Configure Zod type provider
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, {
    origin: true,
    credentials: true,
  });
  // Register rawBody plugin globally but only process routes with rawBody: true
  app.register(rawBody, { 
    field: "rawBody", 
    global: false, // Only process routes with config: { rawBody: true }
    runFirst: true, // Run before other body parsers
  });

  app.register(healthRoutes, { prefix: "/health" });
  
  // Sentry tunnel endpoint to bypass ad blockers
  // Register as a plugin (like polar webhook) to ensure rawBody plugin works correctly
  app.register(sentryTunnel, { prefix: "/api" });
  // Global onRequest to forward /api/auth/* before body parsing
  // Exclude custom auth routes that we handle ourselves
  const customAuthRoutes = [
    "/api/auth/update-password",
    "/api/auth/check-password-change",
  ];
  const authHandler = toNodeHandler(auth);
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/auth")) return;
    // Skip Better Auth handler for custom routes
    if (customAuthRoutes.some((route) => request.url.startsWith(route))) return;
    if (request.method === "OPTIONS") return; // CORS plugin handles preflight

    const origin = (request.headers.origin as string) || "*";
    reply.raw.setHeader("Access-Control-Allow-Origin", origin);
    reply.raw.setHeader("Vary", "Origin");
    reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
    reply.raw.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    reply.raw.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );

    reply.hijack();
    try {
      void authHandler(request.raw, reply.raw);
      return;
    } catch (err) {
      app.log.error(err);
      if (!reply.raw.headersSent) {
        reply.raw.statusCode = 500;
        reply.raw.end(JSON.stringify({ error: "Auth handler error" }));
      }
    }
  });
  app.register(organizationsRoutes, { prefix: "/api/organizations" });
  app.register(adminRoutes, { prefix: "/api/admin" });
  app.register(providersRoutes, { prefix: "/api/providers" });
  app.register(departmentsRoutes, { prefix: "/api/departments" });
  app.register(bookingsRoutes, { prefix: "/api/bookings" });
  app.register(eventsRoutes, { prefix: "/api/events" });
  app.register(clientRoutes, { prefix: "/api/client" });
  app.register(externalRoutes, { prefix: "/api/external" });
  app.register(membersRoutes, { prefix: "/api/members" });
  app.register(debugRoutes, { prefix: "/debug" });
  app.register(testEmailRoutes);
  app.register(polarWebhook, { prefix: "/api/webhooks" });
  app.register(subscriptionsRoutes, { prefix: "/api/subscriptions" });
  app.register(authRoutes, { prefix: "/api/auth" });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    reply
      .status((err as any).statusCode || 500)
      .send({ message: err.message || "Internal Server Error" });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ message: "Not Found" });
  });

  return app;
}
