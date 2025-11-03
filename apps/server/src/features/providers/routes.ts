import type { FastifyPluginAsync } from 'fastify';
import prisma from '@my-better-t-app/db';
import { requireAuthHook, requireOwnerHook, requireProviderHook } from '../../plugins/authz';
import { tryEnableOrganization, checkAndDisableOrganization } from '../../utils/organization-utils';
import crypto from 'crypto';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';

const CreateProviderUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  departmentId: z.string().min(1, 'Department ID is required'),
  bio: z.string().optional(),
  specialization: z.string().optional(),
});

const providersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preValidation: [requireAuthHook] }, async (req, reply) => {
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
      // @ts-expect-error
      const user = req.user;
      // For owners, allow access to disabled organizations
      const isOwner = user.role === 'OWNER';
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
    reply.send(providers);
  });

  app.get('/:id', { preValidation: [requireAuthHook] }, async (req, reply) => {
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
    if (!provider) return reply.status(404).send({ error: 'Provider not found' });
    reply.send(provider);
  });

  // POST /api/providers/create-user - Create provider with user account
  app.post('/create-user', {
    preValidation: [requireAuthHook, requireOwnerHook],
    schema: {
      body: CreateProviderUserSchema,
    },
  }, async (req, reply) => {
    try {
      // @ts-expect-error populated by requireAuthHook
      const owner = req.user;
      const { name, email, organizationId, departmentId, bio, specialization } = req.body;

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
        return reply.status(403).send({ error: 'You are not a member of this organization' });
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
        return reply.status(404).send({ error: 'Department not found or does not belong to this organization' });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return reply.status(400).send({ error: 'User with this email already exists' });
      }

      // Create user with temporary password
      const tempPassword = 'password123';
      const hashedPassword = await hashPassword(tempPassword);

      const user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          name,
          email,
          emailVerified: true,
          role: 'PROVIDER',
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
          providerId: 'credential',
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
      if (provider.department?.organizationId) {
        await tryEnableOrganization(provider.department.organizationId);
      }

      // Send welcome email
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'support@tanarock.hu';
        
        // Build external HTML page URL using organization slug
        const phpServerUrl = process.env.PHP_SERVER_URL || 'http://localhost:8000';
        const orgSlug = (department as any).organization?.slug || 'wellness'; // fallback to wellness
        const loginUrl = `${phpServerUrl}/${orgSlug}_external.html`;

        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: 'Welcome as a Provider - Your Account Created',
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
        app.log.error('❌ Failed to send welcome email:', emailError);
        // Continue - provider and user are still created
      }

      reply.code(201).send({
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
      });
    } catch (error) {
      app.log.error(error, 'Error creating provider user');
      reply.status(500).send({ error: 'Failed to create provider' });
    }
  });

  app.post('/', { preValidation: [requireAuthHook, requireOwnerHook] }, async (req, reply) => {
    const data = (req.body as any) || {};
    const provider = await prisma.provider.create({ 
      data,
      include: {
        department: {
          select: {
            organizationId: true,
          },
        },
      },
    });
    
    // Try to enable organization if all conditions are now met
    if (provider.department?.organizationId) {
      await tryEnableOrganization(provider.department.organizationId);
    }
    
    reply.code(201).send(provider);
  });

  // DELETE /api/providers/:id
  app.delete('/:id', { preValidation: [requireAuthHook, requireOwnerHook] }, async (req, reply) => {
    const { id } = req.params as any;
    
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
      return reply.status(404).send({ error: 'Provider not found' });
    }

    const organizationId = provider.department?.organizationId;
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
  });
};

export default providersRoutes;


