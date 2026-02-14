import type { FastifyPluginAsync } from "fastify";
import prisma from "@booking-for-all/db";
import { requireAuthHook, orgGuard } from "../../plugins/authz";

const departmentsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/departments?organizationId=xxx
  app.get("/", { 
    preValidation: [requireAuthHook, orgGuard] 
  }, async (req, reply) => {
    try {
      // Organization context is now available from orgGuard
      const organization = req.organization;
      if (!organization) {
        return reply.status(400).send({ error: "Organization context required" });
      }

      // For owners, allow access even if organization is disabled
      const isOwner = organization.role === "OWNER";

      // Build where clause - owners can see disabled orgs, others can't
      const where: any = { organizationId: organization.id };
      if (!isOwner) {
        where.organization = { enabled: true };
      }

      const departments = await prisma.department.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              providers: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      reply.send(departments);
    } catch (error) {
      app.log.error(error, "Error fetching departments");
      reply.status(500).send({ error: "Failed to fetch departments" });
    }
  });

  // Note: POST and DELETE mutations have been moved to /api/owner/departments/*
};

export default departmentsRoutes;
