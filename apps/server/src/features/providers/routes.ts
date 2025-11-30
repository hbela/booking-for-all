import type { FastifyPluginAsync } from "fastify";
import prisma from "@booking-for-all/db";
import { requireAuthHook } from "../../plugins/authz";

const providersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preValidation: [requireAuthHook] }, async (req, reply) => {
    const { userId, organizationId, departmentId } = req.query as any;

    // Build where clause based on filters
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (organizationId) {
      const user = req.user;
      // For owners, allow access to disabled organizations
      const isOwner = user.role === "OWNER";
      if (isOwner) {
        where.department = { organizationId };
      } else {
        where.department = { organizationId, organization: { enabled: true } };
      }
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
