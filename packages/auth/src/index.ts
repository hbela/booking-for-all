import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@booking-for-all/db";
import { organization, admin, apiKey } from "better-auth/plugins";
import { initI18n } from "@booking-for-all/i18n";

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

            // Initialize i18n and detect language (default to "en")
            const i18n = await initI18n();
            const lang = "en"; // Default to English for welcome emails (can be enhanced later with user preference)

            console.log("📧 Sending welcome email to new user:", user.email);

            const loginUrl = process.env.CORS_ORIGIN || "http://localhost:3001";

            await resend.emails.send({
              from: fromEmail,
              to: user.email,
              subject: i18n.t("emails.welcome.subject", { lng: lang }),
              html: `
                <h2>${i18n.t("emails.welcome.greeting", { lng: lang })}</h2>
                <p>${i18n.t("emails.welcome.dear", { lng: lang, name: user.name })}</p>
                <p>${i18n.t("emails.welcome.thankYouSignUp", { lng: lang })}</p>
                
                <h3>${i18n.t("emails.welcome.gettingStarted", { lng: lang })}</h3>
                <ul>
                  <li><strong>${i18n.t("emails.welcome.browseProviders", { lng: lang })}</strong></li>
                  <li><strong>${i18n.t("emails.welcome.bookAppointments", { lng: lang })}</strong></li>
                  <li><strong>${i18n.t("emails.welcome.manageBookings", { lng: lang })}</strong></li>
                </ul>
                
                <p>${i18n.t("emails.welcome.loginAt", { lng: lang, url: loginUrl })}</p>
                
                <p>${i18n.t("emails.welcome.questions", { lng: lang })}</p>
                
                <p>${i18n.t("emails.welcome.bestRegards", { lng: lang })}<br>${i18n.t("emails.welcome.theTeam", { lng: lang })}</p>
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
        
        // Send mobile app notification email (one-time, after app launch)
        try {
          const { sendMobileAppNotificationEmail } = await import("../../server/src/features/notifications/mobile-app-email.js");
          // Get user language preference (default to 'en')
          const lang = (session.user as any).language || "en";
          await sendMobileAppNotificationEmail(
            session.user.id,
            session.user.email,
            session.user.name,
            lang
          );
        } catch (error) {
          // Don't fail session creation if email fails
          console.error("Failed to send mobile app notification:", error);
        }
        
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
