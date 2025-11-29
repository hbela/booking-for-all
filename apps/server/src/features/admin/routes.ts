import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import prisma from "@booking-for-all/db";
import crypto from "crypto";
import { hashPassword } from "better-auth/crypto";
import { requireAuthHook, requireAdminHook } from "../../plugins/authz";
import { AppError } from "../../errors/AppError";

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
      reply.send({
        success: true,
        data: orgs,
      });
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
      // ✅ req.body is typed as { name: string; slug?: string; ownerName: string; ownerEmail: string }
      const { name, slug, ownerName, ownerEmail } = req.body;

        // Check if owner email already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: ownerEmail },
        });
        if (existingUser) {
          throw new AppError(
            "A user with this email already exists",
            "USER_EXISTS",
            400
          );
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
          throw new AppError(
            "Organization slug already exists",
            "ORG_SLUG_EXISTS",
            400
          );
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

        // Auto-generate QR code for the organization
        try {
          const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
          const QRCode = await import("qrcode");
          
          const cfg = (app as any).config as any;
          const s3 = new S3Client({
            region: cfg.S3_REGION || process.env.S3_REGION || "us-east-1",
            endpoint: cfg.S3_ENDPOINT || process.env.S3_ENDPOINT,
            forcePathStyle: false,
            credentials: {
              accessKeyId: cfg.S3_ACCESS_KEY || process.env.S3_ACCESS_KEY || "",
              secretAccessKey: cfg.S3_SECRET_KEY || process.env.S3_SECRET_KEY || "",
            },
          });

          const bucket = cfg.S3_BUCKET || process.env.S3_BUCKET || "";
          const publicAppUrl = cfg.PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || cfg.CORS_ORIGIN || process.env.CORS_ORIGIN || "";

          if (bucket && publicAppUrl) {
            const qrData = `${publicAppUrl}/org/${organization.id}/app`;
            const pngBuffer = await QRCode.default.toBuffer(qrData, {
              errorCorrectionLevel: "H",
              type: "png",
              width: 600,
            });

            const key = `orgs/${organization.id}/qr.png`;

            await s3.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: pngBuffer,
                ContentType: "image/png",
              })
            );

            await prisma.organization.update({
              where: { id: organization.id },
              data: { qrCodeKey: key },
            });

            app.log.info(`✅ QR code generated for organization: ${organization.id}`);
          } else {
            app.log.warn("⚠️ S3 configuration missing, skipping QR code generation");
          }
        } catch (qrError) {
          app.log.error(qrError, "❌ Failed to generate QR code for organization");
          // Continue - organization is still created, QR code can be generated later
        }

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

          // Get language preference (default to "en", can be enhanced with user preference)
          const lang = req.language || "en";

          await resend.emails.send({
            from: fromEmail,
            to: ownerEmail,
            subject: app.t("emails.organizationOwner.subject", { 
              lng: lang,
              organizationName: name 
            }),
            html: `
              <h2>${app.t("emails.organizationOwner.greeting", { lng: lang, organizationName: name })}</h2>
              <p>${app.t("emails.organizationOwner.dear", { lng: lang, name: ownerName })}</p>
              <p>${app.t("emails.organizationOwner.organizationCreated", { lng: lang, organizationName: name })}</p>
              
              <h3>${app.t("emails.organizationOwner.accountDetails", { lng: lang })}</h3>
              <ul>
                <li><strong>${app.t("emails.organizationOwner.email", { lng: lang })}</strong> ${ownerEmail}</li>
                <li><strong>${app.t("emails.organizationOwner.temporaryPassword", { lng: lang })}</strong> ${tempPassword}</li>
                <li><strong>${app.t("emails.organizationOwner.role", { lng: lang })}</strong> ${app.t("emails.organizationOwner.owner", { lng: lang })}</li>
              </ul>
              
              <p><strong>${app.t("emails.organizationOwner.important", { lng: lang })}</strong> ${app.t("emails.organizationOwner.changePassword", { lng: lang })}</p>
              
              <h3>${app.t("emails.organizationOwner.accessOrganization", { lng: lang })}</h3>
              <p>${app.t("emails.organizationOwner.clickButton", { lng: lang })}</p>
              
              <p>
                <a href="${externalPageUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
                  ${app.t("emails.organizationOwner.accessPortal", { lng: lang })}
                </a>
              </p>
              
              <p>${app.t("emails.organizationOwner.orCopyPaste", { lng: lang })}</p>
              <p><a href="${externalPageUrl}">${externalPageUrl}</a></p>
              
              <p>${app.t("emails.organizationOwner.afterLogin", { lng: lang })}</p>
              
              <p>${app.t("emails.organizationOwner.bestRegards", { lng: lang })}<br>${app.t("emails.organizationOwner.adminTeam", { lng: lang })}</p>
            `,
          });

          console.log(`📧 Welcome email sent to owner: ${ownerEmail}`);
        } catch (emailError) {
          console.error("❌ Failed to send welcome email:", emailError);
          // Continue - organization and user are still created
        }

      reply.code(201).send({
        success: true,
        data: {
          organization,
          owner: {
            id: ownerUser.id,
            name: ownerUser.name,
            email: ownerUser.email,
          },
          message:
            "Organization created successfully. Owner account created and welcome email sent.",
        },
      });
    }
  );
  app.get(
    "/api-keys",
    { preValidation: [requireAuthHook, requireAdminHook] },
    async (_req, reply) => {
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

      reply.send({
        success: true,
        data: shaped,
      });
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

        reply.code(201).send({
          success: true,
          data: { id: created.id, key },
        });
      } catch (error) {
        app.log.error(error, "Error generating API key");
        throw new AppError(
          "Failed to generate API key",
          "GENERATE_API_KEY_FAILED",
          500
        );
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
        throw new AppError("API key not found", "API_KEY_NOT_FOUND", 404);
      } catch (error) {
        if (error.isAppError) {
          throw error;
        }
        app.log.error(error, "Error revoking API key");
        throw new AppError(
          "Failed to revoke API key",
          "REVOKE_API_KEY_FAILED",
          500
        );
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
          throw new AppError(
            "User with this email already exists",
            "USER_EXISTS",
            400
          );
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

        return reply.code(201).send({
          success: true,
          data: { user, tempPassword },
        });
      } catch (error) {
        if (error.isAppError) {
          throw error;
        }
        app.log.error(error, "Error creating admin user");
        throw new AppError("Failed to create user", "CREATE_USER_FAILED", 500);
      }
    }
  );
};

export default adminRoutes;
