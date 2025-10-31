import type { FastifyPluginAsync } from 'fastify';
import prisma from '@my-better-t-app/db';
import crypto from 'crypto';

async function ensureProduct(polarProductId: string) {
  let product = await prisma.product.findUnique({ where: { polarId: polarProductId } });
  if (!product) {
    product = await prisma.product.create({
      data: { id: crypto.randomUUID(), polarId: polarProductId, name: 'Monthly Subscription', priceCents: 1000, currency: 'USD', interval: 'month' },
    });
  }
  return product;
}

const polarWebhook: FastifyPluginAsync = async (app) => {
  app.post('/polar', { config: { rawBody: true } }, async (req, reply) => {
    try {
      // @ts-expect-error provided by @fastify/raw-body
      const rawBody: string = req.rawBody?.toString?.('utf8') ?? '';
      let event: any;
      const signature = req.headers['polar-signature'] as string | undefined;
      const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
      if (webhookSecret && signature) {
        const hmac = crypto.createHmac('sha256', webhookSecret);
        const digest = hmac.update(rawBody).digest('hex');
        const expectedSignature = `sha256=${digest}`;
        if (signature !== expectedSignature) {
          return reply.status(401).send({ error: 'Invalid signature' });
        }
      }
      event = JSON.parse(rawBody);

      if (event.type === 'subscription.created' || event.type === 'order.created') {
        const { customer, metadata, product } = event.data;
        const organizationId = metadata?.organizationId;
        const userId = metadata?.userId;
        if (organizationId && userId) {
          const dbProduct = await ensureProduct(product?.id || process.env.POLAR_PRODUCT_ID!);
          const subscription = await prisma.subscription.upsert({
            where: { polarCheckoutId: event.data.checkout_id || event.data.id },
            update: {
              status: 'active',
              polarSubscriptionId: event.data.subscription_id || event.data.id,
              polarCustomerId: customer.id,
              currentPeriodStart: new Date(),
              currentPeriodEnd: event.data.current_period_end ? new Date(event.data.current_period_end) : null,
            },
            create: {
              id: crypto.randomUUID(),
              polarCheckoutId: event.data.checkout_id || event.data.id,
              polarSubscriptionId: event.data.subscription_id || event.data.id,
              polarCustomerId: customer.id,
              status: 'active',
              userId,
              organizationId,
              productId: dbProduct.id,
              currentPeriodStart: new Date(),
              currentPeriodEnd: event.data.current_period_end ? new Date(event.data.current_period_end) : null,
            },
          });

          await prisma.payment.create({
            data: {
              id: crypto.randomUUID(),
              polarPaymentId: event.data.payment_id || event.data.id,
              amount: event.data.amount || dbProduct.priceCents,
              currency: event.data.currency || dbProduct.currency,
              status: 'succeeded',
              subscriptionId: subscription.id,
            },
          });

          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              enabled: true,
              metadata: JSON.stringify({ polarCustomerId: customer.id, subscriptionId: subscription.id, subscriptionStatus: 'active', subscriptionStartedAt: new Date().toISOString() }),
            },
          });
        }
      }

      if (event.type === 'subscription.canceled') {
        const { metadata } = event.data;
        const organizationId = metadata?.organizationId;
        if (organizationId) {
          const subscription = await prisma.subscription.findFirst({ where: { organizationId, status: 'active' } });
          if (subscription) {
            await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'cancelled', cancelledAt: new Date() } });
          }
          await prisma.organization.update({ where: { id: organizationId }, data: { enabled: false } });
        }
      }

      reply.send({ received: true });
    } catch (error) {
      app.log.error(error, 'Error processing Polar webhook');
      reply.status(400).send({ error: 'Webhook processing failed' });
    }
  });
};

export default polarWebhook;


