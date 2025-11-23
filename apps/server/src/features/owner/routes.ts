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

        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: "Welcome as a Provider - Your Account Created",
          html: `
            <h2>Welcome as a Provider!</h2>
            <p>Dear ${name},</p>
            <p>Your provider account has been created successfully by the organization owner.</p>
            
            <h3>Your Account Details:</h3>
            <ul>
              <li><strong>Email:</strong> ${email}</li>
              <li><strong>Temporary Password:</strong> ${tempPassword}</li>
              <li><strong>Role:</strong> Provider</li>
            </ul>
            
            <p><strong>⚠️ IMPORTANT:</strong> You must change your password on first login.</p>
            
            <p>Please access the booking app through your organization's website:</p>
            <p>
              <a href="${loginUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
                Access Booking App
              </a>
            </p>
            
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${loginUrl}">${loginUrl}</a></p>
            
            <p>After logging in, you will be prompted to change your password for security.</p>
            <p><strong>Note:</strong> You must access the system through your organization's website link above.</p>
            
            <p>Best regards,<br>Administration Team</p>
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

      if (!name || !organizationId) {
        throw new AppError(
          "Name and organizationId are required",
          "VALIDATION_ERROR",
          400
        );
      }

      const user = req.user;

      // Verify user is owner and member of organization
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

      // Check if organization is enabled (owners can create departments even if disabled)
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
      }

      // Check if organization has active subscription
      const hasSubscription = await hasActiveSubscription(organizationId);
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
          organizationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Try to enable organization if all conditions are now met
      await tryEnableOrganization(organizationId);

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
