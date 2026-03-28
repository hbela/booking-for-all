---
name: typescript-pro
description: Advanced TypeScript patterns for booking-for-all: strict mode, Zod schema inference, shared types across packages, ESM imports, and type-safe API boundaries.
---

# TypeScript Pro Skill — booking-for-all

## Purpose
Write and refactor TypeScript across the monorepo with strict-mode compliance, correct Zod inference, proper ESM module patterns, and type-safe boundaries between the Fastify backend and the React frontend.

## When to Use
- Fixing TypeScript errors (`strict`, `noUnusedLocals`, `noUnusedParameters`)
- Inferring types from Zod schemas instead of duplicating interfaces
- Sharing types between `apps/server` and `apps/web` via a shared package
- Typing Fastify route params/body/response correctly with `zod-type-provider`
- Debugging complex generics, conditional types, or `satisfies` usage
- Ensuring correct ESM import paths (`.js` extensions, no barrel re-exports that break tree-shaking)

## How to Use This Skill

1. Read the file(s) with the type error or pattern to improve.
2. Identify whether the issue is inference, assertion, missing type export, or ESM import.
3. Apply the fix following the rules below.
4. Run `pnpm check-types` from the repo root to verify.

## Key Rules

### Zod inference — always infer, never duplicate
```typescript
import { z } from 'zod'

export const createBookingSchema = z.object({
  providerId: z.string().cuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  notes: z.string().optional(),
})

// ✅ Infer the type — do NOT write a separate interface
export type CreateBookingInput = z.infer<typeof createBookingSchema>
```

### Fastify + Zod type provider
```typescript
import { ZodTypeProvider } from 'fastify-type-provider-zod'

fastify.withTypeProvider<ZodTypeProvider>().post('/', {
  schema: {
    body: createBookingSchema,
    response: { 200: bookingResponseSchema },
  },
}, async (request) => {
  // request.body is fully typed as CreateBookingInput
})
```

### ESM imports
- Always use `.js` extension for relative imports in `apps/server` (compiled to ESM).
- `apps/web` uses Vite path aliases (`@/` → `apps/web/src/`) — no `.js` extension needed.
- Cross-package imports use workspace package names: `@booking-for-all/db`, not relative `../../packages/db`.

### Strict mode compliance
- No `any` — use `unknown` + type narrowing, or `satisfies`, or proper generics.
- No unused vars — prefix intentionally unused with `_` (e.g. `_req`).
- No non-null assertions (`!`) — use optional chaining or explicit null checks.

### Type-safe `apiFetch` (frontend)
```typescript
// apps/web/src/lib/api.ts pattern
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_SERVER_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) throw await res.json()
  return res.json() as Promise<T>
}
```

### `satisfies` for config objects
```typescript
// Validates shape at definition without widening the type
const staleTimeTiers = {
  static: Infinity,
  slow: 5 * 60_000,
  fast: 60_000,
} satisfies Record<string, number>
```

## Common Pitfalls
| Problem | Fix |
|---------|-----|
| `Cannot find module '...' with .js extension` | Add `"moduleResolution": "bundler"` or use the correct `.js` extension pointing to the `.ts` source |
| `Type 'string' is not assignable to 'never'` | Usually a discriminated union exhaustiveness issue — add a default case with `satisfies never` |
| Prisma `include` return type lost | Capture with `Prisma.BookingGetPayload<{ include: { provider: true } }>` |
| Zod `.transform()` breaks `z.infer` | Use `.output` type: `z.infer<typeof schema>['_output']` or separate input/output types |
