# Example — Typed booking API boundary

Demonstrates Zod inference, shared input type, and generic `apiFetch` usage.

## Shared schema (could live in a shared package or be duplicated)

```typescript
// apps/server/src/features/bookings/bookings.schema.ts
import { z } from 'zod'

export const createBookingSchema = z.object({
  providerId: z.string().cuid(),
  eventId: z.string().cuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
})

export const bookingResponseSchema = z.object({
  id: z.string().cuid(),
  providerId: z.string(),
  eventId: z.string(),
  clientId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

// ✅ Infer — never write a duplicate interface
export type CreateBookingInput = z.infer<typeof createBookingSchema>
export type Booking = z.infer<typeof bookingResponseSchema>
```

## Fastify route (type-safe body + response)

```typescript
// apps/server/src/features/bookings/bookings.routes.ts
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { createBookingSchema, bookingResponseSchema } from './bookings.schema.js'

fastify.withTypeProvider<ZodTypeProvider>().post('/', {
  schema: {
    body: createBookingSchema,
    response: { 201: bookingResponseSchema },
  },
}, async (request) => {
  // request.body is fully typed as CreateBookingInput — no cast needed
  const booking = await db.booking.create({ data: { ...request.body, clientId: session.user.id } })
  return booking
})
```

## Prisma payload type with relation

```typescript
import { Prisma } from '@booking-for-all/db'

// Captures exact shape — no manual interface duplication
type BookingWithProvider = Prisma.BookingGetPayload<{
  include: { provider: { include: { user: true } } }
}>
```

## What makes this correct TypeScript

- `z.infer` derives types from the single source of truth (the schema)
- `ZodTypeProvider` threads Zod schemas through Fastify's request/reply types — no `as any`
- `Prisma.BookingGetPayload` captures nested relations exactly as Prisma returns them
- No `any`, no `!` assertions, no duplicate interfaces
