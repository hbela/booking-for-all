# Example — Secure booking creation route

Demonstrates session check, RBAC, org scoping, and input validation all in one route.

```typescript
// apps/server/src/features/bookings/bookings.routes.ts
import { z } from 'zod'
import { db } from '@booking-for-all/db'

fastify.post('/', async (request, reply) => {
  // ── 1. Session check ──────────────────────────────────────────────────────
  const session = request.session
  if (!session?.user) return reply.status(401).send({ message: 'Unauthorized' })

  // ── 2. RBAC — only CLIENTs can create bookings ────────────────────────────
  await fastify.authorize('CLIENT')

  // ── 3. Org scoping ────────────────────────────────────────────────────────
  const orgId = session.activeOrganizationId
  if (!orgId) return reply.status(403).send({ message: 'No active organization' })

  // ── 4. Input validation ───────────────────────────────────────────────────
  const bodySchema = z.object({
    providerId: z.string().cuid(),
    eventId: z.string().cuid(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    notes: z.string().max(500).optional(),
  })

  const parsed = bodySchema.safeParse(request.body)
  if (!parsed.success) return reply.status(400).send(parsed.error)

  // ── 5. Verify provider belongs to the same org ────────────────────────────
  const provider = await db.provider.findFirst({
    where: { id: parsed.data.providerId, organizationId: orgId },
  })
  if (!provider) return reply.status(404).send({ message: 'Provider not found' })

  // ── 6. Create — clientId comes from session, NOT request body ────────────
  const booking = await db.booking.create({
    data: {
      ...parsed.data,
      clientId: session.user.id,   // ✅ trusted source
      organizationId: orgId,        // ✅ org-scoped
    },
  })

  return reply.status(201).send(booking)
})
```

## What this example gets right

- `clientId` is taken from the session — a client cannot spoof another user's booking
- `organizationId` is always injected from the session — no cross-tenant writes
- Provider existence is verified within the org before creating the booking
- `safeParse` returns a 400 with Zod's error details — never a 500 from a bad cast
- RBAC check via `fastify.authorize` — consistent enforcement, not ad-hoc `if` checks
