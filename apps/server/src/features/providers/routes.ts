import type { FastifyPluginAsync } from "fastify";
import prisma from "@booking-for-all/db";
import { requireAuthHook, orgGuard } from "../../plugins/authz";

const providersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { 
    preValidation: [requireAuthHook] 
  }, async (req, reply) => {
    const { userId, departmentId, organizationId } = req.query as any;
    const user = req.user;
    
    // Build where clause based on filters
    const where: any = {};
    
    // If userId is provided and matches the authenticated user, allow querying across all organizations
    // This is needed for providers to see their own provider records
    if (userId && userId === user.id) {
      where.userId = userId;
      // If organizationId is also provided, filter by it
      if (organizationId) {
        where.department = { organizationId };
      }
    } else if (userId) {
      // If userId is provided but doesn't match authenticated user, require organization context
      // This prevents users from querying other users' providers without org context
      if (!organizationId) {
        return reply.status(400).send({ error: "Organization ID required when querying other users" });
      }
      where.userId = userId;
      where.department = { organizationId };
    } else if (organizationId) {
      // If only organizationId is provided, use orgGuard to verify membership
      // We'll manually check membership here since orgGuard requires organizationId in a specific format
      const member = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: user.id,
          },
        },
      });
      
      if (!member) {
        return reply.status(403).send({ error: "No access to organization" });
      }
      
      // For owners, allow access to disabled organizations
      const isOwner = member.role === "OWNER";
      if (isOwner) {
        where.department = { organizationId };
      } else {
        where.department = { organizationId, organization: { enabled: true } };
      }
    } else {
      // No filters provided - return empty or require at least one filter
      return reply.status(400).send({ error: "At least one filter (userId, organizationId, or departmentId) is required" });
    }
    
    if (departmentId) {
      where.departmentId = departmentId;
    }

    const providers = await prisma.provider.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            description: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    reply.send(providers);
  });

  app.get("/:id", { preValidation: [requireAuthHook] }, async (req, reply) => {
    const { id } = req.params as any;
    const provider = await prisma.provider.findUnique({
      where: { id },
      include: {
        department: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    if (!provider)
      return reply.status(404).send({ error: "Provider not found" });
    reply.send(provider);
  });

  // Note: POST and DELETE mutations have been moved to /api/owner/providers/*
};

export default providersRoutes;
