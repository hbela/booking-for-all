import { execSync } from "child_process";

console.log("Starting Sentry release process...");

try {
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

  // 3. Associate commits with the release.
  execSync(`sentry-cli releases set-commits "${release}" --auto`, {
    stdio: "inherit",
  });

  // 4. Set the release environment variable for the next command.
  process.env.SENTRY_RELEASE = release;

  // 5. Run turbo to upload source maps for all workspaces.
  console.log("Uploading source maps for all projects...");
  execSync("turbo run sentry:release", { stdio: "inherit" });

  console.log("Sentry release process completed successfully!");
} catch (error) {
  console.error("Sentry release process failed:");
  // The error from the child process is already printed to stderr because of stdio: 'inherit'
  process.exit(1);
}
