import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from '@booking-for-all/auth';
import prisma from '@booking-for-all/db';
import { AppError } from '../errors/AppError';

export async function requireAuthHook(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({ headers: request.headers as any });
  if (!session) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  // @ts-expect-error augment at runtime
  request.user = session.user;
  // @ts-expect-error augment at runtime
  request.session = session.session;
  
  // Send mobile app notification email (one-time, after app launch)
  // Use setImmediate to avoid blocking the auth response
  setImmediate(async () => {
    try {
      const { sendMobileAppNotificationEmail } = await import('../features/notifications/mobile-app-email.js');
      // Get user language preference (default to 'en')
      const lang = (session.user as any).language || (request as any).language || "en";
      await sendMobileAppNotificationEmail(
        session.user.id,
        session.user.email,
        session.user.name,
        lang
      );
    } catch (error) {
      // Don't fail auth if email fails - just log
      console.error('Failed to send mobile app notification:', error);
    }
  });
}

/**
 * Organization guard middleware - verifies user membership in organization
 * Must be called after requireAuthHook
 * Extracts organizationId from query params, body, or URL params
 * Attaches organization context (id, role, organization) to request
 */
export async function orgGuard(request: FastifyRequest, reply: FastifyReply) {
  // @ts-expect-error populated by requireAuthHook
  const user = request.user;
  if (!user) {
    return reply.status(401).send({ error: 'Unauthenticated' });
  }

  // Get organizationId from various sources
  const organizationId = 
    (request.query as any)?.organizationId ||
    (request.body as any)?.organizationId ||
    (request.params as any)?.orgId ||
    (request.params as any)?.organizationId;

  if (!organizationId) {
    return reply.status(400).send({ error: 'Organization ID required' });
  }

  // Normalize organizationId
  const normalizedOrgId = String(organizationId).trim();
  if (!normalizedOrgId) {
    return reply.status(400).send({ error: 'Organization ID cannot be empty' });
  }

  // Verify membership and get role from Member model
  const member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: normalizedOrgId,
        userId: user.id,
      },
    },
    include: {
      organization: true,
    },
  });

  if (!member) {
    return reply.status(403).send({ error: 'No access to organization' });
  }

  // Attach organization context to request
  // @ts-expect-error augment at runtime
  request.organization = {
    id: member.organizationId,
    role: member.role, // ✅ Role from Member model
    organization: member.organization,
  };
}

/**
 * Require ADMIN role (global role, not organization-scoped)
 * Must be called after requireAuthHook
 */
export async function requireAdminHook(request: FastifyRequest, reply: FastifyReply) {
  // @ts-expect-error populated by requireAuthHook
  const user = request.user;
  if (!user || !user.isSystemAdmin) {
    return reply.status(403).send({ error: 'Forbidden - Admin access required' });
  }
}

/**
 * Require specific role(s) in the organization context
 * Must be called after requireAuthHook and orgGuard
 */
export function requireOrgRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // @ts-expect-error populated by orgGuard
    const organization = request.organization;
    
    if (!organization) {
      return reply.status(500).send({ error: 'Organization guard missing - orgGuard must be called first' });
    }
    
    if (!roles.includes(organization.role)) {
      return reply.status(403).send({ error: 'Forbidden - Insufficient role' });
    }
  };
}

/**
 * Require OWNER role.
 * Checks the user's global role field (User.role === 'OWNER').
 * Must be called after requireAuthHook.
 * Org-level membership is verified inside each route handler.
 */
export async function requireOwnerHook(request: FastifyRequest, reply: FastifyReply) {
  // @ts-expect-error populated by requireAuthHook
  const user = request.user;
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  if (user.role !== 'OWNER') {
    return reply.status(403).send({ error: 'Forbidden - Owner access required' });
  }
}

export async function requireProviderHook(request: FastifyRequest, reply: FastifyReply) {
  // @ts-expect-error populated by requireAuthHook
  const user = request.user;
  const providerId = (request.body as any)?.providerId || (request.params as any)?.providerId;
  if (providerId) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId }, include: { user: true } });
    if (!provider || provider.userId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden - Only the provider can perform this action' });
    }
    // @ts-expect-error attach for handlers
    request.provider = provider;
  }
}

export async function requireEnabledOrganizationHook(request: FastifyRequest, reply: FastifyReply) {
  // @ts-expect-error use narrow type
  const organizationId = (request.body as any)?.organizationId || (request.params as any)?.organizationId || (request.query as any)?.organizationId;
  if (!organizationId) {
    return reply.status(400).send({ error: 'Organization ID required' });
  }
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) {
    return reply.status(404).send({ error: 'Organization not found' });
  }
  if (!organization.enabled) {
    return reply.status(403).send({ error: 'Organization is not enabled. Please complete subscription to activate.' });
  }
}

export async function validateApiKeyHook(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    return reply.status(401).send({ error: 'API key required' });
  }
  const apiKeyRecord = await prisma.apikey.findFirst({
    where: { key: apiKey, enabled: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  });
  if (!apiKeyRecord) {
    return reply.status(401).send({ error: 'Invalid API key' });
  }
  let metadata: any;
  try {
    metadata = typeof apiKeyRecord.metadata === 'string' ? JSON.parse(apiKeyRecord.metadata) : apiKeyRecord.metadata;
  } catch {
    metadata = {};
  }
  const organizationId = metadata?.organizationId as string | undefined;
  if (!organizationId) {
    return reply.status(401).send({ error: 'API key missing organization metadata' });
  }
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) {
    return reply.status(404).send({ error: 'Organization not found' });
  }
  // Note: We don't check if organization is enabled here because owners need to access
  // the system through external apps to subscribe and enable their organization
  // Enabled check should be enforced at the booking/client feature level instead
  // @ts-expect-error augment instance
  request.organizationId = organizationId;
  // @ts-expect-error augment instance
  request.organization = organization;
  // touch lastRequest
  await prisma.apikey.update({ where: { id: apiKeyRecord.id }, data: { lastRequest: new Date() } });
}


