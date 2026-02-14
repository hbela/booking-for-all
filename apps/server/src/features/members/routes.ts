import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "@/plugins/authz.js";
import crypto from "node:crypto";
import prisma from "@booking-for-all/db";

export default async function memberRoutes(fastify: FastifyInstance) {
  // Get current user's member info for a specific organization
  // Full path: /api/members/:orgId/me
  fastify.get(
    "/:orgId/me",
    {
      preHandler: [requireAuthHook],
    },
    async (req, reply) => {
      const { orgId } = req.params as { orgId: string };
      const userId = req.user!.id;

      fastify.log.info({ userId, orgId }, '🔍 Fetching member record');

      try {
        // First, try a simple query without select to diagnose issues
        const memberSimple = await prisma.member.findFirst({
          where: {
            userId,
            organizationId: orgId,
          },
        });

        if (!memberSimple) {
          fastify.log.warn({ userId, orgId }, '❌ Member not found');
          return reply.status(404).send({
            success: false,
            code: "MEMBER_NOT_FOUND",
            message: "You are not a member of this organization",
          });
        }

        fastify.log.info({ member: memberSimple }, '✅ Member found');
        
        // Return the member data
        return reply.send({
          success: true,
          data: {
            id: memberSimple.id,
            userId: memberSimple.userId,
            organizationId: memberSimple.organizationId,
            email: memberSimple.email,
            role: memberSimple.role,
            createdAt: memberSimple.createdAt,
          },
        });
      } catch (error) {
        fastify.log.error({ error, userId, orgId, errorMessage: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined }, "❌ Error fetching member");
        return reply.status(500).send({
          success: false,
          code: "MEMBER_FETCH_FAILED",
          message: error instanceof Error ? error.message : "Failed to fetch member information",
          error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
        });
      }
    }
  );

  // Get all organizations the current user is a member of
  // Full path: /api/members/my-organizations
  fastify.get(
    "/my-organizations",
    {
      preHandler: [requireAuthHook],
    },
    async (req, reply) => {
      const userId = req.user!.id;

      try {
        const memberships = await prisma.member.findMany({
          where: {
            userId,
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                domain: true,
                timeZone: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        return reply.send({
          success: true,
          data: memberships.map((m) => ({
            id: m.id,
            role: m.role,
            organization: m.organization,
            createdAt: m.createdAt,
          })),
        });
      } catch (error) {
        fastify.log.error("Error fetching user organizations:", error);
        return reply.status(500).send({
          success: false,
          code: "ORGANIZATIONS_FETCH_FAILED",
          message: "Failed to fetch organizations",
        });
      }
    }
  );

  // Create or get member record for current user in an organization
  // This is useful for existing users who logged in before the member system
  // Full path: /api/members/:orgId/ensure
  fastify.post(
    "/:orgId/ensure",
    {
      preHandler: [requireAuthHook],
    },
    async (req, reply) => {
      const { orgId } = req.params as { orgId: string };
      const userId = req.user!.id;

      try {
        // Check if member already exists
        let member = await prisma.member.findFirst({
          where: {
            userId,
            organizationId: orgId,
          },
        });

        if (member) {
          return reply.send({
            success: true,
            data: member,
            message: "Member already exists",
          });
        }

        // Get user email
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });

        if (!user) {
          return reply.status(404).send({
            success: false,
            code: "USER_NOT_FOUND",
            message: "User not found",
          });
        }

        // Verify organization exists
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
        });

        if (!org) {
          return reply.status(404).send({
            success: false,
            code: "ORG_NOT_FOUND",
            message: "Organization not found",
          });
        }

        // Determine auth method from user's accounts
        // Only Google Sign-In is supported
        const accounts = await prisma.account.findMany({
          where: { userId },
          select: { providerId: true },
        });

        // Default to 'google' (only supported auth method)
        let authMethod: 'google' = 'google';
        if (accounts.length > 0) {
          const hasGoogle = accounts.some(acc => acc.providerId === 'google');
          if (hasGoogle) {
            authMethod = 'google';
          }
        }

        fastify.log.warn(
          `⚠️ Auto-creating member for user ${userId} in org ${orgId} with authMethod=${authMethod}. This endpoint should not be needed in normal operation.`
        );

        // Create member with CLIENT role by default
        member = await prisma.member.create({
          data: {
            id: crypto.randomUUID(),
            userId,
            organizationId: orgId,
            email: user.email,
            role: "CLIENT",
            authMethod,
            createdAt: new Date(),
          },
        });

        return reply.send({
          success: true,
          data: member,
          message: "Member created successfully",
        });
      } catch (error) {
        fastify.log.error("Error ensuring member:", error);
        return reply.status(500).send({
          success: false,
          code: "MEMBER_ENSURE_FAILED",
          message: "Failed to create member record",
        });
      }
    }
  );
}
