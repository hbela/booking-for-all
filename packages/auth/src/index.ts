import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@booking-for-all/db";
import { organization, admin, apiKey } from "better-auth/plugins";
import crypto from "crypto";

// Log environment (loaded by server's dotenv/config)
console.log("🔐 Auth Package - DATABASE_URL:", process.env.DATABASE_URL);
console.log(
  "🔐 Auth Package - BETTER_AUTH_SECRET:",
  process.env.BETTER_AUTH_SECRET ? "Set" : "Not set"
);
console.log("🔐 Auth Package - BETTER_AUTH_URL:", process.env.BETTER_AUTH_URL);

// Build trusted origins array - filter out empty strings and invalid URLs
const trustedOrigins: string[] = [];
if (process.env.CORS_ORIGIN) {
  trustedOrigins.push(process.env.CORS_ORIGIN);
}
if (process.env.FRONTEND_URL) {
  trustedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.BETTER_AUTH_URL) {
  trustedOrigins.push(process.env.BETTER_AUTH_URL);
}
// Filter out duplicates and empty strings
const uniqueTrustedOrigins = [
  ...new Set(trustedOrigins.filter((origin) => origin && origin.trim() !== "")),
];

console.log("🔐 Auth Package - Trusted Origins:", uniqueTrustedOrigins);
console.log("🔐 Auth Package - BETTER_AUTH_URL:", process.env.BETTER_AUTH_URL);

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins:
    uniqueTrustedOrigins.length > 0 ? uniqueTrustedOrigins : undefined,
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
    },
  },
  // Note: User creation hooks are handled via Prisma extensions in @booking-for-all/db
  // Session hooks and email notifications are handled in apps/server/src/plugins/authz.ts
  advanced: {
    defaultCookieAttributes: {
      // Use "none" when BETTER_AUTH_URL is HTTPS (ngrok or production)
      // Use "lax" only for pure localhost HTTP development
      sameSite: process.env.BETTER_AUTH_URL?.startsWith("https")
        ? "none"
        : process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
      // Secure cookies required for HTTPS (ngrok or production)
      secure: process.env.BETTER_AUTH_URL?.startsWith("https")
        ? true
        : process.env.NODE_ENV === "production",
      httpOnly: true,
      // Don't set domain - let browser handle it automatically
      // This helps with cookie matching across different subdomains/ngrok URLs
    },
  },
  user: {
    additionalFields: {
      isSystemAdmin: {
        type: "boolean",
        defaultValue: false,
        required: false,
      },
      needsPasswordChange: {
        type: "boolean",
        defaultValue: false,
        required: false,
      },
      banned: {
        type: "boolean",
        defaultValue: false,
        required: false,
      },
      banReason: {
        type: "string",
        required: false,
      },
      banExpires: {
        type: "date",
        required: false,
      },
    },
  },
  plugins: [
    admin(),
    organization({
      allowUserToCreateOrganization: false, // Only admins can create organizations
      organizationLimit: 10, // Limit per user
    }),
    apiKey({
      enableMetadata: true,
    }),
  ],
  hooks: {
    afterSignIn: async ({ user, session, body }) => {
      // Handle organizationId from additionalData (passed via social sign-in)
      const orgId = (body as any)?.additionalData?.organizationId;

      if (orgId && user?.id) {
        try {
          // Check if organization exists and is enabled
          const organization = await prisma.organization.findUnique({
            where: { id: orgId },
          });

          if (!organization) {
            console.warn(`🔐 afterSignIn: Organization ${orgId} not found`);
            return;
          }

          if (!organization.enabled) {
            console.warn(
              `🔐 afterSignIn: Organization ${orgId} is not enabled`
            );
            return;
          }

          // Check if membership already exists
          const existingMembership = await prisma.member.findUnique({
            where: {
              organizationId_userId: {
                userId: user.id,
                organizationId: orgId,
              },
            },
          });

          if (!existingMembership) {
            // Get user email for member record
            const userRecord = await prisma.user.findUnique({
              where: { id: user.id },
              select: { email: true },
            });

            if (userRecord) {
              // Create membership automatically (handles S1/S3 cases from decision table)
              await prisma.member.create({
                data: {
                  id: crypto.randomUUID(),
                  userId: user.id,
                  organizationId: orgId,
                  email: userRecord.email,
                  role: "CLIENT",
                  authMethod: "google", // Google OAuth sign-up
                  createdAt: new Date(),
                },
              });
              console.log(
                `🔐 afterSignIn: Created membership for user ${user.id} in organization ${orgId}`
              );
            }
          } else {
            // Validate auth method matches (only Google is supported)
            if (existingMembership.authMethod !== "google") {
              const errorMessage = `This organization requires Google Sign-In. Please use Google to sign in.`;
              console.warn(
                `🔐 afterSignIn: User ${user.id} tried to sign in with Google but membership requires ${existingMembership.authMethod}`
              );
              throw new Error(errorMessage);
            }
            console.log(
              `🔐 afterSignIn: Membership already exists for user ${user.id} in organization ${orgId}`
            );
          }

          // Update session with activeOrganizationId
          if (session?.id) {
            await prisma.session.update({
              where: { id: session.id },
              data: { activeOrganizationId: orgId },
            });
            console.log(
              `✅ afterSignIn: Set activeOrganizationId=${orgId} for session ${session.id}`
            );
          }
        } catch (error) {
          // Log error but don't fail the sign-in process
          console.error(
            `🔐 afterSignIn: Error handling organization membership:`,
            error
          );
        }
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});
