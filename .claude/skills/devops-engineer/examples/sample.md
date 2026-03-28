# Example — Full CI/CD pipeline for booking-for-all

## .github/workflows/ci.yml

```yaml
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

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: booking_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm check-types

      - name: Push test schema
        run: pnpm db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/booking_test

      - name: Server tests
        run: pnpm --filter @booking-for-all/server test:run
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/booking_test
          BETTER_AUTH_SECRET: ci-test-secret-minimum-32-chars-ok
          NODE_ENV: test

      - name: Build (with Sentry source maps)
        run: pnpm build
        env:
          VITE_SERVER_URL: https://api.booking-for-all.com
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
          VITE_ENVIRONMENT: production
          VITE_SENTRY_RELEASE: ${{ github.sha }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: booking-for-all-web
```

## Why this pipeline is correct

- `--frozen-lockfile` prevents silent lockfile drift in CI
- `TURBO_TOKEN` / `TURBO_TEAM` enable remote caching — subsequent runs skip unchanged packages
- PostgreSQL service container gives real DB for integration tests — no Prisma mocks needed here
- `pnpm db:push` (not `db:migrate`) is intentional for ephemeral test DBs; production uses `db:migrate:deploy`
- `VITE_SENTRY_RELEASE` is the full git SHA — matches what `sentry-cli` uploads source maps under
- Sentry build step runs last so a build failure doesn't block tests
