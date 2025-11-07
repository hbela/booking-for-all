import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from '@booking-for-all/auth';
import prisma from '@booking-for-all/db';

export async function requireAuthHook(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({ headers: request.headers as any });
  if (!session) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  // @ts-expect-error augment at runtime
  request.user = session.user;
  // @ts-expect-error augment at runtime
  request.session = session.session;
}

export async function requireAdminHook(request: FastifyRequest, reply: FastifyReply) {
  // @ts-expect-error populated by requireAuthHook
  const user = request.user;
  if (!user || user.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Forbidden - Admin access required' });
  }
}

export async function requireOwnerHook(request: FastifyRequest, reply: FastifyReply) {
  // @ts-expect-error populated by requireAuthHook
  const user = request.user;
  // @ts-expect-error use narrow type as needed
  const organizationId = (request.body as any)?.organizationId || (request.params as any)?.organizationId || (request.query as any)?.organizationId;
  if (!organizationId) {
    return reply.status(400).send({ error: 'Organization ID required' });
  }

  const member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
  });
  if (user.role !== 'OWNER') {
    return reply.status(403).send({ error: 'Forbidden - Owner access required' });
  }
  // @ts-expect-error attach for handlers
  request.organizationId = organizationId;
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


