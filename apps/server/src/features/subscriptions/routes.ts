import type { FastifyPluginAsync } from "fastify";
import prisma from "@booking-for-all/db";
import { requireAuthHook } from "../../plugins/authz";
import crypto from "crypto";
import { tryEnableOrganization } from "../../utils/organization-utils";
import { AppError } from "../../errors/AppError";

// Types for Polar API responses
interface PolarCheckoutSession {
  url: string;
  id?: string;
}

interface PolarMetadata {
  organizationId?: string;
  organization_id?: string;
  userId?: string;
  user_id?: string;
  userEmail?: string;
}

interface PolarCustomer {
  id?: string;
  email?: string;
  metadata?: PolarMetadata;
}

interface PolarProduct {
  id?: string;
  name?: string;
}

interface PolarPayment {
  id?: string;
  status?: string;
}

interface PolarOrder {
  id?: string;
  checkout_id?: string;
  subscription_id?: string;
  payment_id?: string;
  product_id?: string;
  product?: PolarProduct;
  customer?: PolarCustomer;
  metadata?: PolarMetadata;
  status?: string;
  payment_status?: string;
  payment?: PolarPayment;
  amount?: number;
  amount_paid?: number;
  price_amount?: number;
  currency?: string;
  current_period_start?: number;
  current_period_end?: number;
  created_at?: string;
  created?: string;
  expires_at?: string;
}

interface PolarOrdersResponse {
  items?: PolarOrder[];
}

interface PolarSubscriptionsResponse {
  items?: PolarOrder[];
}

interface CreateCheckoutRequest {
  organizationId: string;
}

const subscriptionsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/my-subscriptions",
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
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
            orderBy: { createdAt: "desc" },
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
        const { organizationId } = body || {};
        const user = req.user;
        if (!organizationId) {
          throw new AppError(
            "Organization ID required",
            "VALIDATION_ERROR",
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

        const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;
        const polarProductId = process.env.POLAR_PRODUCT_ID;
        if (!polarAccessToken || !polarProductId) {
          throw new AppError(
            "Payment system not configured. Please contact support.",
            "PAYMENT_NOT_CONFIGURED",
            500
          );
        }

        const baseSuccessUrl =
          process.env.POLAR_SUCCESS_URL ||
          `${process.env.CORS_ORIGIN || "http://localhost:3001"}/owner`;
        const separator = baseSuccessUrl.includes("?") ? "&" : "?";
        const successUrlWithParams = `${baseSuccessUrl}${separator}subscribed=true&organizationId=${organizationId}`;

        const checkoutData = {
          product_id: polarProductId,
          success_url: successUrlWithParams,
          customer_email: user.email,
          metadata: {
            organizationId: organization.id,
            organizationName: organization.name,
            userId: user.id,
            userEmail: user.email,
          },
        };

        const useSandbox = process.env.POLAR_SANDBOX === "true";
        const polarApiBase = useSandbox
          ? "https://sandbox-api.polar.sh/v1"
          : "https://api.polar.sh/v1";
        const resp = await fetch(`${polarApiBase}/checkouts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${polarAccessToken}`,
          },
          body: JSON.stringify(checkoutData),
        });
        if (!resp.ok) {
          const text = await resp.text();
          let err: { message?: string; [key: string]: unknown } = {
            message: text,
          };
          try {
            err = JSON.parse(text) as {
              message?: string;
              [key: string]: unknown;
            };
          } catch {
            err = { message: text };
          }
          app.log.error({ polarError: err }, "Polar API error");
          throw new AppError(
            "Failed to create checkout session",
            "POLAR_CHECKOUT_FAILED",
            500
          );
        }
        const checkoutSession = (await resp.json()) as PolarCheckoutSession;
        return reply.send({
          success: true,
          data: {
            checkoutUrl: checkoutSession.url,
            organizationId: organization.id,
            organizationName: organization.name,
            amount: "$10.00/month",
            message: "Complete payment to activate your organization",
          },
        });
      } catch (error) {
        if (error.isAppError) {
          throw error;
        }
        app.log.error(error, "Error creating checkout");
        throw new AppError(
          "Failed to create checkout",
          "CREATE_CHECKOUT_FAILED",
          500
        );
      }
    }
  );

  // Sync subscription from Polar - useful when webhook was missed
  app.post(
    "/sync-from-polar",
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

        // Check if subscription already exists
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

        const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;
        if (!polarAccessToken) {
          throw new AppError(
            "Payment system not configured",
            "PAYMENT_NOT_CONFIGURED",
            500
          );
        }

        const useSandbox = process.env.POLAR_SANDBOX === "true";
        const polarApiBase = useSandbox
          ? "https://sandbox-api.polar.sh/v1"
          : "https://api.polar.sh/v1";

        // Fetch orders/subscriptions from Polar API by customer email
        // Polar API: GET /orders or GET /subscriptions
        const ordersResp = await fetch(
          `${polarApiBase}/orders?customer_email=${encodeURIComponent(
            user.email
          )}`,
          {
            headers: { Authorization: `Bearer ${polarAccessToken}` },
          }
        );

        if (!ordersResp.ok) {
          const errorText = await ordersResp.text();
          app.log.error(
            { error: errorText },
            "Failed to fetch orders from Polar"
          );
          throw new AppError(
            "Failed to fetch subscriptions from Polar",
            "POLAR_FETCH_FAILED",
            500
          );
        }

        const orders = (await ordersResp.json()) as PolarOrdersResponse;
        app.log.info(
          { orderCount: orders.items?.length || 0 },
          "Fetched orders from Polar"
        );

        // Find order with matching metadata
        let matchedOrder: PolarOrder | null = null;
        if (orders.items && Array.isArray(orders.items)) {
          for (const order of orders.items) {
            const metadata = order.metadata || {};
            if (
              metadata.organizationId === organizationId ||
              metadata.organization_id === organizationId
            ) {
              matchedOrder = order;
              break;
            }
          }
        }

        if (!matchedOrder) {
          // Try subscriptions endpoint as well
          const subscriptionsResp = await fetch(
            `${polarApiBase}/subscriptions?customer_email=${encodeURIComponent(
              user.email
            )}`,
            {
              headers: { Authorization: `Bearer ${polarAccessToken}` },
            }
          );

          if (subscriptionsResp.ok) {
            const subscriptions =
              (await subscriptionsResp.json()) as PolarSubscriptionsResponse;
            if (subscriptions.items && Array.isArray(subscriptions.items)) {
              for (const sub of subscriptions.items) {
                const metadata = sub.metadata || sub.customer?.metadata || {};
                if (
                  metadata.organizationId === organizationId ||
                  metadata.organization_id === organizationId
                ) {
                  matchedOrder = sub;
                  break;
                }
              }
            }
          }
        }

        if (!matchedOrder) {
          throw new AppError(
            "No subscription found in Polar for this organization. Please check Polar dashboard or contact support.",
            "SUBSCRIPTION_NOT_FOUND",
            404
          );
        }

        app.log.info(
          { orderId: matchedOrder.id, status: matchedOrder.status },
          "Found matching order in Polar"
        );

        // Extract metadata
        const metadata: PolarMetadata =
          matchedOrder.metadata || matchedOrder.customer?.metadata || {};
        const extractedOrgId =
          metadata.organizationId || metadata.organization_id || organizationId;
        const extractedUserId = metadata.userId || metadata.user_id || user.id;

        if (extractedOrgId !== organizationId) {
          throw new AppError(
            "Organization ID mismatch in Polar subscription metadata",
            "ORG_ID_MISMATCH",
            400
          );
        }

        // Process the order similar to webhook handler
        const productId =
          matchedOrder.product_id ||
          matchedOrder.product?.id ||
          process.env.POLAR_PRODUCT_ID!;

        // Ensure product exists in database
        let product = await prisma.product.findUnique({
          where: { polarId: productId },
        });
        if (!product) {
          product = await prisma.product.create({
            data: {
              id: crypto.randomUUID(),
              polarId: productId,
              name: matchedOrder.product?.name || "Monthly Subscription",
              priceCents:
                matchedOrder.price_amount || matchedOrder.amount || 1000,
              currency: matchedOrder.currency || "USD",
              interval: "month",
            },
          });
        }

        const checkoutId = matchedOrder.checkout_id || matchedOrder.id;
        const subscriptionId = matchedOrder.subscription_id || matchedOrder.id;
        const customer: PolarCustomer = matchedOrder.customer || {};

        // Determine if payment was successful - check multiple status indicators
        const orderStatus = matchedOrder.status?.toLowerCase() || "";
        const paymentStatus =
          matchedOrder.payment_status?.toLowerCase() ||
          matchedOrder.payment?.status?.toLowerCase() ||
          "";
        const isPaid =
          orderStatus === "complete" ||
          orderStatus === "completed" ||
          orderStatus === "active" ||
          orderStatus === "paid" ||
          orderStatus === "succeeded" ||
          paymentStatus === "succeeded" ||
          paymentStatus === "paid" ||
          paymentStatus === "complete" ||
          (matchedOrder.amount_paid !== undefined &&
            matchedOrder.amount_paid > 0); // If amount_paid exists and > 0, it's likely paid

        // If order exists in Polar and user completed checkout, it should be active
        // Only set pending if explicitly not paid
        const subscriptionStatus = isPaid ? "active" : "pending";

        app.log.info(
          {
            orderStatus,
            paymentStatus,
            isPaid,
            subscriptionStatus,
            amountPaid: matchedOrder.amount_paid,
          },
          "Determining subscription status from Polar order"
        );

        // Create or update subscription
        const subscription = existingSubscription
          ? await prisma.subscription.update({
              where: { id: existingSubscription.id },
              data: {
                status: subscriptionStatus,
                polarCheckoutId:
                  checkoutId || existingSubscription.polarCheckoutId,
                polarSubscriptionId:
                  subscriptionId || existingSubscription.polarSubscriptionId,
                polarCustomerId:
                  customer.id || existingSubscription.polarCustomerId,
                currentPeriodStart: matchedOrder.current_period_start
                  ? new Date(matchedOrder.current_period_start * 1000)
                  : matchedOrder.created_at
                  ? new Date(matchedOrder.created_at)
                  : matchedOrder.created
                  ? new Date(matchedOrder.created)
                  : new Date(),
                currentPeriodEnd: matchedOrder.current_period_end
                  ? new Date(matchedOrder.current_period_end * 1000)
                  : matchedOrder.expires_at
                  ? new Date(matchedOrder.expires_at)
                  : null,
                updatedAt: new Date(),
              },
            })
          : await prisma.subscription.create({
              data: {
                id: crypto.randomUUID(),
                polarCheckoutId: checkoutId,
                polarSubscriptionId: subscriptionId,
                polarCustomerId: customer.id || null,
                status: subscriptionStatus,
                userId: extractedUserId,
                organizationId: extractedOrgId,
                productId: product.id,
                currentPeriodStart: matchedOrder.current_period_start
                  ? new Date(matchedOrder.current_period_start * 1000)
                  : matchedOrder.created_at
                  ? new Date(matchedOrder.created_at)
                  : matchedOrder.created
                  ? new Date(matchedOrder.created)
                  : new Date(),
                currentPeriodEnd: matchedOrder.current_period_end
                  ? new Date(matchedOrder.current_period_end * 1000)
                  : matchedOrder.expires_at
                  ? new Date(matchedOrder.expires_at)
                  : null,
              },
            });

        // Always try to create payment record if we have payment information
        const paymentId =
          matchedOrder.payment_id ||
          matchedOrder.payment?.id ||
          matchedOrder.id;
        const paymentAmount =
          matchedOrder.amount_paid ||
          matchedOrder.amount ||
          matchedOrder.price_amount ||
          product.priceCents;

        if (paymentId) {
          const existingPayment = await prisma.payment.findUnique({
            where: { polarPaymentId: paymentId },
          });

          if (!existingPayment) {
            await prisma.payment.create({
              data: {
                id: crypto.randomUUID(),
                polarPaymentId: paymentId,
                amount: paymentAmount,
                currency: matchedOrder.currency || product.currency,
                status: isPaid ? "succeeded" : "pending",
                subscriptionId: subscription.id,
              },
            });
            app.log.info(
              { paymentId, amount: paymentAmount },
              "Payment record created during sync"
            );
          }
        } else {
          // Even without payment ID, create a payment record if amount exists
          const payments = await prisma.payment.findMany({
            where: { subscriptionId: subscription.id },
          });

          if (payments.length === 0 && paymentAmount > 0) {
            await prisma.payment.create({
              data: {
                id: crypto.randomUUID(),
                amount: paymentAmount,
                currency: matchedOrder.currency || product.currency,
                status: isPaid ? "succeeded" : "pending",
                subscriptionId: subscription.id,
              },
            });
            app.log.info(
              { amount: paymentAmount },
              "Payment record created without Polar payment ID"
            );
          }
        }

        // Update metadata
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            metadata: JSON.stringify({
              polarCustomerId: customer.id,
              subscriptionId: subscription.id,
              subscriptionStatus: subscription.status,
              subscriptionStartedAt: new Date().toISOString(),
              syncedAt: new Date().toISOString(),
            }),
          },
        });

        // Try to enable organization (will only enable if has subscription, departments, and providers)
        // Only try if subscription is active
        if (subscription.status === "active" || isPaid) {
          const enabled = await tryEnableOrganization(organizationId);
          if (enabled) {
            app.log.info(
              { organizationId },
              "Organization enabled during sync"
            );
          } else {
            app.log.info(
              { organizationId },
              "Organization subscription active but not yet enabled - missing departments or providers"
            );
          }
        }

        app.log.info(
          { subscriptionId: subscription.id, organizationId },
          "Subscription synced from Polar"
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
      } catch (error) {
        if (error.isAppError) {
          throw error;
        }
        app.log.error(error, "Error syncing subscription from Polar");
        throw new AppError(
          "Failed to sync subscription from Polar",
          "SYNC_SUBSCRIPTION_FAILED",
          500
        );
      }
    }
  );
};

export default subscriptionsRoutes;
