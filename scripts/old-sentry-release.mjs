import fs from "node:fs";
import path from "node:path";

import SentryCli from "@sentry/cli";

function parseArgs(argv) {
  const args = { project: undefined, dist: undefined, release: undefined };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--project" || arg === "-p") {
      args.project = argv[++i];
    } else if (arg.startsWith("--project=")) {
      args.project = arg.split("=", 2)[1];
    } else if (arg === "--dist") {
      args.dist = argv[++i];
    } else if (arg.startsWith("--dist=")) {
      args.dist = arg.split("=", 2)[1];
    } else if (arg === "--release") {
      args.release = argv[++i];
    } else if (arg.startsWith("--release=")) {
      args.release = arg.split("=", 2)[1];
    }
  }

  return args;
}

const cli = new SentryCli();

async function main() {
  const { project: argProject, dist: argDist, release: argRelease } =
    parseArgs(process.argv.slice(2));

  const release =
    argRelease ||
    process.env.SENTRY_RELEASE ||
    (await cli.releases.proposeVersion());

  const distDir =
    argDist ||
    process.env.SENTRY_SOURCEMAPS_DIR ||
    path.resolve("apps/web/dist");

  if (!fs.existsSync(distDir)) {
    console.error(
      `Sentry sourcemap upload skipped: build output not found at ${distDir}.` +
        " Run the web build before invoking this script."
    );
    process.exit(1);
  }

  const projectSlug =
    argProject || process.env.SENTRY_PROJECT || process.env.SENTRY_PROJECT_SLUG;

  if (!projectSlug || projectSlug.trim().length === 0) {
    console.error(
      "Sentry project slug missing. Set SENTRY_PROJECT or pass --project <slug>."
    );
    process.exit(1);
  }

  const project = { projects: [projectSlug.trim()] };

  console.log(`Creating Sentry release ${release}...`);
  try {
    await cli.releases.new(release, project);
  } catch (error) {
    if (
      error &&
      typeof error.message === "string" &&
      /Release with this slug already exists/i.test(error.message)
    ) {
      console.log(`Release ${release} already exists. Continuing.`);
    } else {
      throw error;
    }
  }

  console.log("Uploading source maps to Sentry...");
  await cli.releases.uploadSourceMaps(release, {
    include: [distDir],
    urlPrefix: process.env.SENTRY_SOURCEMAPS_URL_PREFIX || "~/",
    rewrite: true,
  });

  console.log("Finalizing Sentry release...");
  await cli.releases.finalize(release);

  console.log(`Sentry release ${release} finalized.`);
}

main().catch((error) => {
  console.error("Sentry release failed.");
  console.error(error);
  process.exit(1);
});

