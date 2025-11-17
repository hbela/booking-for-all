import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import SentryCli from "@sentry/cli";

/**
 * Parses CLI arguments
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    const next = argv[i + 1];

    if (arg === "--project") {
      args.project = next;
      i++;
    } else if (arg.startsWith("--project=")) {
      args.project = arg.split("=")[1];
    }

    if (arg === "--dist") {
      args.dist = next;
      i++;
    } else if (arg.startsWith("--dist=")) {
      args.dist = arg.split("=")[1];
    }

    if (arg === "--release") {
      args.release = next;
      i++;
    } else if (arg.startsWith("--release=")) {
      args.release = arg.split("=")[1];
    }
  }
  return args;
}

/**
 * Uploads source maps for a project
 */
async function uploadSourceMaps({ project, dist, release }) {
  const cli = new SentryCli();

  // resolve release
  const resolvedRelease =
    release ||
    process.env.SENTRY_RELEASE ||
    (await cli.releases.proposeVersion());

  if (!resolvedRelease) {
    throw new Error("❌ Could not determine Sentry release ID.");
  }

  // resolve build output dir
  const distDir = dist || process.env.SENTRY_SOURCEMAPS_DIR || null;

  if (!project) {
    throw new Error(
      "❌ Missing Sentry project slug. Pass `--project <slug>` or set $SENTRY_PROJECT."
    );
  }

  if (!distDir) {
    throw new Error(
      "❌ Missing distribution directory. Pass `--dist <dir>` or set $SENTRY_SOURCEMAPS_DIR."
    );
  }

  const resolvedDistDir = path.resolve(distDir);

  if (!fs.existsSync(resolvedDistDir)) {
    throw new Error(
      `❌ The build directory does not exist:\n   ${resolvedDistDir}\n` +
        "Make sure your project is built before uploading source maps."
    );
  }

  console.log("------------------------------------------------------------");
  console.log(`📦  Uploading source maps`);
  console.log(`📁  Project:  ${project}`);
  console.log(`📂  Dist:     ${resolvedDistDir}`);
  console.log(`🔖  Release:  ${resolvedRelease}`);
  console.log("------------------------------------------------------------");

  await cli.releases.uploadSourceMaps(resolvedRelease, {
    include: [resolvedDistDir],
    rewrite: true,
    projects: [project],
    urlPrefix: "~/",
  });

  console.log(`✅ Source maps uploaded for project "${project}".`);
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    const project =
      args.project ||
      process.env.SENTRY_PROJECT ||
      process.env.SENTRY_PROJECT_SLUG;

    await uploadSourceMaps({
      project,
      dist: args.dist,
      release: args.release,
    });
  } catch (err) {
    console.error("\n❌ Sentry Source Map Upload Failed:\n");
    console.error(err.message ?? err);
    process.exit(1);
  }
}

main();
