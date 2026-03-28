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
  domain: z.string().min(1, "Domain is required"), // Required and unique
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

const DeleteOrganizationParamsSchema = z.object({
  id: z.string().min(1, "id is required"),
});

const UpdateOrganizationParamsSchema = z.object({
  id: z.string().min(1, "id is required"),
});

const UpdateOrganizationBodySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens").optional(),
  domain: z.string().min(1).optional(),
  logo: z.string().url().optional().or(z.literal("")),
});

const SuspendOrganizationParamsSchema = z.object({
  id: z.string().min(1, "id is required"),
});

const SuspendOrganizationBodySchema = z.object({
  suspend: z.boolean(),
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
          domain: true,
          enabled: true,
          status: true,
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
      const { name, slug, domain, ownerName, ownerEmail } = req.body;

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

        // Check if domain already exists (domain is required and must be unique)
        const normalizedDomain = domain.toLowerCase().trim();
        const existingDomain = await prisma.organization.findUnique({
          where: { domain: normalizedDomain },
        });
        if (existingDomain) {
          throw new AppError(
            "Organization domain already exists",
            "ORG_DOMAIN_EXISTS",
            400
          );
        }

        // Create owner user with temporary password
        const tempPassword = "ownerpass321";
        const hashedPassword = await hashPassword(tempPassword);

        const { organization, ownerUser } = await prisma.$transaction(async (tx) => {
          // Create organization with domain
          const org = await tx.organization.create({
            data: {
              id: crypto.randomUUID(),
              name,
              slug: normalizedSlug,
              domain: normalizedDomain,
              enabled: false,
              status: "PENDING",
              createdAt: new Date(),
            },
          });

          const user = await tx.user.create({
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
          await tx.account.create({
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

          // Add user as member (owner) of the organization
          await tx.member.create({
            data: {
              id: crypto.randomUUID(),
              organizationId: org.id,
              userId: user.id,
              email: user.email,
              role: "OWNER",
              authMethod: "credential",
              createdAt: new Date(),
            },
          });

          return { organization: org, ownerUser: user };
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
        }

        // Send email to owner with login link
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          const fromEmail =
            process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

          const phpServerUrl =
            process.env.PHP_SERVER_URL || "http://localhost:8000";
          const externalPageUrl = `${phpServerUrl}/${normalizedSlug}_external.html`;

          const frontendUrl =
            process.env.CORS_ORIGIN ||
            process.env.FRONTEND_URL ||
            "http://localhost:3001";
          const loginUrl = `${frontendUrl}/login`;

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

  app.patch(
    "/organizations/:id",
    {
      preValidation: [requireAuthHook, requireAdminHook],
      schema: {
        params: UpdateOrganizationParamsSchema,
        body: UpdateOrganizationBodySchema,
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { name, slug, domain, logo } = req.body;

      const organization = await prisma.organization.findUnique({ where: { id } });
      if (!organization) {
        throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
      }

      // Check slug uniqueness (exclude self)
      if (slug && slug !== organization.slug) {
        const slugConflict = await prisma.organization.findUnique({ where: { slug } });
        if (slugConflict) {
          throw new AppError("Organization slug already exists", "ORG_SLUG_EXISTS", 400);
        }
      }

      // Check domain uniqueness (exclude self)
      if (domain && domain !== organization.domain) {
        const normalizedDomain = domain.toLowerCase().trim();
        const domainConflict = await prisma.organization.findUnique({ where: { domain: normalizedDomain } });
        if (domainConflict) {
          throw new AppError("Organization domain already exists", "ORG_DOMAIN_EXISTS", 400);
        }
      }

      const updated = await prisma.organization.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(slug !== undefined && { slug }),
          ...(domain !== undefined && { domain: domain.toLowerCase().trim() }),
          ...(logo !== undefined && { logo: logo || null }),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          domain: true,
          enabled: true,
          status: true,
          createdAt: true,
        },
      });

      reply.send({ success: true, data: updated });
    }
  );

  app.patch(
    "/organizations/:id/suspend",
    {
      preValidation: [requireAuthHook, requireAdminHook],
      schema: {
        params: SuspendOrganizationParamsSchema,
        body: SuspendOrganizationBodySchema,
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const { suspend } = req.body;

      const organization = await prisma.organization.findUnique({ where: { id } });
      if (!organization) {
        throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
      }

      let updated;
      if (suspend) {
        // Store previous status in metadata for restore on unsuspend
        const currentMeta = organization.metadata ? JSON.parse(organization.metadata) : {};
        const updatedMeta = { ...currentMeta, previousStatus: organization.status };

        updated = await prisma.organization.update({
          where: { id },
          data: {
            status: "SUSPENDED",
            enabled: false,
            metadata: JSON.stringify(updatedMeta),
          },
          select: {
            id: true,
            name: true,
            slug: true,
            domain: true,
            enabled: true,
            status: true,
            createdAt: true,
          },
        });
      } else {
        // Restore previous status
        const currentMeta = organization.metadata ? JSON.parse(organization.metadata) : {};
        const previousStatus = currentMeta.previousStatus as string | undefined;
        const restoredStatus = (previousStatus && previousStatus !== "SUSPENDED")
          ? previousStatus
          : "PENDING";
        const restoredEnabled = restoredStatus === "SUBSCRIBED" ? organization.enabled : false;

        // Clean previousStatus from metadata
        const { previousStatus: _removed, ...restMeta } = currentMeta;

        updated = await prisma.organization.update({
          where: { id },
          data: {
            status: restoredStatus as any,
            enabled: restoredEnabled,
            metadata: JSON.stringify(restMeta),
          },
          select: {
            id: true,
            name: true,
            slug: true,
            domain: true,
            enabled: true,
            status: true,
            createdAt: true,
          },
        });
      }

      reply.send({ success: true, data: updated });
    }
  );

  app.delete(
    "/organizations/:id",
    {
      preValidation: [requireAuthHook, requireAdminHook],
      schema: {
        params: DeleteOrganizationParamsSchema,
      },
    },
    async (req, reply) => {
      try {
        const { id } = req.params;

        const organization = await prisma.organization.findUnique({
          where: { id },
        });

        if (!organization) {
          throw new AppError(
            "Organization not found",
            "ORG_NOT_FOUND",
            404
          );
        }

        // Only allow deletion of organizations with PENDING status
        if ((organization as any).status !== "PENDING") {
          throw new AppError(
            "Only organizations with pending status can be deleted",
            "ORG_CANNOT_DELETE_ACTIVE",
            403
          );
        }

        await prisma.organization.delete({
          where: { id },
        });

        return reply.send({
          success: true,
          message: "Organization deleted successfully",
        });
      } catch (error) {
        if (error.isAppError) {
          throw error;
        }
        app.log.error(error, "Error deleting organization");
        throw new AppError(
          "Failed to delete organization",
          "DELETE_ORG_FAILED",
          500
        );
      }
    }
  );

  app.get(
    "/api-keys",
    { preValidation: [requireAuthHook, requireAdminHook] },
    async (_req, reply) => {
      const keys = await prisma.apikey.findMany({
        include: {
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
            key,
            enabled: true,
            expiresAt,
            metadata: JSON.stringify({ organizationId, name }),
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
        const { id } = req.params;

        const result = (await prisma.apikey.updateMany({
          where: { id },
          data: { enabled: false },
        } as any)) as any;
        if (result.count && result.count > 0) {
          return reply.send({ success: true });
        }
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
