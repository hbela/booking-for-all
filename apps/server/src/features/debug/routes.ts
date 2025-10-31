import type { FastifyPluginAsync } from 'fastify';
import prisma from '@my-better-t-app/db';

const debugRoutes: FastifyPluginAsync = async (app) => {
  app.get('/db-info', async (_req, reply) => {
    try {
      const userCount = await prisma.user.count();
      const orgCount = await prisma.organization.count();
      const deptCount = await prisma.department.count();
      const users = await prisma.user.findMany({ select: { email: true, name: true }, take: 5 });
      reply.send({ databaseUrl: process.env.DATABASE_URL, tables: { users: userCount, organizations: orgCount, departments: deptCount }, sampleUsers: users, prismaConnected: true });
    } catch (error: any) {
      reply.status(500).send({ databaseUrl: process.env.DATABASE_URL, error: error?.message || 'Unknown error', prismaConnected: false });
    }
  });

  app.get('/email-config', async (_req, reply) => {
    const apiKey = process.env.RESEND_API_KEY;
    reply.send({
      resendConfigured: !!apiKey,
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}` : 'NOT SET',
      fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      corsOrigin: process.env.CORS_ORIGIN,
      frontendUrl: process.env.FRONTEND_URL,
      note: 'If resendConfigured is true, check Resend dashboard at https://resend.com/emails for delivery status',
    });
  });
};

export default debugRoutes;


