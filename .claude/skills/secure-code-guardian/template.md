# Security Checklist — {{FEATURE}}

## Protected route checklist

```typescript
// apps/server/src/features/{{feature}}/{{feature}}.routes.ts

fastify.get('/', async (request, reply) => {
  // ── 1. Session check ──────────────────────────────────────────────────────
  const session = request.session
  if (!session?.user) return reply.status(401).send({ message: 'Unauthorized' })

  // ── 2. RBAC check (via authz plugin) ─────────────────────────────────────
  await fastify.authorize('{{REQUIRED_ROLE}}')  // OWNER | PROVIDER | CLIENT | ADMIN

  // ── 3. Org scoping — ALWAYS filter by activeOrganizationId ───────────────
  const orgId = session.activeOrganizationId
  if (!orgId) return reply.status(403).send({ message: 'No active organization' })

  // ── 4. Input validation ───────────────────────────────────────────────────
  const query = {{querySchema}}.safeParse(request.query)
  if (!query.success) return reply.status(400).send(query.error)

  // ── 5. Org-scoped query ───────────────────────────────────────────────────
  const items = await db.{{model}}.findMany({
    where: {
      organizationId: orgId,
      // {{ADDITIONAL_FILTERS}}
    },
  })

  return items
})
```

---

## Webhook verification template

```typescript
// For Polar webhooks
import { validateEvent } from '@polar-sh/sdk/webhooks'

fastify.post('/webhooks/polar', {
  config: { rawBody: true },  // must enable raw body parsing
}, async (request, reply) => {
  const event = validateEvent(
    request.rawBody!,
    request.headers as Record<string, string>,
    process.env.POLAR_WEBHOOK_SECRET!
  )
  // Safe to process event here
})

// For n8n internal webhooks
fastify.post('/webhooks/n8n', async (request, reply) => {
  const secret = request.headers['x-internal-secret']
  if (secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    return reply.status(401).send({ message: 'Unauthorized' })
  }
  // Safe to process
})
```

---

## Placeholders to replace

| Placeholder | Example |
|------------|---------|
| `{{feature}}` | `bookings` |
| `{{REQUIRED_ROLE}}` | `OWNER`, `PROVIDER`, `CLIENT`, or `ADMIN` |
| `{{model}}` | `booking` |
| `{{querySchema}}` | `z.object({ status: z.enum(['PENDING','CONFIRMED']).optional() })` |
| `{{ADDITIONAL_FILTERS}}` | `providerId: query.data.providerId` |
