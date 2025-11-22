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

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  trustedOrigins: [process.env.CORS_ORIGIN || ""],
  databaseHooks: {
    user: {
      read: {
        async after(user) {
          // Ensure role and needsPasswordChange are included
          console.log("🔍 User read from database:", {
            email: user.email,
            role: user.role,
            needsPasswordChange: user.needsPasswordChange,
          });
          return user;
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      // Send password reset email via Resend
      console.log(`Password reset for ${user.email}: ${url}`);
      // TODO: Implement with Resend
    },
  },
  hooks: {
    user: {
      create: {
        before: async (user) => {
          // Override better-auth's default "user" role with our enum "CLIENT"
          return {
            data: {
              ...user,
              role: "CLIENT", // Set to uppercase CLIENT instead of lowercase "user"
            },
          };
        },
        after: async (user) => {
          // Send welcome email after user is created
          try {
            const { Resend } = await import("resend");
            const resend = new Resend(process.env.RESEND_API_KEY);

            const fromEmail =
              process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

            console.log("📧 Sending welcome email to new user:", user.email);

            await resend.emails.send({
              from: fromEmail,
              to: user.email,
              subject: "Welcome to Our Platform!",
              html: `
                <h2>Welcome!</h2>
                <p>Dear ${user.name},</p>
                <p>Thank you for signing up! Your account has been successfully created.</p>
                
                <h3>Getting Started:</h3>
                <ul>
                  <li><strong>Browse Providers:</strong> Find healthcare providers near you</li>
                  <li><strong>Book Appointments:</strong> Schedule appointments easily</li>
                  <li><strong>Manage Bookings:</strong> View and manage your appointments</li>
                </ul>
                
                <p>You can now login at: ${
                  process.env.CORS_ORIGIN || "http://localhost:3001"
                }</p>
                
                <p>If you have any questions, feel free to contact us.</p>
                
                <p>Best regards,<br>The Team</p>
              `,
            });

            console.log("✅ Welcome email sent to:", user.email);
          } catch (emailError) {
            console.error("❌ Failed to send welcome email:", emailError);
            // Don't fail user creation if email fails
          }
        },
      },
    },
    session: {
      created: async (session) => {
        // Ensure role and needsPasswordChange are in session
        console.log("🔐 Session created for user:", session.user.email);
        console.log("🔐 Session user data:", {
          role: session.user.role,
          needsPasswordChange: session.user.needsPasswordChange,
        });
        return session;
      },
    },
  },
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
