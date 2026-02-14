import fp from 'fastify-plugin';
import { findMembership, createMembership } from './membership.service';
import prisma from '@booking-for-all/db';
import { AppError } from '../../errors/AppError';
import type { FastifyRequest } from 'fastify';

/**
 * Google OAuth Plugin
 * Handles organization-scoped Google OAuth sign-in/sign-up
 * Unified flow that handles all edge cases automatically
 */
export const googleOAuthPlugin = fp(async (fastify) => {
  // Log that the plugin is being registered
  fastify.log.info('🔐 Google OAuth plugin registering routes');
  
  // Test route to verify plugin registration
  fastify.get('/org/:orgId/auth/google/test', async (req: FastifyRequest, reply) => {
    return reply.send({ message: 'Google OAuth plugin is working', orgId: (req as any).orgId });
  });
  
  // DEPRECATED: This route is kept for backward compatibility
  // Frontend should use authClient.signIn.social() with additionalData instead
  // Initiate OAuth flow
  // Register the main route - Fastify should match more specific routes first
  fastify.get('/org/:orgId/auth/google', async (req: FastifyRequest, reply) => {
    fastify.log.info(`🔐 Google OAuth route hit: ${req.url}, orgId: ${(req as any).orgId}, method: ${req.method}`);
    const orgId = (req as any).orgId;

    if (!orgId) {
      throw new AppError(
        'Organization ID is required',
        'ORG_ID_REQUIRED',
        400
      );
    }

    // Validate organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 'ORG_NOT_FOUND', 404);
    }

    if (!organization.enabled) {
      throw new AppError(
        'Organization is not enabled',
        'ORG_NOT_ENABLED',
        403
      );
    }

    // Use Better Auth's API method to initiate social sign-in
    const baseAuthUrl = process.env.BETTER_AUTH_URL || `${req.protocol}://${req.headers.host}`;
    const callbackURL = `${baseAuthUrl}/api/auth/callback/google?orgId=${orgId}`;
    
    // Use Better Auth's social sign-in endpoint to initiate OAuth
    // Better Auth's social OAuth is typically initiated client-side via redirect
    // We'll redirect directly to Better Auth's endpoint and store orgId in a cookie
    try {
      // Set a temporary cookie with orgId that will be available during the OAuth callback
      // Fastify doesn't have a cookie plugin, so we set the Set-Cookie header manually
      const cookieOptions = [
        `oauth_org_id=${orgId}`,
        'HttpOnly',
        'Path=/',
        `Max-Age=600`, // 10 minutes - enough time for OAuth flow
        process.env.NODE_ENV === 'production' ? 'Secure' : '',
        'SameSite=Lax',
      ].filter(Boolean).join('; ');
      
      reply.header('Set-Cookie', cookieOptions);
      
      // Construct Better Auth's social sign-in URL and redirect the client directly
      // Better Auth will handle the OAuth flow and redirect back to /api/auth/callback/social
      const betterAuthInitUrl = new URL('/api/auth/sign-in/social', baseAuthUrl);
      betterAuthInitUrl.searchParams.set('provider', 'google');
      
      fastify.log.info(`🔐 Redirecting to Better Auth social sign-in: ${betterAuthInitUrl.toString()}`);
      
      // Redirect the client directly - Better Auth will handle the OAuth flow
      return reply.redirect(betterAuthInitUrl.toString());
    } catch (error: any) {
      fastify.log.error(error, 'Error initiating Google OAuth');
      throw new AppError(
        error?.message || 'Failed to initiate Google OAuth',
        'OAUTH_INIT_FAILED',
        500
      );
    }
  });

  // Handle OAuth callback
  // Better Auth uses /api/auth/callback/social for all social providers
  // We intercept it to add orgId handling
  // Route path is without /api prefix since plugin is registered with /api prefix
  fastify.get(
    '/auth/callback/social',
    async (req: FastifyRequest, reply) => {
      // Read orgId from cookie (we set it during OAuth initiation)
      // Parse cookie header manually (Fastify doesn't have cookie plugin)
      let orgId: string | undefined;
      const cookieHeader = req.headers.cookie;
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          if (key && value) {
            acc[key] = decodeURIComponent(value);
          }
          return acc;
        }, {} as Record<string, string>);
        orgId = cookies.oauth_org_id;
      }
      
      // Also try query params as fallback
      if (!orgId) {
        orgId = (req.query as any)?._orgId || (req.query as any)?.orgId;
      }
      
      // Clear the temporary cookie by setting it with Max-Age=0
      if (orgId) {
        const clearCookieOptions = [
          'oauth_org_id=',
          'HttpOnly',
          'Path=/',
          'Max-Age=0',
          process.env.NODE_ENV === 'production' ? 'Secure' : '',
          'SameSite=Lax',
        ].filter(Boolean).join('; ');
        reply.header('Set-Cookie', clearCookieOptions);
      }

      if (!orgId) {
        throw new AppError(
          'Organization ID is required',
          'ORG_ID_REQUIRED',
          400
        );
      }

      // Let Better Auth handle the OAuth callback first
      try {
        const url = new URL(req.url, `${req.protocol}://${req.headers.host}`);
        
        // Forward the request to Better Auth's callback handler
        const baseAuthUrl = process.env.BETTER_AUTH_URL || `${req.protocol}://${req.headers.host}`;
        const authCallbackUrl = new URL('/api/auth/callback/social', baseAuthUrl);
        // Copy all query params from original request
        url.searchParams.forEach((value, key) => {
          authCallbackUrl.searchParams.set(key, value);
        });

        // Create a request to Better Auth callback
        const headers = new Headers();
        Object.entries(req.headers).forEach(([key, value]) => {
          if (value) {
            headers.append(key, Array.isArray(value) ? value.join(', ') : value.toString());
          }
        });

        const authRequest = new Request(authCallbackUrl.toString(), {
          method: 'GET',
          headers,
        });

        fastify.log.info(`🔐 Calling Better Auth handler for callback: ${authCallbackUrl.toString()}`);
        const authResponse = await fastify.auth.handler(authRequest);
        
        const responseText = await authResponse.text();
        fastify.log.info(`🔐 Better Auth callback response: status=${authResponse.status}, body=${responseText.substring(0, 200)}`);

        // Forward Better Auth response headers (including Set-Cookie)
        authResponse.headers.forEach((value, key) => {
          reply.header(key, value);
        });

        if (!authResponse.ok) {
          fastify.log.error(`🔐 Better Auth callback failed: status=${authResponse.status}, body=${responseText}`);
          const frontendUrl = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3001';
          return reply.redirect(`${frontendUrl}/login?org=${orgId}&error=${encodeURIComponent('Google authentication failed')}`);
        }

        // Better Auth has processed the OAuth callback and set session cookie
        // Extract session cookie from Set-Cookie header to get the session
        const setCookieHeader = authResponse.headers.get('set-cookie');
        const sessionHeaders = new Headers(req.headers as any);
        
        // If Better Auth set a cookie, add it to headers for session check
        if (setCookieHeader) {
          // Parse and add the session cookie
          const cookies = setCookieHeader.split(',').map(c => c.trim());
          const existingCookie = req.headers.cookie || '';
          const allCookies = existingCookie ? [existingCookie, ...cookies].join('; ') : cookies.join('; ');
          sessionHeaders.set('cookie', allCookies);
        }

        // Get session using cookies
        let session: any = null;
        try {
          session = await fastify.auth.api.getSession({
            headers: sessionHeaders as any,
          });
        } catch (error) {
          fastify.log.warn(error, 'Could not get session after OAuth callback');
        }

        if (!session?.user) {
          // Session not available yet - redirect to login
          // The cookie is set, so on next page load session will be available
          const frontendUrl = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3001';
          return reply.redirect(`${frontendUrl}/login?org=${orgId}&oauth=success`);
        }

        const userId = session.user.id;

        // Check/create membership (same logic as S1/S2/S3)
        const membership = await findMembership(userId, orgId);

        if (!membership) {
          // Create membership automatically (S1 or S3 case)
          await createMembership(userId, orgId);
        }

        // Detect if this is a mobile app request
        const isMobileApp = !!req.headers['x-api-key'] || req.headers['x-client-type'] === 'mobile';

        // For mobile apps, return JSON with token
        if (isMobileApp) {
          return reply.send({
            success: true,
            user: session.user,
            session: session.session ? { token: session.session.token } : null,
            organizationId: orgId,
          });
        }

        // For web clients, redirect to dashboard
        const frontendUrl = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3001';
        return reply.redirect(`${frontendUrl}/client/organizations/${orgId}`);
      } catch (error) {
        fastify.log.error(error, 'Error handling Google OAuth callback');
        const frontendUrl = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3001';
        return reply.redirect(`${frontendUrl}/login?org=${orgId}&error=${encodeURIComponent('Authentication error')}`);
      }
    }
  );
});

