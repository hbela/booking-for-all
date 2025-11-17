# Sentry Release Automation with GitHub Actions

This document describes the automated Sentry release and source map management setup using GitHub Actions.

## Overview

The GitHub Actions workflow automatically:
1. Creates a Sentry release using the GitHub commit SHA
2. Links commits to the release for better error tracking
3. Uploads source maps for both `booking-for-all-web` and `booking-for-all-fastify-api` projects
4. Finalizes the release

This allows you to trace production errors back to the exact GitHub commit that introduced them.

## Workflow Trigger

The workflow (`/.github/workflows/sentry-release.yml`) runs automatically on:
- **Push to `main` branch** - Automatically creates a release for production deployments
- **Manual trigger** - Can be triggered manually via GitHub Actions UI for testing

## Required GitHub Secrets

You need to configure the following secrets in your GitHub repository:

1. **`SENTRY_AUTH_TOKEN`** (Required)
   - Your Sentry authentication token
   - Get it from: Sentry → Settings → Account → Auth Tokens
   - Needs `project:releases` and `org:read` scopes

2. **`VITE_SENTRY_DSN`** (Required for web build)
   - Your Sentry DSN for the web project
   - Used during the build process to inject Sentry configuration

**Note:** You do **NOT** need to add `SENTRY_DSN` (server DSN) to GitHub secrets. The server DSN is only needed at runtime in your production environment (e.g., Coolify), not during the GitHub Actions build process. The server build only compiles TypeScript and doesn't require the DSN at build time.

To add secrets:
1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with the name and value

## Release Identifier

The workflow uses the **GitHub commit SHA** (`${{ github.sha }}`) as the Sentry release identifier. This means:
- Each commit to `main` gets its own Sentry release
- You can directly link errors in Sentry to the exact commit
- The release name matches the commit SHA (e.g., `abc123def456...`)

## How It Works

1. **Build Phase**: The workflow builds both applications with the commit SHA as the release identifier
2. **Release Creation**: Creates a Sentry release for both projects using the commit SHA
3. **Commit Linking**: Automatically links the commit to the release (enables "Suspect Commits" in Sentry)
4. **Source Map Upload**: Uploads source maps from both `apps/web/dist` and `apps/server/dist`
5. **Finalization**: Finalizes the release, making it active in Sentry

## Manual Release (For Testing)

The manual release scripts remain available for local testing:

```bash
# Set the release identifier
export SENTRY_RELEASE=your-release-id

# Run the release script
pnpm deploy:sentry
```

Or use the individual scripts:

```bash
# Create release and upload source maps
node scripts/sentry-release.mjs

# Or upload source maps individually
pnpm sentry:release:web
pnpm sentry:release:server
```

## Troubleshooting

### Workflow fails with "Missing SENTRY_AUTH_TOKEN"
- Ensure `SENTRY_AUTH_TOKEN` is set in GitHub repository secrets
- Verify the token has the correct scopes

### Source maps not uploading
- Check that the build completed successfully
- Verify `apps/web/dist` and `apps/server/dist` exist after build
- Check Sentry CLI logs in the workflow output

### Commits not linking
- The workflow uses `fetch-depth: 0` to get full git history
- Ensure the repository has proper git history
- Check that Sentry has access to your GitHub repository (Settings → Integrations)

### Release already exists
- Sentry releases are unique per identifier
- If a commit SHA is reused (force push), the release will be updated
- This is expected behavior

## Benefits

✅ **Automatic**: No manual steps required for production deployments  
✅ **Traceable**: Every error links to the exact commit SHA  
✅ **Source Maps**: Production errors show original source code  
✅ **Suspect Commits**: Sentry can identify which commit likely introduced a bug  
✅ **Manual Override**: Still supports manual releases for testing

