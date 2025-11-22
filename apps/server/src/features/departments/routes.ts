import type { FastifyPluginAsync } from "fastify";
import prisma from "@booking-for-all/db";
import { requireAuthHook } from "../../plugins/authz";

const departmentsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/departments?organizationId=xxx
  app.get("/", { preValidation: [requireAuthHook] }, async (req, reply) => {
    try {
      const { organizationId } = req.query as any;

      if (!organizationId) {
        return reply
          .status(400)
          .send({ error: "organizationId query parameter is required" });
      }

      const user = req.user;

      // For owners, allow access even if organization is disabled
      const isOwner = user.role === "OWNER";

      // Build where clause - owners can see disabled orgs, others can't
      const where: any = { organizationId };
      if (!isOwner) {
        where.organization = { enabled: true };
      }

      // Verify user has access to this organization
      if (!isOwner) {
        const member = await prisma.member.findUnique({
          where: {
            organizationId_userId: {
              organizationId,
              userId: user.id,
            },
          },
        });
        if (!member) {
          return reply
            .status(403)
            .send({ error: "You do not have access to this organization" });
        }
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
