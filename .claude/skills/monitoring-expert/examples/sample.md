# Example — Sentry + logging in booking creation

Demonstrates per-request Sentry context, structured Fastify logging, and a custom performance span.

```typescript
// apps/server/src/features/bookings/bookings.routes.ts
import * as Sentry from '@sentry/node'

fastify.post('/', async (request, reply) => {
  const session = request.session!

  // ── Attach Sentry context for this request ────────────────────────────────
  Sentry.setUser({ id: session.user.id, email: session.user.email })
  Sentry.setTag('orgId', session.activeOrganizationId)
  Sentry.setTag('feature', 'bookings')

  const body = parsed.data  // already validated by Zod

  // ── Structured log (reqId included automatically by Fastify) ──────────────
  request.log.info(
    { providerId: body.providerId, startAt: body.startAt },
    'Creating booking'
  )

  try {
    // ── Performance span around the DB write ──────────────────────────────
    const booking = await Sentry.startSpan(
      { name: 'bookings.create', op: 'db' },
      () => db.booking.create({ data: { ...body, clientId: session.user.id, organizationId: session.activeOrganizationId } })
    )

    request.log.info(
      { bookingId: booking.id, providerId: body.providerId },
      'Booking created successfully'
    )

    return reply.status(201).send(booking)
  } catch (err) {
    // ── Capture with context so Sentry groups by feature + org ───────────
    Sentry.captureException(err, {
      extra: {
        providerId: body.providerId,
        orgId: session.activeOrganizationId,
      },
    })
    request.log.error({ err, providerId: body.providerId }, 'Failed to create booking')
    throw err  // Fastify returns 500
  }
})
```

## Client-side: Sentry init in apps/web/src/main.tsx

```typescript
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ENVIRONMENT ?? 'development',
  release: import.meta.env.VITE_SENTRY_RELEASE,
  tunnel: '/api/sentry-tunnel',  // bypass ad blockers
  integrations: [Sentry.tanstackRouterBrowserTracingIntegration()],
  tracesSampleRate: import.meta.env.VITE_ENVIRONMENT === 'production' ? 0.05 : 1.0,
})
```

## What makes this good observability

- `Sentry.setUser` + `setTag('orgId')` means every error is grouped by tenant in Sentry
- Structured log fields (`bookingId`, `providerId`) make logs grep-able in production
- `startSpan` with `op: 'db'` surfaces slow DB queries in Sentry performance view
- `tunnel: '/api/sentry-tunnel'` ensures errors aren't silently dropped by ad blockers
- `tracesSampleRate` is low in production to control Sentry transaction volume
