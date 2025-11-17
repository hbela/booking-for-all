# Testing the Sentry GitHub Action

## Prerequisites

Before testing, ensure you have:

1. ✅ **GitHub Secrets configured** (Settings → Secrets and variables → Actions):
   - `SENTRY_AUTH_TOKEN` - Your Sentry auth token
   - `VITE_SENTRY_DSN` - Your Sentry DSN for the web project

2. ✅ **Local build verified** - The build completed successfully locally

## Testing Steps

### Option 1: Manual Trigger (Recommended for First Test)

1. **Commit and push the workflow file:**
   ```bash
   git add .github/workflows/sentry-release.yml docs/sentry-github-actions.md
   git commit -m "feat: Add automated Sentry release workflow"
   git push origin main
   ```

2. **Manually trigger the workflow:**
   - Go to your GitHub repository
   - Click on **Actions** tab
   - Select **"Sentry Release & Source Maps"** workflow from the left sidebar
   - Click **"Run workflow"** button (top right)
   - Select the branch (usually `main`)
   - Click **"Run workflow"**

3. **Monitor the workflow:**
   - Watch the workflow run in real-time
   - Check each step for success/failure
   - Review logs if any step fails

### Option 2: Automatic Trigger (Production Testing)

1. **Commit and push to main:**
   ```bash
   git add .github/workflows/sentry-release.yml docs/sentry-github-actions.md
   git commit -m "feat: Add automated Sentry release workflow"
   git push origin main
   ```

2. **The workflow will automatically trigger** on push to `main`

3. **Check the Actions tab** to see the workflow running

## What to Verify

After the workflow completes successfully:

1. ✅ **Check Sentry Dashboard:**
   - Go to your Sentry organization
   - Navigate to **Releases**
   - You should see a new release with the commit SHA (e.g., `abc123def456...`)

2. ✅ **Verify Source Maps:**
   - In the release details, check that source maps are uploaded
   - Look for files from both `booking-for-all-web` and `booking-for-all-fastify-api`

3. ✅ **Check Commit Linking:**
   - In the release details, verify that commits are linked
   - You should see the commit message and author

4. ✅ **Test Error Tracking:**
   - Trigger a test error in production (if possible)
   - Verify the error shows the correct release SHA
   - Check that source maps work (you see original source code, not minified)

## Troubleshooting

### Workflow fails at "Create Sentry Release"
- **Issue:** `SENTRY_AUTH_TOKEN` missing or invalid
- **Fix:** Verify the token in GitHub Secrets and ensure it has correct scopes

### Workflow fails at "Build applications"
- **Issue:** `VITE_SENTRY_DSN` missing
- **Fix:** Add `VITE_SENTRY_DSN` to GitHub Secrets

### Source maps not uploading
- **Issue:** Build artifacts not found
- **Fix:** Check that `apps/web/dist` and `apps/server/dist` exist after build step

### Commits not linking
- **Issue:** Git history not available
- **Fix:** The workflow uses `fetch-depth: 0` to get full history. If this fails, check repository permissions.

## Expected Workflow Duration

- **Install dependencies:** ~1-2 minutes
- **Build applications:** ~1-2 minutes
- **Sentry operations:** ~30 seconds
- **Total:** ~3-5 minutes

## Next Steps

Once the workflow is working:

1. ✅ Monitor the first few runs to ensure stability
2. ✅ Verify errors in production link to correct releases
3. ✅ Consider adding notifications (Slack, email) for failed workflows
4. ✅ Review Sentry dashboard to confirm releases are being created correctly

