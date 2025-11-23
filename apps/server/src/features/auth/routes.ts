import type { FastifyPluginAsync } from 'fastify';
import { auth } from '@booking-for-all/auth';
import { hashPassword } from 'better-auth/crypto';
import prisma from '@booking-for-all/db';
import { requireAuthHook } from '../../plugins/authz';
import { z } from 'zod';
import { AppError } from '../../errors/AppError';

const UpdatePasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

const authRoutes: FastifyPluginAsync = async (app) => {
  // Check if user needs to change password
  app.get(
    '/check-password-change',
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      // @ts-expect-error populated by requireAuthHook
      const user = req.user;
      const needsPasswordChange = user.needsPasswordChange || false;
      reply.send({
        success: true,
        data: { needsPasswordChange },
      });
    }
  );

  // Update password endpoint
  app.post(
    '/update-password',
    {
      preValidation: [requireAuthHook],
      schema: {
        body: UpdatePasswordSchema,
      },
    },
    async (req, reply) => {
      try {
        // @ts-expect-error populated by requireAuthHook
        const user = req.user;
        const { newPassword } = req.body;

        // Find the credential account
        const account = await prisma.account.findFirst({
          where: {
            userId: user.id,
            providerId: 'credential',
          },
        });

        if (!account) {
          throw new AppError(
            'Credential account not found',
            'ACCOUNT_NOT_FOUND',
            404
          );
        }

        // Hash the new password
        const hashedPassword = await hashPassword(newPassword);

        // Update the password
        await prisma.account.update({
          where: { id: account.id },
          data: {
            password: hashedPassword,
            updatedAt: new Date(),
          },
        });

        // Clear the needsPasswordChange flag
        await prisma.user.update({
          where: { id: user.id },
          data: {
            needsPasswordChange: false,
            updatedAt: new Date(),
          },
        });

        reply.send({
          success: true,
          data: { message: 'Password updated successfully' },
        });
      } catch (error) {
        if (error.isAppError) {
          throw error;
        }
        app.log.error(error, 'Error updating password');
        throw new AppError(
          'Failed to update password',
          'UPDATE_PASSWORD_FAILED',
          500
        );
      }
    }
  );
};

export default authRoutes;


