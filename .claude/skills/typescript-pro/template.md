# TypeScript Pattern Reference — booking-for-all

## Zod schema + inferred types

```typescript
import { z } from 'zod'

// Define once, infer everywhere
export const {{name}}Schema = z.object({
  // {{FIELDS}}
})

export type {{Name}} = z.infer<typeof {{name}}Schema>
export type Create{{Name}} = z.infer<typeof create{{Name}}Schema>
```

---

## Prisma payload types (with relations)

```typescript
import { Prisma } from '@booking-for-all/db'

// Captures the exact shape Prisma returns including nested relations
export type BookingWithProvider = Prisma.BookingGetPayload<{
  include: { provider: { include: { user: true } } }
}>
```

---

## Discriminated union + exhaustiveness check

```typescript
type Action =
  | { type: 'CREATE'; payload: CreateBookingInput }
  | { type: 'CANCEL'; id: string }

function handle(action: Action) {
  switch (action.type) {
    case 'CREATE': return createBooking(action.payload)
    case 'CANCEL': return cancelBooking(action.id)
    default:
      // TypeScript will error if a case is missing
      action satisfies never
  }
}
```

---

## Generic apiFetch (frontend)

```typescript
// apps/web/src/lib/api.ts
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_SERVER_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.message ?? 'Request failed'), {
      statusCode: res.status,
      code: err.code,
    })
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
```

---

## Placeholders to replace

| Placeholder | Example |
|------------|---------|
| `{{name}}` | `booking` (camelCase) |
| `{{Name}}` | `Booking` (PascalCase) |
| `{{FIELDS}}` | `id: z.string().cuid(), status: z.enum(['PENDING','CONFIRMED','CANCELLED'])` |
