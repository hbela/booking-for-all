import type { FastifyPluginAsync } from 'fastify';
import { auth } from '@my-better-t-app/auth';
import { hashPassword } from 'better-auth/crypto';
import prisma from '@my-better-t-app/db';
import { requireAuthHook } from '../../plugins/authz';
import { z } from 'zod';

const UpdatePasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

const authRoutes: FastifyPluginAsync = async (app) => {
  // Check if user needs to change password
  app.get(
    '/check-password-change',
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      try {
        // @ts-expect-error populated by requireAuthHook
        const user = req.user;
        const needsPasswordChange = user.needsPasswordChange || false;
        reply.send({ needsPasswordChange });
      } catch (error) {
        app.log.error(error, 'Error checking password change');
        reply.status(500).send({ error: 'Failed to check password change status' });
      }
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
          return reply.status(404).send({ error: 'Credential account not found' });
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

        reply.send({ success: true, message: 'Password updated successfully' });
      } catch (error) {
        app.log.error(error, 'Error updating password');
        reply.status(500).send({ error: 'Failed to update password' });
      }
    }
  );
};

export default authRoutes;


