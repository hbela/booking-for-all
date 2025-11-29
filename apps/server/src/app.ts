import Fastify from "fastify";
import fastifyEnv from "@fastify/env";
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
import ownerRoutes from "./features/owner/routes";
import providerRoutes from "./features/provider/routes";
import authRoutes from "./features/auth/routes";
import voiceAgentRoutes from "./features/voice-agent/routes";
import { instrument } from "./instrument";
import { errorHandler } from "./plugins/errorHandler";
import i18nPlugin from "./plugins/i18n";
import orgAppPlugin from "./plugins/orgApp";
import * as Sentry from "@sentry/node";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multipart from "@fastify/multipart";

// In ESM, __dirname is not available by default – reconstruct it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envSchema = {
  type: "object",
  required: [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "SENTRY_DSN",
    "SENTRY_RELEASE",
  ],
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    LOG_LEVEL: { type: "string", default: "info" },
    DATABASE_URL: { type: "string" },
    BETTER_AUTH_SECRET: { type: "string" },
    BETTER_AUTH_URL: { type: "string" },
    SENTRY_DSN: { type: "string" },
    SENTRY_RELEASE: { type: "string" },
    CORS_ORIGIN: { type: "string" },
    FRONTEND_URL: { type: "string" },
    N8N_WEBHOOK_URL: { type: "string" },
    VOICE_AGENT_SESSION_TTL: { type: "string" },
    VOICE_AGENT_MAX_AUDIO_SIZE: { type: "string" },
    MOBILE_APP_ORIGIN: { type: "string" },
    MOBILE_APP_IOS_URL: { type: "string" },
    MOBILE_APP_ANDROID_URL: { type: "string" },
    MOBILE_APP_LAUNCHED: { type: "string" },
    S3_REGION: { type: "string" },
    S3_ENDPOINT: { type: "string" },
    S3_ACCESS_KEY: { type: "string" },
    S3_SECRET_KEY: { type: "string" },
    S3_BUCKET: { type: "string" },
    PUBLIC_APP_URL: { type: "string" },
  },
} as const;

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : { target: "pino-pretty", options: { colorize: true } },
    },
  });

  // Load and validate env vars from apps/server/.env
  app.register(fastifyEnv, {
    confKey: "config",
    schema: envSchema,
    dotenv: {
      path: path.resolve(__dirname, "../.env"),
    },
  });

  // After env is loaded, initialize Sentry with validated config
  app.after((err) => {
    if (err) {
      app.log.error(err, "Error registering env plugin");
      throw err;
    }

    const cfg = (app as any).config as any;

    // Log key env values once at startup to verify they are loaded correctly
    app.log.info(
      {
        NODE_ENV: cfg.NODE_ENV,
        DATABASE_URL: cfg.DATABASE_URL ? "<set>" : "<missing>",
        BETTER_AUTH_SECRET: cfg.BETTER_AUTH_SECRET ? "<set>" : "<missing>",
        BETTER_AUTH_URL: cfg.BETTER_AUTH_URL || "<missing>",
        SENTRY_DSN: cfg.SENTRY_DSN ? "<set>" : "<missing>",
        SENTRY_RELEASE: cfg.SENTRY_RELEASE || "<missing>",
      },
      "Loaded environment configuration from apps/server/.env",
    );

    instrument({
      SENTRY_DSN: cfg.SENTRY_DSN,
      SENTRY_RELEASE: cfg.SENTRY_RELEASE,
      NODE_ENV: cfg.NODE_ENV,
    });

    Sentry.setupFastifyErrorHandler(app);
  });

  // Configure Zod type provider
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register i18n plugin
  app.register(i18nPlugin);

  // Register org app plugin (QR code and APK management)
  app.register(orgAppPlugin);

  app.register(cors, {
    origin: true,
    credentials: true,
  });
  
  // Register multipart plugin for file uploads
  app.register(multipart, {
    limits: {
      fileSize: Number(process.env.VOICE_AGENT_MAX_AUDIO_SIZE) || 10 * 1024 * 1024, // 10MB default
    },
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
  app.register(ownerRoutes, { prefix: "/api/owner" });
  app.register(providerRoutes, { prefix: "/api/provider" });
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
  app.register(voiceAgentRoutes, { prefix: "/api/voice-agent" });

  // Register global error handler (must be after all routes)
  errorHandler(app);

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ message: "Not Found" });
  });

  return app;
}
