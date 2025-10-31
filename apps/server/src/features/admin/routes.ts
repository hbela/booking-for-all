import type { FastifyPluginAsync } from "fastify";
import prisma from "@my-better-t-app/db";
import crypto from "crypto";
import { hashPassword } from "better-auth/crypto";
import { requireAuthHook, requireAdminHook } from "../../plugins/authz";

const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/organizations",
    { preValidation: [requireAuthHook, requireAdminHook] },
    async (_req, reply) => {
      try {
        const orgs = await prisma.organization.findMany({
          select: {
            id: true,
            name: true,
            slug: true,
            enabled: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });
        reply.send(orgs);
      } catch (error) {
        app.log.error(error, "Error fetching organizations");
        reply.status(500).send({ error: "Failed to fetch organizations" });
      }
    }
  );

  app.post(
    "/organizations/create",
    { preValidation: [requireAuthHook, requireAdminHook] },
    async (req, reply) => {
      try {
        const { name, slug } = (req.body as any) || {};
        if (!name) {
          return reply.status(400).send({ error: "Name is required" });
        }
        const normalizedSlug = (slug || name)
          .toString()
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        const existing = await prisma.organization.findUnique({
          where: { slug: normalizedSlug },
        } as any);
        if (existing) {
          return reply
            .status(400)
            .send({ error: "Organization slug already exists" });
        }

        const organization = await prisma.organization.create({
          data: {
            id: crypto.randomUUID(),
            name,
            slug: normalizedSlug,
            enabled: false,
            createdAt: new Date(),
          },
        } as any);

        reply.send(organization);
      } catch (error) {
        app.log.error(error, "Error creating organization");
        reply.status(500).send({ error: "Failed to create organization" });
      }
    }
  );
  app.get(
    "/api-keys",
    { preValidation: [requireAuthHook, requireAdminHook] },
    async (_req, reply) => {
      try {
        const keys = await prisma.apikey.findMany({
          include: {
            // best-effort include for creator user; ignore if relation differs
            // @ts-ignore
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
        } as any);

        const shaped = (keys as any[]).map((k) => ({
          id: k.id,
          name: k.name ?? "API Key",
          prefix:
            k.prefix ??
            (typeof k.key === "string" ? String(k.key).slice(0, 4) : ""),
          metadata:
            typeof k.metadata === "string"
              ? k.metadata
              : JSON.stringify(k.metadata ?? {}),
          userId: k.userId ?? k.user?.id ?? "",
          user: {
            id: k.user?.id ?? "",
            name: k.user?.name ?? "Unknown",
            email: k.user?.email ?? "",
          },
          createdAt: k.createdAt,
          expiresAt: k.expiresAt ?? null,
          lastRequest: k.lastRequest ?? null,
          enabled: k.enabled ?? true,
          remaining: k.remaining ?? null,
          requestCount: k.requestCount ?? 0,
        }));

        reply.send(shaped);
      } catch (error) {
        app.log.error(error, "Error fetching API keys");
        reply.status(500).send({ error: "Failed to fetch API keys" });
      }
    }
  );

  app.post(
    "/api-keys/generate",
    { preValidation: [requireAuthHook, requireAdminHook] },
    async (req, reply) => {
      try {
        const { organizationId, name, expiresInDays } = (req.body as any) || {};
        if (!organizationId || !name) {
          return reply
            .status(400)
            .send({ error: "organizationId and name are required" });
        }
        // @ts-ignore
        const user = req.user;
        const key = crypto.randomUUID().replace(/-/g, "");
        const expiresAt = expiresInDays
          ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
          : null;

        const created = await prisma.apikey.create({
          data: {
            id: crypto.randomUUID(),
            // minimal fields known to exist from existing code (validateApiKey)
            key,
            enabled: true,
            expiresAt,
            metadata: JSON.stringify({ organizationId, name }),
            // link to creator user (required by schema)
            user: {
              connect: { id: user.id },
            },
          },
        } as any);

        reply.send({ id: created.id, key });
      } catch (error) {
        app.log.error(error, "Error generating API key");
        reply.status(500).send({ error: "Failed to generate API key" });
      }
    }
  );

  app.delete(
    "/api-keys/:id",
    { preValidation: [requireAuthHook, requireAdminHook] },
    async (req, reply) => {
      try {
        const { id } = req.params as any;
        if (!id) return reply.status(400).send({ error: "id required" });
        // Prefer soft-revoke; use updateMany in case id is not the unique field
        const result = (await prisma.apikey.updateMany({
          where: { id },
          data: { enabled: false },
        } as any)) as any;
        if (result.count && result.count > 0) {
          return reply.send({ success: true });
        }
        // Fallback: try by key (if UI passed key as id by mistake)
        const resultByKey = (await prisma.apikey.updateMany({
          where: { key: id },
          data: { enabled: false },
        } as any)) as any;
        if (resultByKey.count && resultByKey.count > 0) {
          return reply.send({ success: true });
        }
        return reply
          .status(404)
          .send({ success: false, error: "API key not found" });
      } catch (error) {
        app.log.error(error, "Error revoking API key");
        reply.status(500).send({ error: "Failed to revoke API key" });
      }
    }
  );

  app.post(
    "/users",
    { preValidation: [requireAuthHook, requireAdminHook] },
    async (req, reply) => {
      try {
        const { name, email, role = "USER" } = (req.body as any) || {};
        if (!name || !email) {
          return reply
            .status(400)
            .send({ error: "Name and email are required" });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          return reply
            .status(400)
            .send({ error: "User with this email already exists" });
        }

        const tempPassword = Math.random().toString(36).slice(-10) + "Aa1!";

        const user = await prisma.user.create({
          data: {
            id: crypto.randomUUID(),
            name,
            email,
            emailVerified: true,
            role: role === "USER" ? "CLIENT" : (role as any),
            needsPasswordChange: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const hashedPassword = await hashPassword(tempPassword);
        await prisma.account.create({
          data: {
            id: crypto.randomUUID(),
            userId: user.id,
            providerId: "credentials",
            accountId: user.email,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        return reply.status(201).send({ user, tempPassword });
      } catch (error) {
        app.log.error(error, "Error creating admin user");
        return reply.status(500).send({ error: "Failed to create user" });
      }
    }
  );
};

export default adminRoutes;
