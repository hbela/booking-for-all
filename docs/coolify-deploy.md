# Coolify Deployment Guide

## Prerequisites
- Hetzner VPS is reachable and has DNS A records for `api.appointer.hu`, `app.appointer.hu`, `legacy.appointer.hu`, and `landing.appointer.hu` pointing to the server IP.
- Coolify is installed and you can log in as an administrator.
- GitHub deploy key or personal access token with read access to `hbela/my-better-t-app` is configured inside Coolify (Settings -> Git providers).
- A production PostgreSQL instance is available (Coolify can provision one under Resources -> Database -> Add -> PostgreSQL) and you have the connection string.

## 1. Prepare the Repository
1. Clone the repository to a workstation with Node 20+ and PNPM 10+: `git clone https://github.com/hbela/my-better-t-app.git && cd my-better-t-app`.
2. Make sure the Turbo cache is up to date by running `pnpm install` once locally.
3. Run a production smoke build (and ensure Prisma Client artifacts are available):
   - `pnpm --filter @booking-for-all/db exec prisma generate --no-engine`
   - `pnpm turbo run build --filter=server`
   - `pnpm turbo run build --filter=web`
   Correct any failures before continuing.
4. Apply pending Prisma migrations against your production database:
   - Set `DATABASE_URL` locally.
   - Run `pnpm db:migrate` from the repository root.
   - Verify the new schema with `pnpm db:generate` if required.

## 2. Collect Environment Secrets
Add the following variables in Coolify -> Project -> Environment. Use the same values across services unless noted.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Connection string for your Prisma Data Proxy / PostgreSQL (see `.env` lines 17-19).
| `BETTER_AUTH_SECRET` | Yes | Auth secret shared with the `@booking-for-all/auth` package.
| `BETTER_AUTH_URL` | Yes | Public server URL (for example `https://api.appointer.hu`).
| `CORS_ORIGIN` | Yes | Browser origin hitting the API (`https://app.appointer.hu`).
| `FRONTEND_URL` | Yes | Same as above; used for transactional emails.
| `RESEND_API_KEY` | Yes | Resend transactional email API key.
| `RESEND_FROM_EMAIL` | Yes | Default sender (for example `support@appointer.hu`).
| `PHP_SERVER_URL` | Yes | URL of the PHP legacy endpoint (`https://legacy.appointer.hu`).
| `POLAR_ACCESS_TOKEN` | Conditional | Required if Polar subscriptions are active.
| `POLAR_PRODUCT_ID` | Conditional | Polar product identifier used in subscription flows.
| `POLAR_WEBHOOK_SECRET` | Conditional | Needed if receiving Polar webhooks.
| `POLAR_SUCCESS_URL` | Conditional | Overrides checkout redirect, defaults to `${CORS_ORIGIN}/owner`.
| `POLAR_SANDBOX` | Optional | Set to `true` to use Polar sandbox.
| `RATE_LIMIT_*` | Optional | Fine-tune external API rate limits (`RATE_LIMIT_MAX_REQUESTS`, etc.).
| `LOG_LEVEL` | Optional | Defaults to `info`.

Tip: Coolify supports environment groups. Create one called `booking-for-all` and attach it to each service so you maintain the variables only once.

## 3. Create the Services in Coolify
1. In Coolify, go to Projects -> select (or create) a project for Booking for All.
2. Click Add New Service -> Application -> Git Repository.
3. Fill in the repository (`https://github.com/hbela/my-better-t-app.git`), choose branch `main`, and set the root directory according to the service.
4. For the API service select the Docker build pack and set Dockerfile path to `apps/server/Dockerfile` (added in this repo). This avoids Nixpacks on arm64 and runs the same pnpm/prisma commands via the Docker image.
5. For the SPA (`apps/web`) you can now point the Docker build pack at `apps/web/Dockerfile`. The PHP and landing services can stay on the Git workflow with the commands from the YAML files (or use Dockerfiles if desired).
6. Attach the environment group created in step 2, pick the desired CPU/RAM limits, and create the service. Repeat for each application above.

## 4. Service-Specific Notes
- **server (`api.appointer.hu`)**
  - Exposes port `3000`; Coolify will proxy HTTP and HTTPS automatically when the domain is verified.
  - Start command runs `pnpm --filter server run start`; `HOST=0.0.0.0` is pre-configured.
  - Remember to enable HTTPS in Coolify (toggle Let's Encrypt once DNS is live).
- **web (`app.appointer.hu`)**
  - Build pipeline installs PNPM/Turbo, builds via Vite, then uses `vite preview` on port `4173` with host binding.
  - `VITE_SERVER_URL` points at the API domain so client requests resolve correctly.
- **php-endpoint (`legacy.appointer.hu`)**
  - Document root defaults to the repository root; place legacy PHP scripts under `php/` or adjust `document_root` before redeploying.
  - If the PHP application needs environment variables, add them in Coolify under this service.
- **landing (`landing.appointer.hu`)**
  - Uses the `landing/` directory and serves the static files directly (no build step by default).
  - Replace the placeholder build command in `coolify/landing.yaml` if you adopt a static site generator.

## 5. First Deployment
1. Back in the project dashboard, trigger Deploy on the server service first. Wait until the container is healthy.
2. Deploy the PHP service if required (ensures legacy endpoints are reachable).
3. Deploy the landing and web services next. Static deployments finish quickly; the Vite preview service will keep running to serve the SPA.
4. Verify container logs via Coolify -> Deployment -> Logs. Check Fastify boot logs for database connection success and Prisma migrations.

## 6. Post-Deployment Checks
- API health: `https://api.appointer.hu/health` should return 200 and indicate Prisma connected.
- Web app: log into `https://app.appointer.hu` and exercise a booking flow.
- Emails: trigger a password reset and confirm the message arrives via Resend.
- Subscriptions (if Polar enabled): create a checkout and ensure the redirect URL works.
- Legacy PHP endpoint: call a known route to confirm the document root is correct.

## 7. Ongoing Operations
- To ship new backend migrations or schema changes: push to `main`, then redeploy the server service; the build step runs `pnpm --filter @booking-for-all/db exec prisma generate --no-engine` followed by `pnpm turbo run build --filter=server` to refresh Prisma artifacts.
- Use Coolify deployment hooks or webhooks from GitHub for auto-deploys.
- Monitor resource usage from Infrastructure -> Servers; upgrade the VPS or adjust limits if CPU throttling occurs.
- Keep PNPM/Turbo versions in `coolify/*.yaml` aligned with `package.json`. Update the YAML and redeploy if you bump the toolchain.

## Troubleshooting
- **Build fails with missing PNPM/Turbo**: ensure the build command installs `pnpm` and `turbo` globally (already present in the YAML). Verify the server has internet access.
- **Database connection errors**: double-check `DATABASE_URL` and that the Hetzner firewall allows outbound access to the database.
- **CORS issues**: confirm `CORS_ORIGIN` and `FRONTEND_URL` point at the HTTPS web domain.
- **Vite client hitting HTTP**: if the API uses HTTPS, make sure `VITE_SERVER_URL` uses `https://`.
- **Legacy PHP 404**: adjust `php.yaml` -> `document_root` to the folder containing your `index.php` and redeploy.

Happy shipping!






