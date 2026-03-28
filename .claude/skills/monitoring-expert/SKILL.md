---
name: monitoring-expert
description: Configure Sentry error tracking, structured Fastify logging, and performance profiling for booking-for-all (server + web).
---

# Monitoring Expert Skill — booking-for-all

## Purpose
Set up and extend observability for the booking-for-all stack: Sentry error capture on both server and client, structured JSON logging via Fastify's built-in logger, performance transaction tracing, and the Sentry tunnel endpoint that bypasses ad blockers.

## When to Use
- Adding Sentry error capture to a new feature or route
- Debugging missing errors in Sentry (tunnel config, DSN, release)
- Adding custom Sentry breadcrumbs or context (user, org, request ID)
- Configuring log levels or structured log fields in Fastify
- Setting up performance tracing for a slow endpoint
- Verifying source map uploads during deployment

## How to Use This Skill

1. Identify whether the issue is server-side (Fastify/Node) or client-side (React/Vite).
2. Check the relevant DSN env var (`SENTRY_DSN` or `VITE_SENTRY_DSN`).
3. Apply the pattern below and run `scripts/validate.sh` to check types.

## Key Rules

### Server-side Sentry init (`apps/server/src/server.ts`)
```typescript
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,  // set to git SHA in CI
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  integrations: [Sentry.prismaIntegration()],
})
```

### Capturing exceptions manually
```typescript
try {
  await riskyOperation()
} catch (err) {
  Sentry.captureException(err, {
    tags: { feature: 'bookings', orgId: session.activeOrganizationId },
  })
  throw err  // re-throw so Fastify returns 500
}
```

### Attaching user + org context
```typescript
Sentry.setUser({ id: session.user.id, email: session.user.email })
Sentry.setTag('orgId', session.activeOrganizationId)
```
Do this in the `orgApp` plugin so it applies to every request automatically.

### Client-side Sentry init (`apps/web/src/main.tsx`)
```typescript
import * as Sentry from '@sentry/react'
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from '@tanstack/react-router'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ENVIRONMENT,
  release: import.meta.env.VITE_SENTRY_RELEASE,
  tunnel: '/api/sentry-tunnel',  // avoids ad blockers
  integrations: [
    Sentry.tanstackRouterBrowserTracingIntegration(),
  ],
  tracesSampleRate: 0.1,
})
```

### Sentry tunnel endpoint (`/api/sentry-tunnel`)
- Already registered in `apps/server/src/features/sentry/tunnel.ts`.
- Proxies envelope requests to `sentry.io` — do not remove or change the route path.

### Fastify structured logging
```typescript
// LOG_LEVEL env var controls verbosity (default: 'info')
// Use request.log for per-request context (includes reqId automatically)
request.log.info({ bookingId: booking.id }, 'Booking created')
request.log.error({ err }, 'Failed to send confirmation email')

// Root logger for startup/shutdown:
app.log.info('Server listening on port 3000')
```

### Performance profiling — custom spans
```typescript
const span = Sentry.startSpan({ name: 'bookings.create', op: 'db' }, async () => {
  return db.booking.create({ data })
})
```

### Source map uploads (CI/CD)
- `pnpm deploy` script in `apps/web` calls `sentry-cli` with `SENTRY_RELEASE` = git SHA.
- Ensure `SENTRY_AUTH_TOKEN` and `SENTRY_ORG` / `SENTRY_PROJECT` are set in the deployment environment.

## Common Pitfalls
| Problem | Fix |
|---------|-----|
| Errors not appearing in Sentry | Check `SENTRY_DSN` is set and not empty; verify `tunnel` path matches the server route |
| Source maps not resolving | Confirm `VITE_SENTRY_RELEASE` matches the release string used in `sentry-cli upload` |
| Too many transactions in prod | Lower `tracesSampleRate` to 0.05–0.1; use `tracesSampler` for route-based sampling |
| PII in logs | Never log `password`, `token`, or full credit card — use `[REDACTED]` |
| Ad blocker blocking Sentry | Use the `/api/sentry-tunnel` — already configured, just set `tunnel` in `Sentry.init` |
