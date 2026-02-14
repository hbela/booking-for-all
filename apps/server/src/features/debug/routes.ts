import type { FastifyPluginAsync } from 'fastify';
import prisma from '@booking-for-all/db';
import { captureException, captureMessage } from '../../instrument';

const debugRoutes: FastifyPluginAsync = async (app) => {
  // Debug endpoint to list all registered routes
  app.get('/routes', async (_req, reply) => {
    const routes: any[] = [];
    app.printRoutes().split('\n').forEach((line) => {
      if (line.trim()) {
        routes.push(line.trim());
      }
    });
    return { routes };
  });

  app.get('/db-info', async (_req, reply) => {
    try {
      const userCount = await prisma.user.count();
      const orgCount = await prisma.organization.count();
      const deptCount = await prisma.department.count();
      const eventCount = await prisma.event.count();
      const bookingCount = await prisma.booking.count();
      
      // Get recent events (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentEventsCount = await prisma.event.count({
        where: {
          start: { gte: thirtyDaysAgo }
        }
      });
      
      // Get recent bookings
      const recentBookingsCount = await prisma.booking.count({
        where: {
          createdAt: { gte: thirtyDaysAgo }
        }
      });
      
      // Get sample recent events
      const recentEvents = await prisma.event.findMany({
        where: {
          start: { gte: thirtyDaysAgo }
        },
        orderBy: { start: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          start: true,
          end: true,
          isBooked: true,
          createdAt: true
        }
      });
      
      // Get sample recent bookings
      const recentBookings = await prisma.booking.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          event: {
            select: {
              title: true,
              start: true
            }
          }
        }
      });
      
      const users = await prisma.user.findMany({ select: { email: true, name: true }, take: 5 });
      
      // Mask database URL for security
      const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || 'NOT SET';
      const maskedUrl = dbUrl !== 'NOT SET' 
        ? dbUrl.replace(/(:\/\/)([^:]+):([^@]+)@/, '$1***:***@')
        : 'NOT SET';
      
      reply.send({ 
        databaseUrl: maskedUrl,
        usingDirectUrl: !!process.env.DIRECT_URL,
        usingDatabaseUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV || 'development',
        tables: { 
          users: userCount, 
          organizations: orgCount, 
          departments: deptCount,
          events: eventCount,
          bookings: bookingCount,
          recentEvents: recentEventsCount,
          recentBookings: recentBookingsCount
        }, 
        sampleUsers: users,
        sampleRecentEvents: recentEvents,
        sampleRecentBookings: recentBookings,
        prismaConnected: true 
      });
    } catch (error: any) {
      const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || 'NOT SET';
      const maskedUrl = dbUrl !== 'NOT SET' 
        ? dbUrl.replace(/(:\/\/)([^:]+):([^@]+)@/, '$1***:***@')
        : 'NOT SET';
      reply.status(500).send({ 
        databaseUrl: maskedUrl,
        usingDirectUrl: !!process.env.DIRECT_URL,
        usingDatabaseUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV || 'development',
        error: error?.message || 'Unknown error', 
        prismaConnected: false 
      });
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

  // Sentry test endpoint - triggers a test error to verify Sentry is working
  app.get('/sentry-test', async (_req, reply) => {
    try {
      const testError = new Error(
        `Sentry server smoke-test ${new Date().toISOString()} - Environment: ${process.env.NODE_ENV ?? 'development'}`
      );
      
      // Add context to the error
      const Sentry = await import('@sentry/node');
      Sentry.setContext('sentry_test', {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? 'development',
        release: process.env.SENTRY_RELEASE ?? 'unknown',
        endpoint: '/debug/sentry-test',
      });

      app.log.info('🚀 About to send Sentry server smoke test...');
      captureException(testError);
      app.log.info('✅ Sentry.captureException() called successfully');

      // Flush to ensure event is sent immediately
      await Sentry.flush(2000);
      app.log.info('✅ Sentry flush completed - event should be sent');

      reply.send({
        success: true,
        message: 'Sentry test error sent',
        error: testError.message,
        environment: process.env.NODE_ENV ?? 'development',
        release: process.env.SENTRY_RELEASE ?? 'unknown',
        note: 'Check your Sentry dashboard for the error event in the booking-for-all-fastify-api project',
      });
    } catch (error: any) {
      app.log.error(error, 'Error sending Sentry test');
      reply.status(500).send({
        success: false,
        error: error?.message || 'Unknown error',
      });
    }
  });
};

export default debugRoutes;


