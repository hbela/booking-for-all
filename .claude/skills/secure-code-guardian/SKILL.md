---
name: secure-code-guardian
description: Security patterns for booking-for-all: Better-auth session validation, RBAC enforcement, org-scoping, Stripe webhook signature verification, and input sanitisation.
---

# Secure Code Guardian Skill — booking-for-all

## Purpose
Audit and implement secure coding patterns across the Fastify backend and React frontend: session validation, role-based access control, multi-tenant data isolation, webhook signature verification, and safe input handling.

## When to Use
- Adding auth guards to a new Fastify route
- Enforcing RBAC (OWNER / PROVIDER / CLIENT / ADMIN) on an endpoint
- Ensuring org-scoped queries never leak cross-tenant data
- Verifying Stripe or n8n webhook signatures
- Reviewing a new feature for OWASP Top 10 issues
- Hardening cookie/session configuration

## How to Use This Skill

1. Read the route or component to audit.
2. Check each rule category below.
3. Apply fixes — never bypass checks with `as any` or `// @ts-ignore`.
4. Run `pnpm check-types` + `pnpm test:run` (apps/server) after changes.

## Key Rules

### Session validation (every protected route)
```typescript
// apps/server/src/plugins/auth.ts decorates fastify with session
const session = request.session  // set by Better-auth plugin
if (!session?.user) return reply.status(401).send({ message: 'Unauthorized' })
```

### RBAC — use the authz plugin, not ad-hoc checks
```typescript
// apps/server/src/plugins/authz.ts
// The plugin exposes fastify.authorize(role)
await fastify.authorize('OWNER')  // throws 403 if role doesn't match
```
Never inline `if (session.user.role !== 'OWNER')` — always go through `authz`.

### Multi-tenant isolation — always scope to activeOrganizationId
```typescript
// ✅ Correct — data scoped to the org from session
const bookings = await db.booking.findMany({
  where: { organizationId: session.activeOrganizationId },
})

// ❌ Wrong — could return data from other orgs
const bookings = await db.booking.findMany()
```

### Stripe webhook signature verification
```typescript
// apps/server/src/features/webhooks/stripe.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const event = stripe.webhooks.constructEvent(
  rawBody,           // Buffer — read before JSON parsing
  request.headers['stripe-signature']!,
  process.env.STRIPE_WEBHOOK_SECRET!
)
// Only process event after validation succeeds
```

### n8n internal webhook — verify shared secret
```typescript
const secret = request.headers['x-internal-secret']
if (secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
  return reply.status(401).send({ message: 'Unauthorized' })
}
```

### Input validation — Zod on all external inputs
- **Body, query, params:** always `safeParse` / `parse` with a Zod schema before touching the data.
- **File uploads:** validate MIME type and size before writing to S3/R2.
- **Never** trust `request.body` directly in DB queries.

### Cookie / session security
- `sameSite: 'none'` + `secure: true` required for cross-origin cookie (frontend on port 3001, backend on 3000).
- Do **not** store sensitive data in the session beyond `userId` and `activeOrganizationId`.
- Session secret is `BETTER_AUTH_SECRET` — must be ≥ 32 random bytes in production.

### CORS
- `CORS_ORIGIN` must be the exact frontend origin — no wildcards in production.
- `credentials: true` is already set in the Fastify CORS plugin — do not remove it.

## Common Pitfalls
| Problem | Fix |
|---------|-----|
| 401 on valid session | Cookie not sent — frontend must use `credentials: 'include'` |
| Cross-tenant data leak | Missing `organizationId` filter in Prisma query |
| Webhook replay attack | Check `event.createdAt` timestamp — reject events older than 5 minutes |
| Privilege escalation | User-supplied `role` field in body — never trust client-sent roles; read from session/DB |
| SQL injection via Prisma | Not applicable for parameterised queries, but avoid raw `$queryRaw` with string interpolation |
