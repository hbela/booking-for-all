# Hook Template — {{RESOURCE}}

## Files to create / extend

| File | Action |
|------|--------|
| `apps/web/src/lib/query-keys.ts` | Add `{{resource}}` section |
| `apps/web/src/hooks/use-{{resource}}.ts` | Create hook file |

---

## 1. Query Key Factory (add to `lib/query-keys.ts`)

```typescript
{{resource}}: {
  all: ['{{resource}}'] as const,
  lists: () => [...queryKeys.{{resource}}.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...queryKeys.{{resource}}.lists(), filters] as const,
  details: () => [...queryKeys.{{resource}}.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.{{resource}}.details(), id] as const,
},
```

---

## 2. Hook File (`apps/web/src/hooks/use-{{resource}}.ts`)

```typescript
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'

// ── Types ─────────────────────────────────────────────────────────────────────

interface {{Resource}} {
  id: string
  // {{FIELDS}}
  createdAt: string
  updatedAt: string
}

interface {{Resource}}ListResponse {
  data: {{Resource}}[]
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
    throw { message: err.message ?? 'Request failed', statusCode: res.status, code: err.code } as ApiError
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Read hooks ─────────────────────────────────────────────────────────────────

export function use{{Resource}}s(
  params?: { page?: number; limit?: number; /* {{FILTER_PARAMS}} */ },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.{{resource}}.list(params ?? {}),
    queryFn: () =>
      fetchJson<{{Resource}}ListResponse>(
        `/{{route-prefix}}?${new URLSearchParams(params as Record<string, string>)}`
      ),
    staleTime: 60_000,
    ...options,
  })
}

export function use{{Resource}}(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.{{resource}}.detail(id),
    queryFn: () => fetchJson<{{Resource}}>(`/{{route-prefix}}/${id}`),
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 60_000,
  })
}

// ── Mutation hooks ─────────────────────────────────────────────────────────────

export function useCreate{{Resource}}() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: { /* {{CREATE_FIELDS}} */ }) =>
      fetchJson<{{Resource}}>('/{{route-prefix}}', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.{{resource}}.lists() })
      toast.success('{{Resource}} created')
    },
    onError: (err: ApiError) => {
      toast.error(err.message ?? 'Failed to create {{resource}}')
    },
  })
}

export function useUpdate{{Resource}}() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; /* {{UPDATE_FIELDS}} */ }) =>
      fetchJson<{{Resource}}>(`/{{route-prefix}}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: queryKeys.{{resource}}.detail(variables.id) })
      const previous = qc.getQueryData<{{Resource}}>(queryKeys.{{resource}}.detail(variables.id))
      qc.setQueryData(queryKeys.{{resource}}.detail(variables.id), (old: {{Resource}} | undefined) => ({
        ...old,
        ...variables,
      }))
      return { previous }
    },

    onError: (err: ApiError, variables, context) => {
      qc.setQueryData(queryKeys.{{resource}}.detail(variables.id), context?.previous)
      toast.error(err.message ?? 'Failed to update {{resource}}')
    },

    onSettled: (_, __, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.{{resource}}.detail(variables.id) })
      qc.invalidateQueries({ queryKey: queryKeys.{{resource}}.lists() })
    },
  })
}

export function useDelete{{Resource}}() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<void>(`/{{route-prefix}}/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: queryKeys.{{resource}}.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.{{resource}}.lists() })
      toast.success('{{Resource}} deleted')
    },
    onError: (err: ApiError) => {
      toast.error(err.message ?? 'Failed to delete {{resource}}')
    },
  })
}
```

---

## Placeholders to replace

| Placeholder | Example |
|------------|---------|
| `{{resource}}` | `bookings` |
| `{{Resource}}` | `Booking` |
| `{{route-prefix}}` | `/bookings` (Fastify prefix) |
| `{{FIELDS}}` | `providerId: string; startAt: string; status: string` |
| `{{FILTER_PARAMS}}` | `providerId?: string; status?: string` |
| `{{CREATE_FIELDS}}` | `providerId: string; startAt: string; endAt: string` |
| `{{UPDATE_FIELDS}}` | `status?: string; notes?: string` |
</content>
