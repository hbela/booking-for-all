# DevOps Template — booking-for-all

## GitHub Actions CI workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, redesign]
  pull_request:

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm check-types

      - name: Server tests
        run: pnpm --filter @booking-for-all/server test:run
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          BETTER_AUTH_SECRET: test-secret-32-characters-minimum

      - name: Build
        run: pnpm build
        env:
          VITE_SERVER_URL: https://api.example.com
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
          VITE_SENTRY_RELEASE: ${{ github.sha }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
```

---

## Dockerfile — apps/server (production)

```dockerfile
FROM node:22-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/i18n/package.json packages/i18n/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @booking-for-all/server build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=build /app/apps/server/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

---

## Deploy script (with migrations + Sentry release)

```bash
#!/usr/bin/env bash
set -euo pipefail

export SENTRY_RELEASE=$(git rev-parse --short HEAD)

echo "▶ Installing dependencies..."
pnpm install --frozen-lockfile

echo "▶ Running database migrations..."
pnpm db:migrate:deploy

echo "▶ Building apps..."
pnpm build

echo "▶ Starting server..."
pnpm --filter @booking-for-all/server start
```
