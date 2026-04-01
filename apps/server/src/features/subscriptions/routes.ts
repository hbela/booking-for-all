import type { FastifyPluginAsync } from "fastify";
import prisma from "@booking-for-all/db";
import crypto from "crypto";
import Stripe from "stripe";
import { requireAuthHook } from "../../plugins/authz";
import { tryEnableOrganization } from "../../utils/organization-utils";
import { AppError } from "../../errors/AppError";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
});

interface CreateCheckoutRequest {
  organizationId: string;
  priceId: string;
}

interface CreatePortalSessionRequest {
  organizationId: string;
}

const subscriptionsRoutes: FastifyPluginAsync = async (app) => {
  // Return available plans (public, no auth required)
  app.get("/plans", async (_req, reply) => {
    const plans = [
      {
        id: "monthly",
        priceId: process.env.STRIPE_PRICE_ID_MONTHLY,
        priceCents: 2000,
        currency: "USD",
        interval: "month",
      },
      {
        id: "yearly",
        priceId: process.env.STRIPE_PRICE_ID_YEARLY,
        priceCents: 22000,
        currency: "USD",
        interval: "year",
      },
    ];

    return reply.send({ success: true, data: plans });
  });

  app.get(
    "/my-subscriptions",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const user = req.user;

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
            orderBy: { createdAt: "desc" },
            take: 5,
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
        orderBy: { createdAt: "desc" },
      });

      reply.send({
        success: true,
        data: subscriptions,
      });
    }
  );

  app.post(
    "/create-checkout",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      try {
        const body = req.body as CreateCheckoutRequest;
        const { organizationId, priceId } = body || {};
        const user = req.user;
        if (!organizationId || !priceId) {
          throw new AppError(
            "Organization ID and Price ID are required",
            "VALIDATION_ERROR",
            400
          );
        }

        // Validate priceId against allowed Stripe prices
        const allowedPriceIds = [
          process.env.STRIPE_PRICE_ID_MONTHLY,
          process.env.STRIPE_PRICE_ID_YEARLY,
        ].filter(Boolean);
        if (!allowedPriceIds.includes(priceId)) {
          throw new AppError(
            "Invalid plan selected",
            "INVALID_PRICE_ID",
            400
          );
        }

        // Verify user membership and that org is not already enabled
        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        if (!organization) {
          throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
        }
        if (organization.enabled) {
          throw new AppError(
            "Organization is already subscribed",
            "ORG_ALREADY_SUBSCRIBED",
            400
          );
        }

        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeSecretKey) {
          throw new AppError(
            "Payment system not configured. Please contact support.",
            "PAYMENT_NOT_CONFIGURED",
            500
          );
        }

        const frontendUrl =
          process.env.FRONTEND_URL ||
          process.env.CORS_ORIGIN ||
          "http://localhost:3001";
        const successUrl = `${frontendUrl}/owner?subscribed=true&organizationId=${organizationId}`;
        const cancelUrl = `${frontendUrl}/owner?cancelled=true`;

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          customer_email: user.email,
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          metadata: {
            organizationId: organization.id,
            organizationName: organization.name,
            userId: user.id,
            userEmail: user.email,
          },
          subscription_data: {
            metadata: {
              organizationId: organization.id,
              userId: user.id,
            },
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
        });

        return reply.send({
          success: true,
          data: {
            checkoutUrl: session.url,
            organizationId: organization.id,
            organizationName: organization.name,
            message: "Complete payment to activate your organization",
          },
        });
      } catch (error: any) {
        if (error.isAppError) {
          throw error;
        }
        app.log.error(error, "Error creating Stripe checkout session");
        throw new AppError(
          "Failed to create checkout",
          "CREATE_CHECKOUT_FAILED",
          500
        );
      }
    }
  );

  // Create Stripe Customer Portal session for managing subscriptions
  app.post(
    "/create-portal-session",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      try {
        const body = req.body as CreatePortalSessionRequest;
        const { organizationId } = body || {};
        const user = req.user;

        if (!organizationId) {
          throw new AppError(
            "Organization ID required",
            "VALIDATION_ERROR",
            400
          );
        }

        // Find the subscription to get the Stripe customer ID
        const subscription = await prisma.subscription.findFirst({
          where: { organizationId, userId: user.id },
        });

        if (!subscription?.stripeCustomerId) {
          throw new AppError(
            "No active subscription found for this organization",
            "SUBSCRIPTION_NOT_FOUND",
            404
          );
        }

        const frontendUrl =
          process.env.FRONTEND_URL ||
          process.env.CORS_ORIGIN ||
          "http://localhost:3001";

        const portalSession = await stripe.billingPortal.sessions.create({
          customer: subscription.stripeCustomerId,
          return_url: `${frontendUrl}/owner`,
        });

        return reply.send({
          success: true,
          data: {
            portalUrl: portalSession.url,
          },
        });
      } catch (error: any) {
        if (error.isAppError) {
          throw error;
        }
        app.log.error(error, "Error creating Stripe portal session");
        throw new AppError(
          "Failed to create portal session",
          "CREATE_PORTAL_SESSION_FAILED",
          500
        );
      }
    }
  );

  // Sync subscription from Stripe - useful when webhook was missed
  app.post(
    "/sync-from-stripe",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      try {
        const body = req.body as CreateCheckoutRequest;
        const { organizationId } = body || {};
        const user = req.user;
        if (!organizationId) {
          throw new AppError(
            "Organization ID required",
            "VALIDATION_ERROR",
            400
          );
        }

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        if (!organization) {
          throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
        }

        // Check if subscription already exists and is active
        const existingSubscription = await prisma.subscription.findFirst({
          where: { organizationId },
        });
        if (existingSubscription && existingSubscription.status === "active") {
          throw new AppError(
            "Subscription already exists and is active",
            "SUBSCRIPTION_EXISTS",
            400
          );
        }

        // Search Stripe for completed checkout sessions with matching metadata
        const sessions = await stripe.checkout.sessions.list({
          limit: 20,
        });

        let matchedSession: Stripe.Checkout.Session | null = null;
        for (const session of sessions.data) {
          if (
            session.metadata?.organizationId === organizationId &&
            session.status === "complete"
          ) {
            matchedSession = session;
            break;
          }
        }

        if (!matchedSession) {
          throw new AppError(
            "No completed checkout session found in Stripe for this organization. Please complete checkout first or contact support.",
            "SUBSCRIPTION_NOT_FOUND",
            404
          );
        }

        app.log.info(
          { sessionId: matchedSession.id },
          "Found matching Stripe checkout session"
        );

        const stripeSubscriptionId = matchedSession.subscription as string;
        const stripeCustomerId = matchedSession.customer as string;

        // Fetch the actual subscription from Stripe
        let stripeSub: Stripe.Subscription | null = null;
        let periodStart = new Date();
        let periodEnd: Date | null = null;
        if (stripeSubscriptionId) {
          try {
            stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            // In newer Stripe API, period dates are on items
            const firstItem = stripeSub.items?.data?.[0];
            if (firstItem) {
              periodStart = new Date(firstItem.current_period_start * 1000);
              periodEnd = new Date(firstItem.current_period_end * 1000);
            }
          } catch (err) {
            app.log.warn({ err }, "Could not retrieve Stripe subscription");
          }
        }

        const isActive = stripeSub?.status === "active" || matchedSession.payment_status === "paid";
        const subscriptionStatus = isActive ? "active" : "pending";

        // Ensure product exists in database
        const priceId = process.env.STRIPE_PRICE_ID_MONTHLY ?? process.env.STRIPE_PRICE_ID_YEARLY!;
        let product = await prisma.product.findUnique({
          where: { stripeProductId: priceId },
        });
        if (!product) {
          product = await prisma.product.create({
            data: {
              id: crypto.randomUUID(),
              stripeProductId: priceId,
              name: "Monthly Subscription",
              priceCents: 1000,
              currency: "USD",
              interval: "month",
            },
          });
        }

        // Create or update subscription
        const subscription = existingSubscription
          ? await prisma.subscription.update({
              where: { id: existingSubscription.id },
              data: {
                status: subscriptionStatus,
                stripeSessionId: matchedSession.id || existingSubscription.stripeSessionId,
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
                stripeSessionId: matchedSession.id,
                stripeSubscriptionId: stripeSubscriptionId || null,
                stripeCustomerId: stripeCustomerId || null,
                status: subscriptionStatus,
                userId: user.id,
                organizationId,
                productId: product.id,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              },
            });

        // Update organization metadata
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            metadata: JSON.stringify({
              stripeCustomerId,
              subscriptionId: subscription.id,
              subscriptionStatus: subscription.status,
              subscriptionStartedAt: new Date().toISOString(),
              syncedAt: new Date().toISOString(),
            }),
          },
        });

        // Try to enable organization
        if (subscription.status === "active" || isActive) {
          const enabled = await tryEnableOrganization(organizationId);
          if (enabled) {
            app.log.info({ organizationId }, "Organization enabled during sync");
          } else {
            app.log.info(
              { organizationId },
              "Organization subscription active but not yet enabled - missing departments or providers"
            );
          }
        }

        app.log.info(
          { subscriptionId: subscription.id, organizationId },
          "Subscription synced from Stripe"
        );

        reply.send({
          success: true,
          data: {
            message: "Subscription synced successfully",
            subscription: {
              id: subscription.id,
              status: subscription.status,
            },
            organization: {
              id: organizationId,
              enabled: subscription.status === "active",
            },
          },
        });
      } catch (error: any) {
        if (error.isAppError) {
          throw error;
        }
        app.log.error(error, "Error syncing subscription from Stripe");
        throw new AppError(
          "Failed to sync subscription from Stripe",
          "SYNC_SUBSCRIPTION_FAILED",
          500
        );
      }
    }
  );
};

export default subscriptionsRoutes;
