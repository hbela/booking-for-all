#!/usr/bin/env tsx
/**
 * One-off script: update user record and send welcome email for Google-auth onboarded owner.
 * Usage: pnpm --filter server exec tsx scripts/send-welcome-email.ts
 */

import prisma from "@booking-for-all/db";
import dotenv from "dotenv";
import path from "path";

// pnpm --filter server exec runs with cwd = apps/server/
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath, override: true });

const TARGET_EMAIL = "elystrade@gmail.com";

async function main() {
  // ── 1. Fetch user ──────────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
  });

  if (!user) {
    console.error(`❌ User not found: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  console.log(`👤 Found user: ${user.name} (${user.id})`);

  // ── 2. Update user record ──────────────────────────────────────────────────
  // User switched to Google OAuth — no password change needed, mark email verified.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      needsPasswordChange: false,
      emailVerified: true,
    },
  });

  console.log(
    `✅ User updated — needsPasswordChange: ${updated.needsPasswordChange}, emailVerified: ${updated.emailVerified}`
  );

  // ── 3. Fetch organization where user is OWNER ──────────────────────────────
  const membership = await prisma.member.findFirst({
    where: {
      userId: user.id,
      role: "OWNER",
    },
    include: {
      organization: true,
    },
  });

  const orgName = membership?.organization?.name ?? "your organization";

  // ── 4. Send welcome email ──────────────────────────────────────────────────
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY not set — skipping email.");
    process.exit(1);
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const frontendUrl =
    process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:3001";
  const loginUrl = `${frontendUrl}/auth/sign-in`;

  console.log(`🔑 RESEND_FROM_EMAIL env: ${process.env.RESEND_FROM_EMAIL}`);
  console.log(`📤 fromEmail resolved: ${fromEmail}`);

  const { Resend } = await import("resend");
  const resend = new Resend(RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: TARGET_EMAIL,
    subject: `Welcome to ${orgName} — Your Organization Dashboard`,
    html: `
      <h2>Welcome to ${orgName}!</h2>
      <p>Dear ${user.name},</p>
      <p>
        Your organization <strong>${orgName}</strong> has been set up successfully,
        and you have been assigned as the <strong>Owner</strong>.
      </p>

      <h3>Your Account</h3>
      <ul>
        <li><strong>Email:</strong> ${TARGET_EMAIL}</li>
        <li><strong>Sign-in method:</strong> Google</li>
        <li><strong>Role:</strong> Owner</li>
      </ul>

      <p>
        You can sign in at any time using your Google account — no password required.
      </p>

      <p>
        <a href="${loginUrl}"
           style="background-color:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:20px;">
          Go to Dashboard
        </a>
      </p>

      <p>Or copy this link into your browser:<br>
        <a href="${loginUrl}">${loginUrl}</a>
      </p>

      <p>If you have any questions, feel free to contact us.</p>

      <p>Best regards,<br>Administration Team</p>
    `,
  });

  if (error) {
    console.error("❌ Failed to send welcome email:", error);
    process.exit(1);
  }

  console.log(`📧 Welcome email sent to ${TARGET_EMAIL}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
