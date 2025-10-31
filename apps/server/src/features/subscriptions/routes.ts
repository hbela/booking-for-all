import type { FastifyPluginAsync } from 'fastify';
import prisma from '@my-better-t-app/db';
import { requireAuthHook } from '../../plugins/authz';

const subscriptionsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/my-subscriptions', { preValidation: [requireAuthHook] }, async (req, reply) => {
    try {
      // @ts-expect-error
      const user = req.user;
      
      // Get all subscriptions for the user with related data
      const subscriptions = await prisma.subscription.findMany({
        where: { userId: user.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              description: true,
              slug: true,
              logo: true,
              enabled: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              description: true,
              priceCents: true,
              currency: true,
              interval: true,
            },
          },
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 5, // Last 5 payments
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              receiptUrl: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      reply.send(subscriptions);
    } catch (error) {
      app.log.error(error, 'Error fetching user subscriptions');
      reply.status(500).send({ error: 'Failed to fetch subscriptions' });
    }
  });

  app.post('/create-checkout', { preValidation: [requireAuthHook] }, async (req, reply) => {
    try {
      const { organizationId } = (req.body as any) || {};
      // @ts-expect-error from auth hook
      const user = req.user;
      if (!organizationId) {
        return reply.status(400).send({ error: 'Organization ID required' });
      }

      // Verify user membership and that org is not already enabled
      const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!organization) return reply.status(404).send({ error: 'Organization not found' });
      if (organization.enabled) return reply.status(400).send({ error: 'Organization is already subscribed' });

      const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;
      const polarProductId = process.env.POLAR_PRODUCT_ID;
      if (!polarAccessToken || !polarProductId) {
        return reply.status(500).send({ error: 'Payment system not configured. Please contact support.' });
      }

      const baseSuccessUrl = process.env.POLAR_SUCCESS_URL || `${process.env.CORS_ORIGIN || 'http://localhost:3001'}/owner`;
      const separator = baseSuccessUrl.includes('?') ? '&' : '?';
      const successUrlWithParams = `${baseSuccessUrl}${separator}subscribed=true&organizationId=${organizationId}`;

      const checkoutData = {
        product_id: polarProductId,
        success_url: successUrlWithParams,
        customer_email: user.email,
        metadata: { organizationId: organization.id, organizationName: organization.name, userId: user.id, userEmail: user.email },
      };

      const useSandbox = process.env.POLAR_SANDBOX === 'true';
      const polarApiBase = useSandbox ? 'https://sandbox-api.polar.sh/v1' : 'https://api.polar.sh/v1';
      const resp = await fetch(`${polarApiBase}/checkouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${polarAccessToken}` },
        body: JSON.stringify(checkoutData),
      });
      if (!resp.ok) {
        const text = await resp.text();
        let err;
        try { err = JSON.parse(text); } catch { err = { message: text }; }
        return reply.status(500).send({ error: 'Failed to create checkout session', polarError: err });
      }
      const checkoutSession = await resp.json();
      return reply.send({
        checkoutUrl: checkoutSession.url,
        organizationId: organization.id,
        organizationName: organization.name,
        amount: '$10.00/month',
        message: 'Complete payment to activate your organization',
      });
    } catch (error) {
      app.log.error(error, 'Error creating checkout');
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
};

export default subscriptionsRoutes;


