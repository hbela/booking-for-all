import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import prisma from "@booking-for-all/db";
import crypto from "crypto";
import { hashPassword } from "better-auth/crypto";
import { requireAuthHook, requireAdminHook } from "../../plugins/authz";

// Zod Schemas
const CreateOrganizationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().optional(),
  ownerName: z.string().min(1, "Owner name is required"),
  ownerEmail: z.string().email("Invalid owner email address"),
});

const GenerateApiKeySchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
  name: z.string().min(1, "name is required"),
  expiresInDays: z.number().int().positive().optional(),
});

const DeleteApiKeyParamsSchema = z.object({
  id: z.string().min(1, "id is required"),
});

const CreateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z
    .enum(["ADMIN", "OWNER", "PROVIDER", "CLIENT", "USER"])
    .optional()
    .default("USER"),
});

const adminRoutes: FastifyPluginAsyncZod = async (app) => {
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
    {
      preValidation: [requireAuthHook, requireAdminHook],
      schema: {
        body: CreateOrganizationSchema,
      },
    },
    async (req, reply) => {
      try {
        // ✅ req.body is typed as { name: string; slug?: string; ownerName: string; ownerEmail: string }
        const { name, slug, ownerName, ownerEmail } = req.body;

        // Check if owner email already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: ownerEmail },
        });
        if (existingUser) {
          return reply
            .status(400)
            .send({ error: "A user with this email already exists" });
        }

        const normalizedSlug = (slug || name)
          .toString()
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        const existingOrg = await prisma.organization.findUnique({
          where: { slug: normalizedSlug },
        });
        if (existingOrg) {
          return reply
            .status(400)
            .send({ error: "Organization slug already exists" });
        }

        // Create organization
        const organization = await prisma.organization.create({
          data: {
            id: crypto.randomUUID(),
            name,
            slug: normalizedSlug,
            enabled: false,
            createdAt: new Date(),
          },
        });

        // Create owner user with temporary password
        const tempPassword = "ownerpass321";
        const hashedPassword = await hashPassword(tempPassword);

        const ownerUser = await prisma.user.create({
          data: {
            id: crypto.randomUUID(),
            name: ownerName,
            email: ownerEmail,
            emailVerified: true,
            role: "OWNER",
            needsPasswordChange: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Create account with password
        await prisma.account.create({
          data: {
            id: crypto.randomUUID(),
            userId: ownerUser.id,
            providerId: "credential",
            accountId: ownerUser.email,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Add user as member (owner) of the organization
        await prisma.member.create({
          data: {
            id: crypto.randomUUID(),
            organizationId: organization.id,
            userId: ownerUser.id,
            email: ownerUser.email,
            createdAt: new Date(),
          },
        });

        // Send email to owner with login link
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          const fromEmail =
            process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
          
          // Build external HTML page URL (e.g., http://localhost:8000/medicare_external.html)
          const phpServerUrl =
            process.env.PHP_SERVER_URL || "http://localhost:8000";
          const externalPageUrl = `${phpServerUrl}/${normalizedSlug}_external.html`;
          
          // Also provide direct dashboard link as fallback
          const frontendUrl =
            process.env.CORS_ORIGIN ||
            process.env.FRONTEND_URL ||
            "http://localhost:3001";
          const loginUrl = `${frontendUrl}/login`;

          await resend.emails.send({
            from: fromEmail,
            to: ownerEmail,
            subject: `Welcome to ${name} - Your Organization Dashboard`,
            html: `
              <h2>Welcome to ${name}!</h2>
              <p>Dear ${ownerName},</p>
              <p>Your organization <strong>${name}</strong> has been created successfully, and you have been set up as the owner.</p>
              
              <h3>Your Account Details:</h3>
              <ul>
                <li><strong>Email:</strong> ${ownerEmail}</li>
                <li><strong>Temporary Password:</strong> ${tempPassword}</li>
                <li><strong>Role:</strong> Owner</li>
              </ul>
              
              <p><strong>⚠️ IMPORTANT:</strong> You must change your password on first login.</p>
              
              <h3>Access Your Organization:</h3>
              <p>Click the button below to access your organization's portal:</p>
              
              <p>
                <a href="${externalPageUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
                  Access Your Organization Portal
                </a>
              </p>
              
              <p>Or copy and paste this link into your browser:</p>
              <p><a href="${externalPageUrl}">${externalPageUrl}</a></p>
              
              <p>After logging in, you will be prompted to change your password for security.</p>
              
              <p>Best regards,<br>Administration Team</p>
            `,
          });

          console.log(`📧 Welcome email sent to owner: ${ownerEmail}`);
        } catch (emailError) {
          console.error("❌ Failed to send welcome email:", emailError);
          // Continue - organization and user are still created
        }

        reply.send({
          organization,
          owner: {
            id: ownerUser.id,
            name: ownerUser.name,
            email: ownerUser.email,
          },
          message:
            "Organization created successfully. Owner account created and welcome email sent.",
        });
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
    {
      preValidation: [requireAuthHook, requireAdminHook],
      schema: {
        body: GenerateApiKeySchema,
      },
    },
    async (req, reply) => {
      try {
        // ✅ req.body is typed as { organizationId: string; name: string; expiresInDays?: number }
        const { organizationId, name, expiresInDays } = req.body;

        // @ts-ignore
        const user = req.user;
        const key = crypto.randomUUID().replace(/-/g, "");
        const expiresAt = expiresInDays
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
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
        });

        reply.send({ id: created.id, key });
      } catch (error) {
        app.log.error(error, "Error generating API key");
        reply.status(500).send({ error: "Failed to generate API key" });
      }
    }
  );

  app.delete(
    "/api-keys/:id",
    {
      preValidation: [requireAuthHook, requireAdminHook],
      schema: {
        params: DeleteApiKeyParamsSchema,
      },
    },
    async (req, reply) => {
      try {
        // ✅ req.params is typed as { id: string }
        const { id } = req.params;

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
    {
      preValidation: [requireAuthHook, requireAdminHook],
      schema: {
        body: CreateUserSchema,
      },
    },
    async (req, reply) => {
      try {
        // ✅ req.body is typed as { name: string; email: string; role?: "ADMIN" | "OWNER" | "PROVIDER" | "CLIENT" | "USER" }
        const { name, email, role } = req.body;

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
            providerId: "credential",
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
