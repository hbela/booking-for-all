import type { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { validateApiKeyHook } from '../../plugins/authz';
import { AppError } from '../../errors/AppError';
import prisma from '@booking-for-all/db';

const externalRoutes: FastifyPluginAsync = async (app) => {
  // SECURITY FIX: Register rate limiting for external routes (per-route configuration)
  await app.register(rateLimit, {
    global: false, // Enable per-route rate limiting
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 10, // Default maximum 10 requests
    timeWindow: process.env.RATE_LIMIT_TIME_WINDOW || '1 minute', // Default per minute
    keyGenerator: (req) => {
      // Rate limit by IP address and optionally by API key if present
      const apiKey = req.headers['x-api-key'] as string;
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return apiKey ? `${ip}:${apiKey}` : ip;
    },
    errorResponseBuilder: (req, context) => {
      return {
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again after ${context.after} seconds.`,
        retryAfter: context.after,
      };
    },
  });

  // NEW: Public endpoint to get organization by domain
  app.get('/organization-by-domain', {
    config: {
      rateLimit: {
        max: Number(process.env.RATE_LIMIT_DOMAIN_LOOKUP_MAX) || 20,
        timeWindow: process.env.RATE_LIMIT_DOMAIN_LOOKUP_WINDOW || '1 minute',
      }
    }
  }, async (req, reply) => {
    const { domain } = req.query as { domain?: string };
    
    if (!domain) {
      throw new AppError(
        'Domain parameter is required',
        'DOMAIN_REQUIRED',
        400
      );
    }

    // Normalize domain (lowercase, trim, remove port if present)
    const normalizedDomain = domain.toLowerCase().trim();
    const domainWithoutPort = normalizedDomain.split(':')[0];

    // Find organization by domain
    const organization = await prisma.organization.findUnique({
      where: { domain: domainWithoutPort },
    });

    if (!organization) {
      throw new AppError(
        'Organization not found for this domain',
        'ORGANIZATION_NOT_FOUND',
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
        redirectUrl: `${process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3001'}/login?org=${organization.id}&referrer=${encodeURIComponent((req.headers.referer as string) || '')}`,
      },
    });
  });

  app.get('/validate-session', {
    config: {
      rateLimit: {
        max: Number(process.env.RATE_LIMIT_VALIDATE_MAX) || 20, // More lenient for session validation
        timeWindow: process.env.RATE_LIMIT_VALIDATE_WINDOW || '1 minute',
      }
    }
  }, async (req, reply) => {
    const { sessionToken } = (req.query as any) || {};
    if (!sessionToken) {
      throw new AppError(
        'Session token required',
        'SESSION_TOKEN_REQUIRED',
        401
      );
    }
    reply.send({
      success: true,
      data: {
        valid: true,
        message: 'Session validation endpoint - implement session checking',
      },
    });
  });

  // SECURITY FIX: Apply strict rate limiting to verify endpoint
  app.get('/verify', { 
    preValidation: [validateApiKeyHook],
    config: {
      rateLimit: {
        // Stricter rate limit for verify endpoint (5 requests per minute)
        max: Number(process.env.RATE_LIMIT_VERIFY_MAX) || 5,
        timeWindow: process.env.RATE_LIMIT_VERIFY_WINDOW || '1 minute',
      }
    }
  }, async (req, reply) => {
    // @ts-expect-error set in hook
    const organizationId = req.organizationId;
    // @ts-expect-error set in hook
    const organization = req.organization;
    reply.send({
      success: true,
      data: {
        organizationId,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        redirectUrl: `${process.env.CORS_ORIGIN}/login?org=${organizationId}&referrer=${encodeURIComponent((req.headers.referer as string) || '')}`,
      },
    });
  });
};

export default externalRoutes;


