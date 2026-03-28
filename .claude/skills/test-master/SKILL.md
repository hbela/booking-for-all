---
name: test-master
description: Write Vitest tests for booking-for-all: Fastify route integration tests, React component tests, Prisma mocking, and auth/org context setup.
---

# Test Master Skill — booking-for-all

## Purpose
Create and extend Vitest tests for `apps/server` (route integration tests using Fastify's `inject`) and `apps/web` (React component tests with Testing Library). Covers Prisma mocking, Better-auth session faking, and org-context setup.

## When to Use
- Adding tests for a new Fastify route or feature
- Testing a React component or hook in isolation
- Mocking Prisma to avoid hitting a real database in unit tests
- Setting up a fake session/auth context for protected route tests
- Improving test coverage for a critical path (auth, payments, bookings)

## How to Use This Skill

1. Ask: **what** is being tested (route, component, hook, utility)?
2. Identify the file to test and its dependencies.
3. Fill in `template.md` and write the test file alongside the source.
4. Run `pnpm test:run` (from `apps/server` or `apps/web`) to verify.

## Key Rules

### File naming & location
- Server tests: `apps/server/src/features/<domain>/<domain>.test.ts`
- Web tests: `apps/web/src/<path>/<file>.test.tsx`
- Test files live **next to** the source file they test.

### Fastify route tests — use `app.inject()`
```typescript
import { buildApp } from '../app.js'

describe('GET /bookings', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(() => app.close())

  it('returns 401 without session', async () => {
    const res = await app.inject({ method: 'GET', url: '/bookings' })
    expect(res.statusCode).toBe(401)
  })

  it('returns bookings for authenticated user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bookings',
      headers: { cookie: buildSessionCookie(testSession) },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.any(String) }),
    ]))
  })
})
```

### Prisma mocking (unit tests only)
```typescript
import { vi } from 'vitest'
import { db } from '@booking-for-all/db'

vi.mock('@booking-for-all/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

// In test:
vi.mocked(db.booking.findMany).mockResolvedValue([fakeBooking])
```

### React component tests
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BookingCard } from './BookingCard'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

it('shows booking status', () => {
  render(<BookingCard booking={fakeBooking} />, { wrapper })
  expect(screen.getByText('CONFIRMED')).toBeInTheDocument()
})
```

### Session / auth helpers
- Create a `tests/helpers/session.ts` that builds a signed session cookie using the same `BETTER_AUTH_SECRET`.
- Use a fixed test org ID to keep queries deterministic.

### What to test
| Priority | Coverage target |
|----------|----------------|
| High | Auth guard (401/403 on missing/wrong role) |
| High | Org isolation (can't access other org's data) |
| High | Booking create/cancel happy path |
| Medium | Form validation error states |
| Medium | Webhook signature rejection |
| Low | UI loading/empty states |

## Common Pitfalls
| Problem | Fix |
|---------|-----|
| `Cannot find module` in test | Check `.js` extension on relative imports in server tests |
| Prisma mock not applied | Ensure `vi.mock` is called before imports (Vitest hoists automatically, but factory must be synchronous) |
| React test renders blank | Wrap with QueryClientProvider and/or RouterProvider |
| Flaky async tests | Use `await waitFor(() => expect(...))` instead of bare `expect` after async events |
