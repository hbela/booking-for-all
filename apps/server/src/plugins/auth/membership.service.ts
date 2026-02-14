import prisma from '@booking-for-all/db';
import crypto from 'crypto';

/**
 * Pure business logic for membership operations.
 * No Fastify dependencies for testability.
 */

/**
 * Find membership for a user in an organization
 */
export async function findMembership(userId: string, orgId: string) {
  return prisma.member.findUnique({
    where: {
      organizationId_userId: {
        userId,
        organizationId: orgId,
      },
    },
  });
}

/**
 * Create a membership for a user in an organization
 */
export async function createMembership(
  userId: string,
  orgId: string,
  role: 'CLIENT' | 'PROVIDER' | 'OWNER' | 'ADMIN' = 'CLIENT',
  authMethod: 'google' = 'google'
) {
  // Get user email for member record
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  return prisma.member.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      organizationId: orgId,
      email: user.email,
      role,
      authMethod,
      createdAt: new Date(),
    },
  });
}

