# Test Template — {{SUBJECT}}

## Server route test

```typescript
// apps/server/src/features/{{domain}}/{{domain}}.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../app.js'

// Mock Prisma if needed for unit tests
// vi.mock('@booking-for-all/db', () => ({ db: { {{model}}: { findMany: vi.fn() } } }))

describe('{{DOMAIN}} routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(() => app.close())

  describe('GET /{{domain}}', () => {
    it('returns 401 without session', async () => {
      const res = await app.inject({ method: 'GET', url: '/{{domain}}' })
      expect(res.statusCode).toBe(401)
    })

    it('returns 403 for wrong role', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/{{domain}}',
        headers: { cookie: buildSessionCookie({ role: '{{WRONG_ROLE}}' }) },
      })
      expect(res.statusCode).toBe(403)
    })

    it('returns data for authorised user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/{{domain}}',
        headers: { cookie: buildSessionCookie({ role: '{{REQUIRED_ROLE}}' }) },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String) }),
      ]))
    })
  })

  describe('POST /{{domain}}', () => {
    it('validates required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/{{domain}}',
        headers: {
          cookie: buildSessionCookie({ role: '{{REQUIRED_ROLE}}' }),
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),  // missing required fields
      })
      expect(res.statusCode).toBe(400)
    })
  })
})
```

---

## React component test

```typescript
// apps/web/src/components/{{Component}}.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { {{Component}} } from './{{Component}}'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('{{Component}}', () => {
  it('renders correctly', () => {
    render(<{{Component}} {{PROPS}} />, { wrapper })
    expect(screen.getByText('{{EXPECTED_TEXT}}')).toBeInTheDocument()
  })

  it('calls onSubmit with correct data', async () => {
    const onSuccess = vi.fn()
    render(<{{Component}} onSuccess={onSuccess} />, { wrapper })

    await userEvent.type(screen.getByLabelText('{{FIELD_LABEL}}'), '{{TEST_VALUE}}')
    await userEvent.click(screen.getByRole('button', { name: '{{SUBMIT_TEXT}}' }))

    expect(onSuccess).toHaveBeenCalledOnce()
  })
})
```

---

## Placeholders to replace

| Placeholder | Example |
|------------|---------|
| `{{domain}}` | `bookings` |
| `{{DOMAIN}}` | `Booking` |
| `{{model}}` | `booking` |
| `{{REQUIRED_ROLE}}` | `OWNER` |
| `{{WRONG_ROLE}}` | `CLIENT` |
| `{{Component}}` | `BookingForm` |
| `{{PROPS}}` | `booking={fakeBooking}` |
| `{{EXPECTED_TEXT}}` | `CONFIRMED` |
| `{{FIELD_LABEL}}` | `Start time` |
| `{{TEST_VALUE}}` | `2026-04-01T10:00` |
| `{{SUBMIT_TEXT}}` | `Save` |
