import type { FastifyPluginAsync } from "fastify";
import prisma from "@booking-for-all/db";
import { requireAuthHook, requireOwnerHook } from "../../plugins/authz";
import {
  tryEnableOrganization,
  checkAndDisableOrganization,
  hasActiveSubscription,
} from "../../utils/organization-utils";
import { AppError } from "../../errors/AppError";
import crypto from "crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

const CreateProviderUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  organizationId: z.string().min(1, "Organization ID is required"),
  departmentId: z.string().min(1, "Department ID is required"),
  bio: z.string().optional(),
  specialization: z.string().optional(),
});

const ownerRoutes: FastifyPluginAsync = async (app) => {
  // ============ PROVIDER MANAGEMENT ============
  // POST /api/owner/providers/create-user - Create provider with user account
  app.post(
    "/providers/create-user",
    {
      preValidation: [requireAuthHook, requireOwnerHook],
      schema: {
        body: CreateProviderUserSchema,
      },
    },
    async (req, reply) => {
      const owner = req.user;
      const body = CreateProviderUserSchema.parse(req.body);
      const { name, email, organizationId, departmentId, bio, specialization } =
        body;

      // Verify owner is a member of the organization
      const member = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: owner.id,
          },
        },
      });

      if (!member) {
        throw new AppError(
          "You are not a member of this organization",
          "NOT_ORG_MEMBER",
          403
        );
      }

      // Check if organization has active subscription
      const hasSubscription = await hasActiveSubscription(organizationId);
      if (!hasSubscription) {
        throw new AppError(
          "A valid subscription is required to create providers. Please subscribe to continue.",
          "NO_SUBSCRIPTION",
          403
        );
      }

      // Verify department belongs to organization
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        include: {
          organization: {
            select: {
              slug: true,
            },
          },
        },
      });

      if (!department || department.organizationId !== organizationId) {
        throw new AppError(
          "Department not found or does not belong to this organization",
          "DEPARTMENT_NOT_FOUND",
          404
        );
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new AppError(
          "User with this email already exists",
          "USER_EXISTS",
          409
        );
      }

      // Create user with temporary password
      const tempPassword = "password123";
      const hashedPassword = await hashPassword(tempPassword);

      const user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          name,
          email,
          emailVerified: true,
          role: "PROVIDER",
          needsPasswordChange: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create account with password
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

      // Create provider record
      const provider = await prisma.provider.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          departmentId,
          bio: bio || null,
          specialization: specialization || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          department: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      // Add provider as member of the organization
      await prisma.member.create({
        data: {
          id: crypto.randomUUID(),
          organizationId,
          userId: user.id,
          email: user.email,
          createdAt: new Date(),
        },
      });

      // Try to enable organization if all conditions are now met
      // if (provider.department?.organizationId) {
      //   await tryEnableOrganization(provider.department.organizationId);
      // }

      // Send welcome email
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail =
          process.env.RESEND_FROM_EMAIL || "support@tanarock.hu";

        // Build external HTML page URL using organization slug
        const phpServerUrl =
          process.env.PHP_SERVER_URL || "http://localhost:8000";
        const orgSlug = (department as any).organization?.slug || "wellness"; // fallback to wellness
        const loginUrl = `${phpServerUrl}/${orgSlug}_external.html`;

        // Get language preference (default to "en", can be enhanced with user preference)
        const lang = req.language || "en";

        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: app.t("emails.provider.subject", { lng: lang }),
          html: `
            <h2>${app.t("emails.provider.greeting", { lng: lang })}</h2>
            <p>${app.t("emails.provider.dear", { lng: lang, name })}</p>
            <p>${app.t("emails.provider.accountCreated", { lng: lang })}</p>
            
            <h3>${app.t("emails.provider.accountDetails", { lng: lang })}</h3>
            <ul>
              <li><strong>${app.t("emails.provider.email", { lng: lang })}</strong> ${email}</li>
              <li><strong>${app.t("emails.provider.temporaryPassword", { lng: lang })}</strong> ${tempPassword}</li>
              <li><strong>${app.t("emails.provider.role", { lng: lang })}</strong> ${app.t("emails.provider.provider", { lng: lang })}</li>
            </ul>
            
            <p><strong>${app.t("emails.provider.important", { lng: lang })}</strong> ${app.t("emails.provider.changePassword", { lng: lang })}</p>
            
            <p>${app.t("emails.provider.accessBookingApp", { lng: lang })}</p>
            <p>
              <a href="${loginUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
                ${app.t("emails.provider.accessApp", { lng: lang })}
              </a>
            </p>
            
            <p>${app.t("emails.provider.orCopyPaste", { lng: lang })}</p>
            <p><a href="${loginUrl}">${loginUrl}</a></p>
            
            <p>${app.t("emails.provider.afterLogin", { lng: lang })}</p>
            <p><strong>${app.t("emails.provider.note", { lng: lang })}</strong> ${app.t("emails.provider.mustAccessThroughLink", { lng: lang })}</p>
            
            <p>${app.t("emails.provider.bestRegards", { lng: lang })}<br>${app.t("emails.provider.adminTeam", { lng: lang })}</p>
          `,
        });

        app.log.info(`📧 Welcome email sent to provider: ${email}`);
      } catch (emailError) {
        app.log.error(emailError, "❌ Failed to send welcome email");
        // Continue - provider and user are still created
      }

      reply.code(201).send({
        success: true,
        data: {
          provider: {
            id: provider.id,
            userId: user.id,
            departmentId: provider.departmentId,
          },
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
          tempPassword,
        },
      });
    }
  );

  // POST /api/owner/providers - Create provider record (for existing users)
  // app.post(
  //   "/providers",
  //   { preValidation: [requireAuthHook] }, // We verify owner role and membership in the handler
  //   async (req, reply) => {
  //     try {
  //       const data = (req.body as any) || {};
  //       const { userId, departmentId } = data;

  //       const user = req.user;

  //       // Verify user has OWNER role
  //       if (user.role !== "OWNER") {
  //         return reply
  //           .status(403)
  //           .send({ error: "Forbidden - Owner access required" });
  //       }

  //       // Verify owner is a member of the organization
  //       const department = await prisma.department.findUnique({
  //         where: { id: departmentId },
  //         include: {
  //           organization: true,
  //         },
  //       });

  //       if (!department) {
  //         return reply.status(404).send({ error: "Department not found" });
  //       }

  //       const member = await prisma.member.findUnique({
  //         where: {
  //           organizationId_userId: {
  //             organizationId: department.organizationId,
  //             userId: user.id,
  //           },
  //         },
  //       });

  //       if (!member) {
  //         return reply
  //           .status(403)
  //           .send({ error: "You are not a member of this organization" });
  //       }

  //       // Check if organization has active subscription
  //       const hasSubscription = await hasActiveSubscription(
  //         department.organizationId
  //       );
  //       if (!hasSubscription) {
  //         return reply.status(403).send({
  //           error:
  //             "A valid subscription is required to create providers. Please subscribe to continue.",
  //         });
  //       }

  //       const provider = await prisma.provider.create({
  //         data: {
  //           id: crypto.randomUUID(),
  //           userId,
  //           departmentId,
  //           bio: data.bio || null,
  //           specialization: data.specialization || null,
  //         },
  //         include: {
  //           department: {
  //             select: {
  //               organizationId: true,
  //             },
  //           },
  //         },
  //       });

  //       // Try to enable organization if all conditions are now met
  //       if (provider.department?.organizationId) {
  //         await tryEnableOrganization(provider.department.organizationId);
  //       }

  //       reply.code(201).send(provider);
  //     } catch (error) {
  //       app.log.error(error, "Error creating provider record");
  //       reply.status(500).send({ error: "Failed to create provider record" });
  //     }
  //   }
  // );

  // DELETE /api/owner/providers/:id - Delete provider
  app.delete(
    "/providers/:id",
    { preValidation: [requireAuthHook, requireOwnerHook] },
    async (req, reply) => {
      const { id } = req.params as any;
      const user = req.user;

      const provider = await prisma.provider.findUnique({
        where: { id },
        include: {
          department: {
            select: {
              organizationId: true,
            },
          },
          user: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!provider) {
        throw new AppError("Provider not found", "PROVIDER_NOT_FOUND", 404);
      }

      const organizationId = provider.department?.organizationId;

      // Verify owner is a member of the organization
      if (organizationId) {
        const member = await prisma.member.findUnique({
          where: {
            organizationId_userId: {
              organizationId,
              userId: user.id,
            },
          },
        });

        if (!member) {
          throw new AppError(
            "You are not a member of this organization",
            "NOT_ORG_MEMBER",
            403
          );
        }
      }

      const userId = provider.userId;

      // Delete provider record
      await prisma.provider.delete({
        where: { id },
      });

      // Remove provider from organization members if exists
      if (organizationId && userId) {
        await prisma.member.deleteMany({
          where: {
            organizationId,
            userId,
          },
        });
      }

      // Check if organization should be disabled (no departments or providers left)
      if (organizationId) {
        await checkAndDisableOrganization(organizationId);
      }

      reply.send({ success: true });
    }
  );

  // ============ DEPARTMENT MANAGEMENT ============
  // POST /api/owner/departments - Create department
  app.post(
    "/departments",
    { preValidation: [requireAuthHook, requireOwnerHook] },
    async (req, reply) => {
      const { name, description, organizationId } = req.body as any;

      // Validate required fields first
      if (!name || !organizationId) {
        throw new AppError(
          "Name and organizationId are required",
          "VALIDATION_ERROR",
          400
        );
      }

      const user = req.user;

      // Normalize organizationId to prevent whitespace issues
      const normalizedOrgId = String(organizationId).trim();
      if (!normalizedOrgId) {
        throw new AppError(
          "Organization ID cannot be empty",
          "VALIDATION_ERROR",
          400
        );
      }

      // CRITICAL SECURITY CHECK: Verify user is a member of the organization
      // This check MUST happen before any other operations to prevent unauthorized department creation
      // Note: requireOwnerHook already checks this, but we verify again here as a defense-in-depth measure
      const member = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId: normalizedOrgId,
            userId: user.id,
          },
        },
      });

      if (!member) {
        throw new AppError(
          "You are not a member of this organization",
          "NOT_ORG_MEMBER",
          403
        );
      }

      // Check if organization is enabled (owners can create departments even if disabled)
      const organization = await prisma.organization.findUnique({
        where: { id: normalizedOrgId },
      });

      if (!organization) {
        throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
      }

      // Check if organization has active subscription
      const hasSubscription = await hasActiveSubscription(normalizedOrgId);
      if (!hasSubscription) {
        throw new AppError(
          "A valid subscription is required to create departments. Please subscribe to continue.",
          "NO_SUBSCRIPTION",
          403
        );
      }

      const department = await prisma.department.create({
        data: {
          id: crypto.randomUUID(),
          name,
          description: description || null,
          organizationId: normalizedOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Try to enable organization if all conditions are now met
      await tryEnableOrganization(normalizedOrgId);

      reply.code(201).send({
        success: true,
        data: department,
      });
    }
  );

  // DELETE /api/owner/departments/:id - Delete department
  app.delete(
    "/departments/:id",
    { preValidation: [requireAuthHook, requireOwnerHook] },
    async (req, reply) => {
      const { id } = req.params as any;

      const user = req.user;

      const department = await prisma.department.findUnique({
        where: { id },
        include: {
          organization: true,
        },
      });

      if (!department) {
        throw new AppError("Department not found", "DEPARTMENT_NOT_FOUND", 404);
      }

      // Verify user is owner and member of organization
      const member = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId: department.organizationId,
            userId: user.id,
          },
        },
      });

      if (!member) {
        throw new AppError(
          "You are not a member of this organization",
          "NOT_ORG_MEMBER",
          403
        );
      }

      const organizationId = department.organizationId;

      await prisma.department.delete({
        where: { id },
      });

      // Check if organization should be disabled (no departments or providers left)
      await checkAndDisableOrganization(organizationId);

      reply.send({ success: true });
    }
  );
};

export default ownerRoutes;
