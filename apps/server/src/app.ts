import Fastify from "fastify";
import fastifyEnv from "@fastify/env";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import cors from "@fastify/cors";
import healthRoutes from "./features/health/routes";
import apiRoutes from "./features/api/routes";
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
import stripeWebhook from "./features/webhooks/stripe";
import sentryTunnel from "./features/webhooks/sentry-tunnel";
import { auth } from "@booking-for-all/auth";
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
import { registerAuthPlugins } from "./plugins/auth";
import * as Sentry from "@sentry/node";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

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
    INTERNAL_WEBHOOK_SECRET: { type: "string" },
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
    STRIPE_SECRET_KEY: { type: "string" },
    STRIPE_WEBHOOK_SECRET: { type: "string" },
    STRIPE_PRICE_ID_MONTHLY: { type: "string" },
    STRIPE_PRICE_ID_YEARLY: { type: "string" },
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
    trustProxy: true, // Important for ngrok tunnels - ensures Fastify correctly interprets forwarded headers
    requestTimeout: 30000, // 30 second timeout to prevent incomplete responses
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
      "Loaded environment configuration from apps/server/.env"
    );

    instrument({
      SENTRY_DSN: cfg.SENTRY_DSN,
      SENTRY_RELEASE: cfg.SENTRY_RELEASE,
      NODE_ENV: cfg.NODE_ENV,
    });

    // Only setup Sentry error handler in production
    if (cfg.NODE_ENV !== "development") {
      Sentry.setupFastifyErrorHandler(app);
    }
  });

  // Configure Zod type provider
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register Swagger/OpenAPI documentation
  app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Booking for All API",
        description:
          "Comprehensive appointment management system API. Connect organizations, service providers, and clients seamlessly.",
        version: "1.0.0",
        contact: {
          name: "API Support",
        },
      },
      servers: [
        {
          url: process.env.BETTER_AUTH_URL || "http://localhost:3000",
          description: "API Server",
        },
      ],
      tags: [
        {
          name: "organizations",
          description: "Organization management endpoints",
        },
        { name: "client", description: "Client-facing endpoints" },
        { name: "owner", description: "Organization owner endpoints" },
        { name: "provider", description: "Service provider endpoints" },
        { name: "admin", description: "Administrator endpoints" },
        { name: "bookings", description: "Booking management" },
        { name: "events", description: "Event/availability management" },
        { name: "departments", description: "Department management" },
        { name: "providers", description: "Provider management" },
        { name: "auth", description: "Authentication endpoints" },
        { name: "voice-agent", description: "Voice agent integration" },
        { name: "external", description: "External/public endpoints" },
        { name: "health", description: "Health check endpoints" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description:
              "Bearer token authentication. Include the token in the Authorization header as: Bearer {token}",
          },
          apiKey: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
            description: "API key authentication for external integrations",
          },
        },
      },
    },
  });

  // Register Swagger UI
  app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });

  // Register i18n plugin
  app.register(i18nPlugin);

  // Register org app plugin (QR code and APK management)
  app.register(orgAppPlugin);

  app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Configure content type parser to allow empty JSON bodies (common with DELETE requests)
  // Some HTTP clients send Content-Type: application/json with no body for DELETE requests
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        // If body is empty, return empty object instead of throwing error
        if (!body || body.trim() === "") {
          return done(null, {});
        }
        const json = JSON.parse(body);
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // Register multipart plugin for file uploads
  app.register(multipart, {
    limits: {
      fileSize:
        Number(process.env.VOICE_AGENT_MAX_AUDIO_SIZE) || 10 * 1024 * 1024, // 10MB default
    },
  });

  // Register rawBody plugin globally but only process routes with rawBody: true
  app.register(rawBody, {
    field: "rawBody",
    global: false, // Only process routes with config: { rawBody: true }
    runFirst: true, // Run before other body parsers
  });

  // Debug: Log Better Auth configuration
  app.log.info(`🔐 Better Auth baseURL: ${process.env.BETTER_AUTH_URL}`);
  app.log.info(`🔐 Better Auth initialized with Google Sign-In only`);

  // Wildcard route to forward all /api/auth/* requests to Better Auth
  // Note: /api/auth/callback/social is now handled by Better Auth directly
  // The afterSignIn hook in packages/auth/src/index.ts handles organizationId from additionalData
  const customAuthRoutes: string[] = [];

  app.all("/api/auth/*", async (request, reply) => {
    // Skip Better Auth for custom routes - they'll be handled by authRoutes plugin below
    const customRoute = customAuthRoutes.find((route) =>
      request.url.startsWith(route)
    );
    if (customRoute) {
      app.log.info(`🔐 Skipping Better Auth for custom route: ${request.url}`);
      return reply.callNotFound();
    }

    app.log.info(
      `🔐 Processing Better Auth request: ${request.method} ${request.url}`
    );

    try {
      // Construct full URL for Better Auth
      const url = new URL(
        request.url,
        `${request.protocol}://${request.headers.host}`
      );

      // Convert Fastify headers to Fetch API Headers
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) {
          headers.append(
            key,
            Array.isArray(value) ? value.join(", ") : value.toString()
          );
        }
      });

      // Create Fetch API-compatible Request
      const fetchRequest = new Request(url.toString(), {
        method: request.method,
        headers,
        body:
          request.method !== "GET" && request.method !== "HEAD" && request.body
            ? JSON.stringify(request.body)
            : undefined,
      });

      // Call Better Auth handler (uses Fetch API)
      app.log.info(`🔐 Calling auth.handler with URL: ${url.toString()}`);
      const response = await auth.handler(fetchRequest);

      // Forward Better Auth response to client
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      const responseBody = await response.text();
      app.log.info(
        `🔐 Better Auth responded: status=${response.status}, body=${responseBody.substring(0, 200)}`
      );

      reply.send(responseBody || null);
    } catch (error) {
      app.log.error(error, "🔐 Error processing Better Auth request");
      reply.status(500).send({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
    }
  });

  // Register auth plugins (organization-scoped routes)
  // These plugins register routes at /org/:orgId/... so we prefix with /api
  app.register(async (fastify) => {
    await registerAuthPlugins(fastify);
  }, { prefix: "/api" });

  app.register(healthRoutes, { 
    prefix: "/health",
    logLevel: "error", // Only log errors, not regular health checks
  });

  // Sentry tunnel endpoint to bypass ad blockers
  // Register as a plugin (like stripe webhook) to ensure rawBody plugin works correctly
  app.register(sentryTunnel, { prefix: "/api" });
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
  app.register(stripeWebhook, { prefix: "/api/webhooks" });
  app.register(subscriptionsRoutes, { prefix: "/api/subscriptions" });
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(voiceAgentRoutes, { prefix: "/api/voice-agent" });
  app.register(apiRoutes, { prefix: "/api" }); // API info endpoint

  // Register global error handler (must be after all routes)
  errorHandler(app);

  app.setNotFoundHandler((_req, reply) => {
    reply
      .header("Content-Type", "application/json; charset=utf-8")
      .status(404)
      .send({ message: "Not Found" });
  });

  return app;
}
