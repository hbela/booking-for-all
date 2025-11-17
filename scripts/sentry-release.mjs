import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

function run(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function main() {
  console.log("🚀 Starting Sentry release process...");

  const release = process.env.SENTRY_RELEASE;
  if (!release) {
    console.error("❌ Missing SENTRY_RELEASE environment variable.");
    process.exit(1);
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const uploadScript = path.join(scriptDir, "sentry-upload.mjs");

  console.log(`🔖 Creating Sentry release: ${release}`);

  // 1. Create release for all projects
  run(
    `sentry-cli releases new "${release}" \
        --project booking-for-all-web \
        --project booking-for-all-fastify-api`
  );

  // 2. Attach commits
  try {
    run(`sentry-cli releases set-commits "${release}" --auto`);
  } catch {
    console.warn("⚠️ Could not set commits automatically (not fatal).");
  }

  // 3. Upload frontend sourcemaps
  run(
    `node "${uploadScript}" \
        --project booking-for-all-web \
        --dist apps/web/dist \
        --release "${release}"`,
    { env: { ...process.env, SENTRY_RELEASE: release } }
  );

  // 4. Upload backend sourcemaps
  run(
    `node "${uploadScript}" \
        --project booking-for-all-fastify-api \
        --dist apps/server/dist \
        --release "${release}"`,
    { env: { ...process.env, SENTRY_RELEASE: release } }
  );

  // 5. Finalize
  run(`sentry-cli releases finalize "${release}"`);

  console.log("🎉 Sentry release process completed successfully!");
}

main();
