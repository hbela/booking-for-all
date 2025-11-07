import type { FastifyPluginAsync } from 'fastify';
import prisma from '@booking-for-all/db';
import crypto from 'crypto';
import { tryEnableOrganization } from '../../utils/organization-utils';

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
          app.log.warn('Invalid webhook signature');
          return reply.status(401).send({ error: 'Invalid signature' });
        }
      }
      event = JSON.parse(rawBody);

      // Log received webhook for debugging
      app.log.info({ type: event.type, event }, 'Received Polar webhook');

      // Handle successful checkout/subscription events
      const handledTypes = [
        'subscription.created',
        'order.created',
        'checkout.completed',
        'checkout.succeeded',
        'order.completed',
      ];

      if (handledTypes.includes(event.type)) {
        const eventData = event.data || {};
        // Polar can nest metadata differently - try multiple paths
        const metadata = eventData.metadata || eventData.customer?.metadata || {};
        const organizationId = metadata?.organizationId || metadata?.organization_id;
        const userId = metadata?.userId || metadata?.user_id;

        app.log.info({ organizationId, userId, metadata }, 'Processing subscription webhook');

        if (organizationId && userId) {
          const customer = eventData.customer || {};
          const productId = eventData.product_id || eventData.product?.id || process.env.POLAR_PRODUCT_ID!;
          const dbProduct = await ensureProduct(productId);

          // Get checkout/subscription IDs from various possible locations
          const checkoutId = eventData.checkout_id || eventData.id || eventData.checkout?.id;
          const subscriptionId = eventData.subscription_id || eventData.subscription?.id || eventData.id;
          const paymentId = eventData.payment_id || eventData.payment?.id;

          if (!checkoutId && !subscriptionId) {
            app.log.warn({ eventData }, 'No checkout_id or subscription_id found in webhook');
            return reply.status(400).send({ error: 'Missing checkout_id or subscription_id' });
          }

          // Try to find existing subscription by organizationId first, then by checkout/subscription ID
          const existingSubscription = await prisma.subscription.findFirst({
            where: {
              OR: [
                { organizationId },
                ...(checkoutId ? [{ polarCheckoutId: checkoutId }] : []),
                ...(subscriptionId ? [{ polarSubscriptionId: subscriptionId }] : []),
              ],
            },
          });

          const subscription = existingSubscription
            ? await prisma.subscription.update({
                where: { id: existingSubscription.id },
                data: {
                  status: 'active',
                  polarCheckoutId: checkoutId || existingSubscription.polarCheckoutId,
                  polarSubscriptionId: subscriptionId || existingSubscription.polarSubscriptionId,
                  polarCustomerId: customer.id || existingSubscription.polarCustomerId,
                  currentPeriodStart: eventData.current_period_start ? new Date(eventData.current_period_start * 1000) : new Date(),
                  currentPeriodEnd: eventData.current_period_end ? new Date(eventData.current_period_end * 1000) : null,
                  updatedAt: new Date(),
                },
              })
            : await prisma.subscription.create({
                data: {
                  id: crypto.randomUUID(),
                  polarCheckoutId: checkoutId,
                  polarSubscriptionId: subscriptionId,
                  polarCustomerId: customer.id || null,
                  status: 'active',
                  userId,
                  organizationId,
                  productId: dbProduct.id,
                  currentPeriodStart: eventData.current_period_start ? new Date(eventData.current_period_start * 1000) : new Date(),
                  currentPeriodEnd: eventData.current_period_end ? new Date(eventData.current_period_end * 1000) : null,
                },
              });

          app.log.info({ subscriptionId: subscription.id }, 'Subscription created/updated');

          // Create payment record if payment ID is provided
          if (paymentId) {
            const existingPayment = await prisma.payment.findUnique({
              where: { polarPaymentId: paymentId },
            });

            if (!existingPayment) {
              await prisma.payment.create({
                data: {
                  id: crypto.randomUUID(),
                  polarPaymentId: paymentId,
                  amount: eventData.amount || eventData.price_amount || dbProduct.priceCents,
                  currency: eventData.currency || dbProduct.currency,
                  status: 'succeeded',
                  subscriptionId: subscription.id,
                },
              });
              app.log.info({ paymentId }, 'Payment record created');
            }
          }

          // Update metadata
          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              metadata: JSON.stringify({
                polarCustomerId: customer.id,
                subscriptionId: subscription.id,
                subscriptionStatus: 'active',
                subscriptionStartedAt: new Date().toISOString(),
              }),
            },
          });

          // Try to enable organization (will only enable if has subscription, departments, and providers)
          const enabled = await tryEnableOrganization(organizationId);
          if (enabled) {
            app.log.info({ organizationId }, 'Organization enabled');
          } else {
            app.log.info({ organizationId }, 'Organization subscription active but not yet enabled - missing departments or providers');
          }

          return reply.send({ received: true, processed: true });
        } else {
          app.log.warn({ metadata, organizationId, userId }, 'Missing organizationId or userId in webhook metadata');
        }
      }

      // Handle subscription cancellation
      if (event.type === 'subscription.canceled' || event.type === 'subscription.cancelled') {
        const eventData = event.data || {};
        const metadata = eventData.metadata || eventData.customer?.metadata || {};
        const organizationId = metadata?.organizationId || metadata?.organization_id;

        if (organizationId) {
          const subscription = await prisma.subscription.findFirst({
            where: { organizationId, status: 'active' },
          });
          if (subscription) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: 'cancelled', cancelledAt: new Date() },
            });
          }
          await prisma.organization.update({
            where: { id: organizationId },
            data: { enabled: false },
          });
          app.log.info({ organizationId }, 'Subscription cancelled and organization disabled');
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


