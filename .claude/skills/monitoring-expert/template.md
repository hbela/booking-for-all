# Monitoring Template — {{FEATURE}}

## Server-side error capture with context

```typescript
import * as Sentry from '@sentry/node'

// In a Fastify route handler:
async function {{feature}}Handler(request: FastifyRequest, reply: FastifyReply) {
  const session = request.session!

  // Attach user + org context for this request
  Sentry.setUser({ id: session.user.id, email: session.user.email })
  Sentry.setTag('orgId', session.activeOrganizationId)
  Sentry.setTag('feature', '{{feature}}')

  try {
    // {{OPERATION}}
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        // {{EXTRA_CONTEXT}}
        // e.g. bookingId: request.params.id
      },
    })
    throw err  // let Fastify return 500
  }
}
```

---

## Custom performance span

```typescript
import * as Sentry from '@sentry/node'

const result = await Sentry.startSpan(
  { name: '{{feature}}.{{operation}}', op: '{{op_type}}' },
  async () => {
    return db.{{model}}.{{prismaMethod}}(/* ... */)
  }
)
// op_type: 'db', 'http', 'function', 'queue'
```

---

## Structured Fastify log

```typescript
// Per-request log (includes reqId automatically)
request.log.info({ {{logFields}} }, '{{LOG_MESSAGE}}')
request.log.warn({ {{logFields}}, reason: '{{REASON}}' }, '{{WARN_MESSAGE}}')
request.log.error({ err, {{logFields}} }, '{{ERROR_MESSAGE}}')

// App-level log (startup, shutdown, background tasks)
app.log.info({ feature: '{{feature}}' }, '{{LOG_MESSAGE}}')
```

---

## Placeholders to replace

| Placeholder | Example |
|------------|---------|
| `{{feature}}` | `bookings` |
| `{{OPERATION}}` | `const booking = await db.booking.create({ data })` |
| `{{EXTRA_CONTEXT}}` | `bookingId: request.params.id, providerId: body.providerId` |
| `{{operation}}` | `create` |
| `{{op_type}}` | `db` |
| `{{model}}` | `booking` |
| `{{prismaMethod}}` | `create` |
| `{{logFields}}` | `bookingId: booking.id, orgId: session.activeOrganizationId` |
| `{{LOG_MESSAGE}}` | `'Booking created successfully'` |
