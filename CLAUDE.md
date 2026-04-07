# booking-for-all — Project Guide for Claude

## Overview

**Production-grade B2B booking SaaS** — a pnpm monorepo with Turbo orchestration.
Multi-tenant, role-based, with payments, i18n (EN/HU/DE), and real-time error tracking.

```
booking-for-all/
├── apps/
│   ├── server/     # Fastify 5 API backend
│   └── web/        # Vite + React 19 SPA frontend
├── packages/
│   ├── db/         # Prisma client + PostgreSQL schema
│   ├── auth/       # Better-auth configuration
│   └── i18n/       # Typed locale exports (EN, HU, DE)
```

**Package manager:** pnpm 10 (`node-linker=hoisted`)
**Build orchestration:** Turbo 2.5

---

## Common Commands

### Root (run from repo root)
```bash
pnpm dev              # Start all apps (turbo dev)
pnpm dev:server       # Server only
pnpm dev:web          # Web only
pnpm build            # Build all apps
pnpm check-types      # TypeScript check all packages

pnpm db:push          # prisma db push (dev)
pnpm db:migrate       # Create migration
pnpm db:migrate:deploy # Deploy migrations (prod)
pnpm db:generate      # Regenerate Prisma client
pnpm db:studio        # Prisma Studio GUI
```

### Server (apps/server)
```bash
pnpm dev              # tsx watch src/server.ts
pnpm build            # tsdown bundle → dist/
pnpm start            # node dist/server.js
pnpm test             # vitest
pnpm test:run         # vitest run (CI)
```

### Web (apps/web)
```bash
pnpm dev              # Vite dev server on port 3001
pnpm build            # vite build + prerender + sitemap
pnpm build:no-prerender
pnpm serve            # vite preview
```

---

## Tech Stack

### Backend (apps/server)
- **Fastify 5** — HTTP framework with Zod type-provider
- **Prisma + PostgreSQL** via Prisma Accelerate (connection pooling)
- **Better-auth 1.3** — Auth with Google OAuth, org/admin/API-key plugins
- **Resend** — Transactional email
- **AWS S3 / Cloudflare R2** — File storage
- **Stripe** — Subscription & payment management
- **Sentry** — Error tracking + performance profiling
- **i18next** — Server-side i18n

### Frontend (apps/web)
- **Vite 6 + React 19**
- **TanStack Router** — File-based routing with prerendering (Puppeteer)
- **TanStack Query 5** — Data fetching & caching
- **TanStack Form** — Form state management
- **Tailwind CSS 4** — Styling
- **Radix UI** — Accessible UI primitives
- **Sentry React** — Client-side error tracking
- **react-big-calendar** — Provider/booking calendar UI
- **sonner** — Toast notifications
- **i18next** — Browser-side i18n with language detector

### Shared Packages
| Package | Purpose |
|---------|---------|
| `@booking-for-all/db` | Prisma client, Accelerate extension |
| `@booking-for-all/auth` | Better-auth instance |
| `@booking-for-all/i18n` | Typed locale strings |

---

## Architecture

### Multi-tenancy
- Organization-scoped data. Every request injects `activeOrganizationId` from the session.
- `orgApp` plugin (apps/server/src/plugins/orgApp.ts) attaches org context to Fastify.

### RBAC (Role-Based Access Control)
| Role | Scope |
|------|-------|
| ADMIN | System-wide superuser (`User.isSystemAdmin`) |
| OWNER | Full org management |
| PROVIDER | Manage own schedule/events |
| CLIENT | Make and view bookings |

Authorization enforced in `apps/server/src/plugins/authz.ts`.

### Authentication Flow
1. Google OAuth via Better-auth
2. Session stored in cookies (`sameSite: none` for HTTPS)
3. `activeOrganizationId` tracked in session
4. Membership created via Prisma extension on first org join

### Database Models (key ones)
```
Organization → Members (role) → User
Organization → Department → Provider → Event → Booking
User → Subscription → Product
Subscription → Payment[]
User → apikey[]
```
Schema: `packages/db/prisma/schema/schema.prisma`

### Frontend Route Structure
```
/auth/*           — Login, signup, OAuth callback
/client/organizations/*  — Client booking UI
/owner/*          — Org & subscription management
/provider/*       — Provider schedule management
/admin/*          — System administration
```

### External Integrations
- **Stripe** — Subscriptions: webhook at `/webhooks/stripe`
- **n8n voice agent** — Webhook at `/webhooks/n8n` (`N8N_WEBHOOK_URL`)
- **Sentry tunnel** — `/api/sentry-tunnel` (bypasses ad blockers)

---

## Environment Variables

### Server (apps/server/.env) — required
```
DATABASE_URL           # Prisma Accelerate URL
BETTER_AUTH_SECRET     # Auth signing key
BETTER_AUTH_URL        # e.g. http://localhost:3000
CORS_ORIGIN            # e.g. http://localhost:3001
FRONTEND_URL           # Same as CORS_ORIGIN
SENTRY_DSN
```

### Server — optional
```
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
RESEND_API_KEY / RESEND_FROM_EMAIL
S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET / S3_REGION
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_ID_MONTHLY / STRIPE_PRICE_ID_YEARLY
N8N_WEBHOOK_URL / INTERNAL_WEBHOOK_SECRET
LOG_LEVEL / NODE_ENV
```

### Web (Vite build-time)
```
VITE_SERVER_URL        # API backend URL
VITE_SENTRY_DSN
VITE_ENVIRONMENT
VITE_SENTRY_RELEASE
```

### Database (packages/db/.env)
```
DATABASE_URL           # Direct PostgreSQL URL (for migrations/introspection)
DIRECT_URL             # Alternative direct URL
```

---

## Key File Locations

| What | Where |
|------|-------|
| Prisma schema | `packages/db/prisma/schema/schema.prisma` |
| Fastify server entry | `apps/server/src/server.ts` |
| Fastify app | `apps/server/src/app.ts` |
| Auth plugin | `apps/server/src/plugins/auth.ts` |
| Org context plugin | `apps/server/src/plugins/orgApp.ts` |
| Authorization plugin | `apps/server/src/plugins/authz.ts` |
| Route features | `apps/server/src/features/` |
| Vite config | `apps/web/vite.config.ts` |
| Web routes | `apps/web/src/routes/` |
| Shared auth config | `packages/auth/src/` |
| i18n locales | `packages/i18n/src/` |

---

## Available Skills

Invoke these with `/skill-name` or via the Skill tool.

| Skill | Trigger |
|-------|---------|
| `fastify` | Adding/extending API route modules in `apps/server` (Fastify 5 + Zod + Swagger) |
| `prisma` | Schema changes, queries, transactions, error handling in `packages/db` |
| `tanstack-query-fastify` | New data-fetching hooks, mutations, cache invalidation in `apps/web` |
| `tanstack-router-fastify` | New file-based routes, auth guards, loaders, search params in `apps/web` |
| `react-expert` | React 19 components with Radix UI, Tailwind CSS 4, TanStack Form, sonner, i18next |
| `typescript-pro` | Strict TypeScript, Zod inference, Prisma payload types, ESM imports |
| `secure-code-guardian` | Auth guards, RBAC via `authz`, org scoping, webhook signature verification |
| `test-master` | Vitest tests for Fastify routes (`app.inject`) and React components |
| `monitoring-expert` | Sentry error capture, structured Fastify logging, performance spans |
| `devops-engineer` | GitHub Actions CI, Docker, `db:migrate:deploy`, Turbo remote cache |

---

## Development Notes

- **TypeScript:** Strict mode everywhere. No unused vars/params.
- **ESM only** — All packages use `"type": "module"`.
- **Turbo caching:** `dev` and `db:*` tasks have `cache: false`. Build tasks are cached.
- **Prerendering:** `apps/web` uses Puppeteer to pre-render routes for SEO.
- **Sentry releases:** Automated via `pnpm deploy` (uploads source maps with git SHA).
- **Workspace imports:** Use `@booking-for-all/db`, `@booking-for-all/auth` etc., not relative paths across packages.
- **Migrations:** Always run `pnpm db:generate` after schema changes. Use `pnpm db:migrate` in dev, `pnpm db:migrate:deploy` in prod.
