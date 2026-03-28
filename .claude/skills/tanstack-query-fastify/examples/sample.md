# Example — Bookings Hooks

This example shows the expected output for the `bookings` resource, wired to `GET/POST/PATCH/DELETE /bookings` on the Fastify backend.

---

## Query key additions (`apps/web/src/lib/query-keys.ts`)

```typescript
bookings: {
  all: ['bookings'] as const,
  lists: () => [...queryKeys.bookings.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...queryKeys.bookings.lists(), filters] as const,
  details: () => [...queryKeys.bookings.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.bookings.details(), id] as const,
},
```

---

## Hook file (`apps/web/src/hooks/use-bookings.ts`)

```typescript
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Booking {
  id: string
  providerId: string
  clientId: string
  eventId: string
  startAt: string
  endAt: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface BookingListResponse {
  data: Booking[]
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface ApiError {
  message: string
  statusCode: number
  code?: string
}

// ── API helpers ────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_SERVER_URL

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw {
      message: err.message ?? 'Request failed',
      statusCode: res.status,
      code: err.code,
    } as ApiError
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Read hooks ─────────────────────────────────────────────────────────────────

export function useBookings(
  params?: { providerId?: string; status?: string; page?: number; limit?: number },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.bookings.list(params ?? {}),
    queryFn: () =>
      fetchJson<BookingListResponse>(
        `/bookings?${new URLSearchParams(params as Record<string, string>)}`
      ),
    staleTime: 60_000,
    retry: (count, err: ApiError) => err.statusCode !== 401 && err.statusCode !== 403 && count < 3,
    ...options,
  })
}

export function useBooking(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.bookings.detail(id),
    queryFn: () => fetchJson<Booking>(`/bookings/${id}`),
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 60_000,
  })
}

// ── Mutation hooks ─────────────────────────────────────────────────────────────

export function useCreateBooking() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      providerId: string
      eventId: string
      startAt: string
      endAt: string
      notes?: string
    }) =>
      fetchJson<Booking>('/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.bookings.lists() })
      toast.success('Booking created')
    },
    onError: (err: ApiError) => {
      toast.error(err.message ?? 'Failed to create booking')
    },
  })
}

export function useUpdateBooking() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status?: Booking['status']; notes?: string }) =>
      fetchJson<Booking>(`/bookings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: queryKeys.bookings.detail(variables.id) })
      const previous = qc.getQueryData<Booking>(queryKeys.bookings.detail(variables.id))
      qc.setQueryData(queryKeys.bookings.detail(variables.id), (old: Booking | undefined) => ({
        ...old,
        ...variables,
      }))
      return { previous }
    },

    onError: (err: ApiError, variables, context) => {
      qc.setQueryData(queryKeys.bookings.detail(variables.id), context?.previous)
      toast.error(err.message ?? 'Failed to update booking')
    },

    onSettled: (_, __, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(variables.id) })
      qc.invalidateQueries({ queryKey: queryKeys.bookings.lists() })
    },
  })
}

export function useDeleteBooking() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<void>(`/bookings/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: queryKeys.bookings.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.bookings.lists() })
      toast.success('Booking deleted')
    },
    onError: (err: ApiError) => {
      toast.error(err.message ?? 'Failed to delete booking')
    },
  })
}
```

---

## What makes this a good hook file

- `credentials: 'include'` on every fetch — required for Better-auth cookie sessions
- `retry` callback skips retries on 401/403 to avoid hammering auth-protected endpoints
- `staleTime: 60_000` — bookings change frequently, 1 min is appropriate
- Optimistic update in `useUpdateBooking` follows cancel → snapshot → mutate → rollback pattern
- `onSettled` always invalidates (fires on both success and error) to guarantee consistency
- `toast` imported from `sonner` — the project-standard notification library
- `enabled: !!id` guards the detail query from running with an empty ID
</content>
