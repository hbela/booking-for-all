import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

console.log("Starting Sentry release process...");

try {
  const uploadScript = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "sentry-upload.mjs"
  );

  // 1. Propose a version and store it in a variable.
  const release = execSync("sentry-cli releases propose-version")
    .toString()
    .trim();
  console.log(`Creating Sentry release: ${release}`);

  // 2. Create the new release and associate it with all relevant projects.
  execSync(
    `sentry-cli releases new "${release}" --project booking-for-all-fastify-api --project booking-for-all-web`,
    { stdio: "inherit" }
  );

  // 3. Associate commits with the release (best-effort).
  try {
    execSync(`sentry-cli releases set-commits "${release}" --auto`, {
      stdio: "inherit",
    });
  } catch (commitError) {
    console.warn(
      "Warning: Unable to automatically associate commits with the release."
    );
    console.warn(commitError?.message ?? commitError);
  }

  const sharedEnv = {
    ...process.env,
    SENTRY_RELEASE: release,
  };

  console.log("Uploading source maps for booking-for-all-web...");
  execSync(
    `node "${uploadScript}" --project booking-for-all-web --dist apps/web/dist --release "${release}"`,
    {
      stdio: "inherit",
      env: sharedEnv,
    }
  );

  console.log("Uploading source maps for booking-for-all-fastify-api...");
  execSync(
    `node "${uploadScript}" --project booking-for-all-fastify-api --dist apps/server/dist --release "${release}"`,
    {
      stdio: "inherit",
      env: sharedEnv,
    }
  );

  // 4. Finalize the release.
  execSync(`sentry-cli releases finalize "${release}"`, {
    stdio: "inherit",
  });

  console.log("Sentry release process completed successfully!");
} catch (error) {
  console.error("Sentry release process failed:");
  process.exit(1);
}
