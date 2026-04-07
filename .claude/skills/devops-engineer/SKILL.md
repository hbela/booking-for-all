---
name: devops-engineer
description: CI/CD, Docker, deployment, and Turbo remote cache configuration for the booking-for-all pnpm monorepo.
---

# DevOps Engineer Skill — booking-for-all

## Purpose
Configure CI/CD pipelines, Docker images, deployment scripts, and Turbo remote caching for the booking-for-all monorepo. Covers GitHub Actions workflows, environment variable management, database migration automation, and Sentry release publishing.

## When to Use
- Setting up or updating a GitHub Actions CI workflow
- Writing a Dockerfile for `apps/server` or `apps/web`
- Automating `pnpm db:migrate:deploy` in a deployment pipeline
- Configuring Turbo remote cache for faster CI builds
- Debugging pnpm/Turbo cache invalidation issues
- Managing environment-specific configs (staging vs production)

## How to Use This Skill

1. Identify the target: CI pipeline, Docker build, deployment script, or Turbo config.
2. Read the relevant existing config files first.
3. Apply changes following the rules below.
4. Verify locally with `pnpm build` before pushing.

## Key Rules

### pnpm in CI — always freeze lockfile
```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10
- run: pnpm install --frozen-lockfile
```

### Turbo pipeline — respect cache:false tasks
```json
// turbo.json — dev and db:* tasks must NOT be cached
{
  "tasks": {
    "dev":          { "cache": false, "persistent": true },
    "db:push":      { "cache": false },
    "db:generate":  { "cache": false },
    "build":        { "dependsOn": ["^build"], "outputs": ["dist/**"] }
  }
}
```

### Turbo remote cache (CI speedup)
```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

### GitHub Actions — full CI workflow pattern
```yaml
name: CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm check-types
      - run: pnpm --filter @booking-for-all/server test:run
      - run: pnpm build
```

### Dockerfile — apps/server
```dockerfile
FROM node:22-alpine AS base
RUN npm install -g pnpm@10

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @booking-for-all/server build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
```

### Database migrations in deployment
```bash
# Run BEFORE starting the new server instance
pnpm db:migrate:deploy
# Then start the server
pnpm --filter @booking-for-all/server start
```
Never run `db:push` in production — always `db:migrate:deploy`.

### Sentry release on deploy
```bash
export SENTRY_RELEASE=$(git rev-parse --short HEAD)
pnpm --filter @booking-for-all/web build
# sentry-cli is called automatically via the vite build script
```

### Environment variable checklist per environment
| Variable | Dev | Staging | Prod |
|----------|-----|---------|------|
| `DATABASE_URL` | Accelerate local | Accelerate staging | Accelerate prod |
| `BETTER_AUTH_SECRET` | any 32+ chars | secrets manager | secrets manager |
| `NODE_ENV` | `development` | `staging` | `production` |
| `CORS_ORIGIN` | `http://localhost:3001` | staging URL | prod URL |
| `STRIPE_*` | test keys | test keys | live keys |

## Common Pitfalls
| Problem | Fix |
|---------|-----|
| `pnpm install` fails in Docker | Use `--frozen-lockfile`; ensure `pnpm-lock.yaml` is committed |
| Turbo cache miss on every CI run | Check `TURBO_TOKEN` / `TURBO_TEAM` are set; verify `outputs` in `turbo.json` |
| Migration fails in prod | Ensure `DATABASE_URL` points to direct Postgres (not Accelerate) for migration runs |
| Server won't start after deploy | Check all required env vars are present; `LOG_LEVEL=debug` to see startup errors |
| Source maps missing in Sentry | `SENTRY_AUTH_TOKEN` must be set during `pnpm build` in CI |
