import type { FastifyPluginAsync } from 'fastify';
import prisma from '@booking-for-all/db';
import crypto from 'crypto';
import Stripe from 'stripe';
import { tryEnableOrganization } from '../../utils/organization-utils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
});

async function ensureProduct(stripeProductId: string, name?: string, amount?: number, currency?: string) {
  let product = await prisma.product.findUnique({ where: { stripeProductId } });
  if (!product) {
    product = await prisma.product.create({
      data: {
        id: crypto.randomUUID(),
        stripeProductId,
        name: name || 'Monthly Subscription',
        priceCents: amount || 1000,
        currency: currency || 'USD',
        interval: 'month',
      },
    });
  }
  return product;
}

const stripeWebhook: FastifyPluginAsync = async (app) => {
  app.post('/stripe', { config: { rawBody: true } }, async (req, reply) => {
    try {
      const rawBody: string = req.rawBody?.toString?.('utf8') ?? '';
      const signature = req.headers['stripe-signature'] as string | undefined;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret || !signature) {
        app.log.warn('Missing Stripe webhook secret or signature');
        return reply.status(401).send({ error: 'Missing webhook configuration' });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch (err) {
        app.log.warn({ err }, 'Invalid Stripe webhook signature');
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      app.log.info({ type: event.type, id: event.id }, 'Received Stripe webhook');

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutCompleted(app, session);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpdated(app, subscription);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(app, subscription);
          break;
        }

        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaid(app, invoice);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaymentFailed(app, invoice);
          break;
        }

        default:
          app.log.info({ type: event.type }, 'Unhandled Stripe event type');
      }

      reply.send({ received: true });
    } catch (error) {
      app.log.error(error, 'Error processing Stripe webhook');
      reply.status(400).send({ error: 'Webhook processing failed' });
    }
  });
};

async function handleCheckoutCompleted(app: any, session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const subscriptionMetadata = (session as any).subscription_data?.metadata || {};
  const organizationId = metadata.organizationId || subscriptionMetadata.organizationId;
  const userId = metadata.userId || subscriptionMetadata.userId;

  if (!organizationId || !userId) {
    app.log.warn({ metadata }, 'Missing organizationId or userId in checkout session metadata');
    return;
  }

  const stripeSubscriptionId = session.subscription as string;
  const stripeCustomerId = session.customer as string;

  // Resolve product from Stripe price
  const priceId = process.env.STRIPE_PRICE_ID!;
  const dbProduct = await ensureProduct(priceId);

  // Fetch subscription details from Stripe
  let periodStart = new Date();
  let periodEnd: Date | null = null;
  if (stripeSubscriptionId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      // In newer Stripe API, period dates are on items
      const firstItem = stripeSub.items?.data?.[0];
      if (firstItem) {
        periodStart = new Date(firstItem.current_period_start * 1000);
        periodEnd = new Date(firstItem.current_period_end * 1000);
      }
    } catch (err) {
      app.log.warn({ err }, 'Could not retrieve Stripe subscription details');
    }
  }

  // Find or create subscription record
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        { organizationId },
        ...(session.id ? [{ stripeSessionId: session.id }] : []),
        ...(stripeSubscriptionId ? [{ stripeSubscriptionId }] : []),
      ],
    },
  });

  const subscription = existingSubscription
    ? await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          status: 'active',
          stripeSessionId: session.id || existingSubscription.stripeSessionId,
          stripeSubscriptionId: stripeSubscriptionId || existingSubscription.stripeSubscriptionId,
          stripeCustomerId: stripeCustomerId || existingSubscription.stripeCustomerId,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          updatedAt: new Date(),
        },
      })
    : await prisma.subscription.create({
        data: {
          id: crypto.randomUUID(),
          stripeSessionId: session.id,
          stripeSubscriptionId: stripeSubscriptionId || null,
          stripeCustomerId: stripeCustomerId || null,
          status: 'active',
          userId,
          organizationId,
          productId: dbProduct.id,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });

  app.log.info({ subscriptionId: subscription.id }, 'Subscription created/updated from checkout');

  // Update organization metadata
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      metadata: JSON.stringify({
        stripeCustomerId,
        subscriptionId: subscription.id,
        subscriptionStatus: 'active',
        subscriptionStartedAt: new Date().toISOString(),
      }),
    },
  });

  // Try to enable organization
  const enabled = await tryEnableOrganization(organizationId);
  if (enabled) {
    app.log.info({ organizationId }, 'Organization enabled after checkout');
  } else {
    app.log.info({ organizationId }, 'Organization subscription active but not yet enabled - missing departments or providers');
  }
}

async function handleSubscriptionUpdated(app: any, stripeSub: Stripe.Subscription) {
  const metadata = stripeSub.metadata || {};
  const organizationId = metadata.organizationId;

  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        ...(stripeSub.id ? [{ stripeSubscriptionId: stripeSub.id }] : []),
        ...(organizationId ? [{ organizationId }] : []),
      ],
    },
  });

  if (!existingSubscription) {
    app.log.warn({ stripeSubscriptionId: stripeSub.id }, 'No matching subscription found for update');
    return;
  }

  // Map Stripe status to our internal status
  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'cancelled',
    unpaid: 'unpaid',
    trialing: 'trialing',
    incomplete: 'pending',
    incomplete_expired: 'expired',
    paused: 'paused',
  };

  const newStatus = statusMap[stripeSub.status] || stripeSub.status;

  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      status: newStatus,
      currentPeriodStart: stripeSub.items?.data?.[0]
        ? new Date(stripeSub.items.data[0].current_period_start * 1000)
        : undefined,
      currentPeriodEnd: stripeSub.items?.data?.[0]
        ? new Date(stripeSub.items.data[0].current_period_end * 1000)
        : undefined,
      cancelledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
      updatedAt: new Date(),
    },
  });

  app.log.info(
    { subscriptionId: existingSubscription.id, status: newStatus },
    'Subscription updated from webhook'
  );
}

async function handleSubscriptionDeleted(app: any, stripeSub: Stripe.Subscription) {
  const metadata = stripeSub.metadata || {};
  const organizationId = metadata.organizationId;

  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: stripeSub.id },
        ...(organizationId ? [{ organizationId }] : []),
      ],
    },
  });

  if (existingSubscription) {
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Disable the organization
    if (existingSubscription.organizationId) {
      await prisma.organization.update({
        where: { id: existingSubscription.organizationId },
        data: { enabled: false },
      });
      app.log.info({ organizationId: existingSubscription.organizationId }, 'Subscription deleted, organization disabled');
    }
  }
}

async function handleInvoicePaid(app: any, invoice: Stripe.Invoice) {
  // In newer Stripe API, subscription is accessed via parent
  const stripeSubscriptionId = (
    invoice.parent?.subscription_details?.subscription
  ) as string | undefined;
  if (!stripeSubscriptionId) return;

  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId },
  });

  if (!existingSubscription) {
    app.log.warn({ stripeSubscriptionId }, 'No matching subscription for invoice.paid');
    return;
  }

  // Avoid duplicates
  const existingPayment = await prisma.payment.findUnique({
    where: { stripeInvoiceId: invoice.id },
  });

  if (!existingPayment) {
    await prisma.payment.create({
      data: {
        id: crypto.randomUUID(),
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid || 0,
        currency: invoice.currency?.toUpperCase() || 'USD',
        status: 'succeeded',
        receiptUrl: invoice.hosted_invoice_url || null,
        subscriptionId: existingSubscription.id,
      },
    });
    app.log.info({ invoiceId: invoice.id, amount: invoice.amount_paid }, 'Payment recorded from invoice.paid');
  }
}

async function handleInvoicePaymentFailed(app: any, invoice: Stripe.Invoice) {
  // In newer Stripe API, subscription is accessed via parent
  const stripeSubscriptionId = (
    invoice.parent?.subscription_details?.subscription
  ) as string | undefined;
  if (!stripeSubscriptionId) return;

  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId },
  });

  if (!existingSubscription) {
    app.log.warn({ stripeSubscriptionId }, 'No matching subscription for invoice.payment_failed');
    return;
  }

  // Update subscription status to reflect payment failure
  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      status: 'past_due',
      updatedAt: new Date(),
    },
  });

  app.log.warn(
    { subscriptionId: existingSubscription.id, organizationId: existingSubscription.organizationId },
    'Invoice payment failed - subscription set to past_due'
  );
}

export default stripeWebhook;
