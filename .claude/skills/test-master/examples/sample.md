# Example — Booking route tests

Integration tests for `POST /bookings` covering auth, RBAC, validation, and the happy path.

```typescript
// apps/server/src/features/bookings/bookings.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../app.js'
import { db } from '@booking-for-all/db'

// Stub Prisma for speed — use real DB only for migration-level tests
vi.mock('@booking-for-all/db', () => ({
  db: {
    provider: { findFirst: vi.fn() },
    booking: { create: vi.fn() },
  },
}))

const TEST_ORG_ID = 'test-org-cuid'
const TEST_USER_ID = 'test-user-cuid'

function buildSessionCookie(role: string) {
  // In a real project, sign a Better-auth compatible session token
  return `session=fake-${role}-session`
}

describe('POST /bookings', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(() => app.close())

  it('returns 401 without session', async () => {
    const res = await app.inject({ method: 'POST', url: '/bookings', body: '{}' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 for PROVIDER role (only CLIENT allowed)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/bookings',
      headers: {
        cookie: buildSessionCookie('PROVIDER'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/bookings',
      headers: {
        cookie: buildSessionCookie('CLIENT'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ notes: 'missing other fields' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when provider is not in the org', async () => {
    vi.mocked(db.provider.findFirst).mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/bookings',
      headers: {
        cookie: buildSessionCookie('CLIENT'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        providerId: 'nonexistent-provider',
        eventId: 'event-cuid',
        startAt: '2026-04-01T10:00:00Z',
        endAt: '2026-04-01T11:00:00Z',
      }),
    })
    expect(res.statusCode).toBe(404)
  })

  it('creates booking successfully', async () => {
    const fakeProvider = { id: 'provider-cuid', organizationId: TEST_ORG_ID }
    const fakeBooking = {
      id: 'booking-cuid',
      providerId: 'provider-cuid',
      clientId: TEST_USER_ID,
      organizationId: TEST_ORG_ID,
      status: 'PENDING',
    }

    vi.mocked(db.provider.findFirst).mockResolvedValue(fakeProvider as any)
    vi.mocked(db.booking.create).mockResolvedValue(fakeBooking as any)

    const res = await app.inject({
      method: 'POST',
      url: '/bookings',
      headers: {
        cookie: buildSessionCookie('CLIENT'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        providerId: 'provider-cuid',
        eventId: 'event-cuid',
        startAt: '2026-04-01T10:00:00Z',
        endAt: '2026-04-01T11:00:00Z',
      }),
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ id: 'booking-cuid', status: 'PENDING' })

    // Verify clientId was NOT taken from request body
    expect(vi.mocked(db.booking.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientId: TEST_USER_ID }),
      })
    )
  })
})
```

## What makes this a good test file

- Tests the auth/RBAC failures before any DB call
- Validates that `clientId` is injected from the session, not user input
- Mocks are scoped per test with `mockResolvedValue` — no shared mutable state
- Uses `app.inject` — no HTTP server needed, tests are fast
