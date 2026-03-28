# Fastify Skill — ProjectDeck

## Purpose
Create and extend Fastify route modules in `apps/server` following ProjectDeck conventions: Fastify 5 + Prisma (`@projectdeck/db`) + Better-Auth + Zod + Swagger/OpenAPI.

## When to Use
- Adding a new API domain (new resource type)
- Extending an existing route module with new endpoints
- Debugging server-side request or auth issues
- Adding Swagger documentation to undocumented routes

## How to Use This Skill

1. Ask the user: **what domain/resource** is the new route for?
2. Fill in `template.md` with the real model name, fields, and Zod schema.
3. Write the file to `apps/server/src/routes/<domain>.ts`.
4. Register it in `apps/server/src/index.ts` — follow the existing pattern.
5. If a new Swagger tag is needed, add it to the `tags` array in `index.ts`.
6. Run `scripts/validate.sh` to confirm no type errors.

## Key Rules

### File & Registration
- Route file: `apps/server/src/routes/<domain>.ts`
- Export: `export const <domain>Routes: FastifyPluginAsync`
- Register: `fastify.register(<domain>Routes, { prefix: "/api/<domain>" })`

### Imports (always these three)
```typescript
import db from "@projectdeck/db";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
```

### Validation
- Use `safeParse` for body/query — return `reply.status(400).send(parsed.error)` on failure.
- Use `parse` for params (routing already guarantees the segment exists).

### Database
- Import `db` directly — it is **not** decorated on the fastify instance.

### Auth (protected routes only)
```typescript
import { auth } from "@projectdeck/auth";
const session = await auth.api.getSession({ headers: request.headers as any });
if (!session) return reply.status(401).send({ error: "Unauthorized" });
```

### Swagger schema block
Every route should have `schema.tags`, `schema.description`, and `schema.response[200]`.
Security schemes (`cookieAuth`, `bearerAuth`) are already registered globally.

### Plugin registration order (do not change)
`fastifyCors` → `fastifySwagger` → `fastifySwaggerUI` → domain routes → `/api/auth/*` catch-all → `/health`

## Common Pitfalls
| Problem | Fix |
|---------|-----|
| Route 404 | Check prefix in `register()` + path in route handler add up correctly |
| Cookie/session missing | Frontend must use `credentials: 'include'`; CORS already has `credentials: true` |
| Swagger tag not showing | Add tag to the `tags` array in `index.ts` |
| `db` import error after schema change | Run `pnpm run db:generate` |
| Slug/unique conflict | Query before insert, return `409` with descriptive message |
