import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { validateApiKeyHook } from "../../plugins/authz";
import { AppError } from "../../errors/AppError";
import prisma from "@booking-for-all/db";

const externalRoutes: FastifyPluginAsync = async (app) => {
  // SECURITY FIX: Register rate limiting for external routes (per-route configuration)
  await app.register(rateLimit, {
    global: false, // Enable per-route rate limiting
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 10, // Default maximum 10 requests
    timeWindow: process.env.RATE_LIMIT_TIME_WINDOW || "1 minute", // Default per minute
    keyGenerator: (req) => {
      // Rate limit by IP address and optionally by API key if present
      const apiKey = req.headers["x-api-key"] as string;
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      return apiKey ? `${ip}:${apiKey}` : ip;
    },
    errorResponseBuilder: (_req, context) => {
      return {
        success: false,
        error: "Rate limit exceeded",
        message: `Too many requests. Please try again after ${context.after} seconds.`,
        retryAfter: context.after,
      };
    },
  });

  /**
   * Checks if a domain matches an organization's domain field.
   * Supports both single domain (production) and comma-separated domains (development).
   *
   * @param requestedDomain - The domain to match (e.g., "wellness.hu")
   * @param orgDomainField - The domain field from database (e.g., "wellness.appointer.hu" or "wellness.appointer.hu,wellness.hu")
   * @returns true if the domain matches
   */
  function domainMatches(
    requestedDomain: string,
    orgDomainField: string | null
  ): boolean {
    if (!orgDomainField) {
      return false;
    }

    // Normalize both domains
    const normalizedRequested = requestedDomain.toLowerCase().trim();

    // Split by comma and check each domain in the list
    const domains = orgDomainField
      .split(",")
      .map((d) => d.toLowerCase().trim())
      .filter((d) => d.length > 0);

    // Check for exact match in the list
    return domains.includes(normalizedRequested);
  }

  // Public endpoint to get organization by ID (for mobile app)
  app.get(
    "/organization/:id",
    {
      config: {
        rateLimit: {
          max: Number(process.env.RATE_LIMIT_ORG_LOOKUP_MAX) || 30,
          timeWindow: process.env.RATE_LIMIT_ORG_LOOKUP_WINDOW || "1 minute",
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      if (!id) {
        throw new AppError("Organization ID is required", "ORG_ID_REQUIRED", 400);
      }

      const organization = await prisma.organization.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          logo: true,
        },
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

  // NEW: Public endpoint to get organization by domain
  app.get(
    "/organization-by-domain",
    {
      config: {
        rateLimit: {
          max: Number(process.env.RATE_LIMIT_DOMAIN_LOOKUP_MAX) || 20,
          timeWindow: process.env.RATE_LIMIT_DOMAIN_LOOKUP_WINDOW || "1 minute",
        },
      },
    },
    async (req, reply) => {
      // Extract domain from query parameter (passed from external HTML app)
      const { domain } = req.query as { domain?: string };

      if (!domain) {
        throw new AppError(
          "Domain parameter is required",
          "DOMAIN_REQUIRED",
          400
        );
      }

      // Normalize domain (lowercase, trim, remove port if present)
      const normalizedDomain = domain.toLowerCase().trim();
      const domainParts = normalizedDomain.split(":");
      const domainWithoutPort = domainParts[0] || normalizedDomain;

      if (!domainWithoutPort || domainWithoutPort.length === 0) {
        throw new AppError("Invalid domain format", "INVALID_DOMAIN", 400);
      }

      // First, try exact match (for production single domain)
      let organization = await prisma.organization.findUnique({
        where: { domain: domainWithoutPort },
      });

      // If not found, search through all organizations to find one where
      // the domain field contains the requested domain (supports comma-separated domains)
      if (!organization) {
        const allOrganizations = await prisma.organization.findMany({
          where: {
            domain: {
              not: null,
            },
          },
        });

        // Find organization where domain matches (handles comma-separated domains)
        organization =
          allOrganizations.find((org) =>
            domainMatches(domainWithoutPort, org.domain)
          ) || null;
      }

      if (!organization) {
        throw new AppError(
          "Organization not found for this domain",
          "ORGANIZATION_NOT_FOUND",
          404
        );
      }

      // Return organization info (similar to /verify endpoint)
      reply.send({
        success: true,
        data: {
          organizationId: organization.id,
          organizationName: organization.name,
          organizationSlug: organization.slug,
          redirectUrl: `${
            process.env.CORS_ORIGIN ||
            process.env.FRONTEND_URL ||
            "http://localhost:3001"
          }/login?org=${organization.id}&referrer=${encodeURIComponent(
            (req.headers.referer as string) || ""
          )}`,
        },
      });
    }
  );

  app.get(
    "/validate-session",
    {
      config: {
        rateLimit: {
          max: Number(process.env.RATE_LIMIT_VALIDATE_MAX) || 20, // More lenient for session validation
          timeWindow: process.env.RATE_LIMIT_VALIDATE_WINDOW || "1 minute",
        },
      },
    },
    async (req, reply) => {
      const { sessionToken } = (req.query as any) || {};
      if (!sessionToken) {
        throw new AppError(
          "Session token required",
          "SESSION_TOKEN_REQUIRED",
          401
        );
      }
      reply.send({
        success: true,
        data: {
          valid: true,
          message: "Session validation endpoint - implement session checking",
        },
      });
    }
  );

  // SECURITY FIX: Apply strict rate limiting to verify endpoint
  app.get(
    "/verify",
    {
      preValidation: [validateApiKeyHook],
      config: {
        rateLimit: {
          // Stricter rate limit for verify endpoint (5 requests per minute)
          max: Number(process.env.RATE_LIMIT_VERIFY_MAX) || 5,
          timeWindow: process.env.RATE_LIMIT_VERIFY_WINDOW || "1 minute",
        },
      },
    },
    async (req, reply) => {
      // Properties set by validateApiKeyHook
      const organizationId = (req as any).organizationId;
      const organization = (req as any).organization;
      reply.send({
        success: true,
        data: {
          organizationId,
          organizationName: organization.name,
          organizationSlug: organization.slug,
          redirectUrl: `${
            process.env.CORS_ORIGIN
          }/login?org=${organizationId}&referrer=${encodeURIComponent(
            (req.headers.referer as string) || ""
          )}`,
        },
      });
    }
  );
};

export default externalRoutes;
