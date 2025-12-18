import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@booking-for-all/db";
import { organization, admin, apiKey } from "better-auth/plugins";

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

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  trustedOrigins:
    uniqueTrustedOrigins.length > 0 ? uniqueTrustedOrigins : undefined,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }: { user: any; url: string }) => {
      // Send password reset email via Resend
      console.log(`Password reset for ${user.email}: ${url}`);
      // TODO: Implement with Resend
    },
  },
  // Note: User creation hooks are handled via Prisma extensions in @booking-for-all/db
  // Session hooks and email notifications are handled in apps/server/src/plugins/authz.ts
  advanced: {
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production", // Allow insecure cookies in development
      httpOnly: true,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "CLIENT",
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
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});
