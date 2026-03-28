# Example — Owner Events Route

This is the expected output for a new **owner-role** route at `/owner/events` that lists all events for the owner's organizations, with search + page filtering, and a loader that prefetches data.

File: `apps/web/src/routes/owner/events.tsx`

---

```typescript
import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { apiFetch, ApiError } from '@/lib/apiFetch'
import { queryClient } from '@/lib/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

// ── Search param schema ────────────────────────────────────────────────────────

const eventsSearchSchema = z.object({
  page: z.number().min(1).default(1),
  search: z.string().default(''),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

type EventsSearch = z.infer<typeof eventsSearchSchema>

// ── Route ──────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/owner/events')({

  head: () => ({
    meta: [
      { title: 'Events - Booking for All' },
      { name: 'description', content: 'Manage events for your organizations' },
      { property: 'og:title', content: 'Events - Booking for All' },
      { property: 'og:description', content: 'Manage events for your organizations' },
      { property: 'og:type', content: 'website' },
    ],
    links: [{ rel: 'canonical', href: '/owner/events' }],
  }),

  beforeLoad: async () => {
    try {
      const session = await authClient.getSession()

      if (!session.data) {
        throw redirect({ to: '/login' })
      }

      // System admins go to admin panel
      const isSystemAdmin = (session.data.user as any)?.isSystemAdmin
      if (isSystemAdmin) {
        throw redirect({ to: '/admin' })
      }

      // Require OWNER membership in at least one org
      const memberships = await apiFetch<any[]>(
        `${import.meta.env.VITE_SERVER_URL}/api/members/my-organizations`
      )
      const ownerMemberships = memberships.filter((m) => m.role === 'OWNER')
      if (!ownerMemberships.length) {
        throw redirect({ to: '/', search: { error: 'Owner access required.' } })
      }

      return { session }
    } catch (error) {
      if (error && typeof error === 'object' && 'to' in error) throw error
      console.warn('owner/events beforeLoad error:', error)
    }
  },

  validateSearch: eventsSearchSchema,
  loaderDeps: ({ search }) => search,

  loader: async ({ deps }) => {
    const events = await queryClient.ensureQueryData({
      queryKey: queryKeys.events.list(deps),
      queryFn: () =>
        apiFetch<{ data: any[]; pagination: any }>(
          `${import.meta.env.VITE_SERVER_URL}/api/events?${new URLSearchParams(
            Object.fromEntries(
              Object.entries(deps).filter(([, v]) => v !== undefined && v !== '')
            ) as Record<string, string>
          )}`
        ),
    })
    return { events }
  },

  component: OwnerEventsPage,
  pendingComponent: EventsSkeleton,
})

// ── Component ──────────────────────────────────────────────────────────────────

function OwnerEventsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { events } = Route.useLoaderData()

  const updateFilters = (updates: Partial<EventsSearch>) => {
    navigate({
      to: '/owner/events',
      search: { ...search, ...updates },
      replace: true,
    })
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('owner.events.title', 'Events')}</h1>
        <p className="text-muted-foreground">
          {t('owner.events.subtitle', 'Manage events for your organizations')}
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder={t('owner.events.searchPlaceholder', 'Search events…')}
          value={search.search}
          onChange={(e) => updateFilters({ search: e.target.value, page: 1 })}
          className="border rounded px-3 py-2 flex-1"
        />
        <select
          value={search.status ?? ''}
          onChange={(e) =>
            updateFilters({ status: (e.target.value as any) || undefined, page: 1 })
          }
          className="border rounded px-3 py-2"
        >
          <option value="">{t('owner.events.allStatuses', 'All statuses')}</option>
          <option value="ACTIVE">{t('owner.events.active', 'Active')}</option>
          <option value="INACTIVE">{t('owner.events.inactive', 'Inactive')}</option>
        </select>
      </div>

      <div className="space-y-4">
        {events.data.map((event) => (
          <div key={event.id} className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold">{event.name}</h3>
            <p className="text-sm text-muted-foreground">{event.description}</p>
          </div>
        ))}
      </div>

      {events.pagination && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={search.page <= 1}
            onClick={() => updateFilters({ page: search.page - 1 })}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            {t('common.previous', 'Previous')}
          </button>
          <span className="px-3 py-1">
            {search.page} / {events.pagination.pages}
          </span>
          <button
            disabled={search.page >= events.pagination.pages}
            onClick={() => updateFilters({ page: search.page + 1 })}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            {t('common.next', 'Next')}
          </button>
        </div>
      )}
    </div>
  )
}

function EventsSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>
  )
}
```

---

## What makes this a good route

- `head()` present with title, description, og tags, and canonical link
- `beforeLoad` checks `session.data` (not `session`) and re-throws redirects with `'to' in error`
- `apiFetch` used everywhere — never raw `fetch` — so `credentials: 'include'` and `ApiError` are guaranteed
- RBAC: checks `isSystemAdmin` first, then verifies OWNER membership via API
- `validateSearch` + `loaderDeps` wire Zod-validated URL params to the loader re-run
- `navigate({ replace: true })` for filter updates — avoids polluting browser history
- `Route.useSearch()` / `Route.useLoaderData()` (not the package-level hooks) for type safety
- `useTranslation` for all user-facing strings
- `pendingComponent` shows a skeleton while the loader runs
</content>
