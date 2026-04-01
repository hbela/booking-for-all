#!/usr/bin/env tsx
/**
 * One-time script to set the email+password credentials for the system admin.
 *
 * The admin user (hajzerbela@gmail.com) was originally created via Google OAuth
 * and has no credential account.  This script upserts a "credential" account
 * row so the admin can log in via the dedicated /admin/login page.
 *
 * Usage:
 *   ADMIN_PASSWORD=<secret> tsx scripts/set-admin-password.ts
 *
 * Or interactively (will prompt for password):
 *   tsx scripts/set-admin-password.ts
 */

import readline from "readline";
// Relative import — avoids workspace resolution issues when running from root.
// The db package loads apps/server/.env itself via its own __dirname logic.
import prisma from "../packages/db/src/index.ts";
// Better-auth's own scrypt-based hasher — guarantees identical format to what
// the runtime uses when it verifies the password on sign-in.
import { hashPassword } from "better-auth/crypto";
import crypto from "crypto";

const ADMIN_EMAIL = "hajzerbela@gmail.com";

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const password = process.env.ADMIN_PASSWORD || (await prompt("New admin password: "));
  if (!password || password.length < 8) {
    console.error("❌ Password must be at least 8 characters.");
    process.exit(1);
  }

  // Find the admin user
  const user = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, isSystemAdmin: true },
  });

  if (!user) {
    console.error(`❌ User ${ADMIN_EMAIL} not found in the database.`);
    process.exit(1);
  }

  if (!user.isSystemAdmin) {
    console.error(`❌ ${ADMIN_EMAIL} exists but isSystemAdmin is false. Aborting.`);
    process.exit(1);
  }

  const hash = await hashPassword(password);

  // Better-auth credential accounts use:
  //   providerId  = "credential"
  //   accountId   = user's email
  const existing = await prisma.account.findUnique({
    where: { providerId_accountId: { providerId: "credential", accountId: ADMIN_EMAIL } },
  });

  if (existing) {
    await prisma.account.update({
      where: { providerId_accountId: { providerId: "credential", accountId: ADMIN_EMAIL } },
      data: { password: hash, updatedAt: new Date() },
    });
    console.log("✅ Admin password updated.");
  } else {
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: ADMIN_EMAIL,
        providerId: "credential",
        userId: user.id,
        password: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log("✅ Admin credential account created with the provided password.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
