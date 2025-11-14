import fs from "node:fs";
import path from "node:path";

import SentryCli from "@sentry/cli";

function parseArgs(argv) {
  const args = { project: undefined, dist: undefined, release: undefined };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--project" || arg === "-p") {
      args.project = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--project=")) {
      args.project = arg.split("=", 2)[1];
      continue;
    }

    if (arg === "--dist") {
      args.dist = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--dist=")) {
      args.dist = arg.split("=", 2)[1];
      continue;
    }

    if (arg === "--release") {
      args.release = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--release=")) {
      args.release = arg.split("=", 2)[1];
    }
  }

  return args;
}

async function uploadSourceMaps({ project, dist, release }) {
  const cli = new SentryCli();

  const resolvedRelease =
    release || process.env.SENTRY_RELEASE || (await cli.releases.proposeVersion());

  const distDir =
    dist ||
    process.env.SENTRY_SOURCEMAPS_DIR ||
    path.resolve("apps/web/dist");

  if (!project) {
    throw new Error("Sentry project slug missing. Pass --project <slug> or set SENTRY_PROJECT.");
  }

  if (!fs.existsSync(distDir)) {
    throw new Error(
      `Sentry sourcemap upload skipped: build output not found at ${distDir}. ` +
        "Run the appropriate build step before invoking this script."
    );
  }

  console.log(
    `Uploading source maps for project "${project}" from "${distDir}" with release "${resolvedRelease}".`
  );

  await cli.releases.uploadSourceMaps(resolvedRelease, {
    include: [distDir],
    rewrite: true,
    projects: [project],
  });

  console.log("Source maps uploaded successfully.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const project =
    args.project || process.env.SENTRY_PROJECT || process.env.SENTRY_PROJECT_SLUG;

  await uploadSourceMaps({
    project,
    dist: args.dist,
    release: args.release,
  });
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});

