# Route Template — {{SEGMENT}}/{{name}}

## File
`apps/web/src/routes/{{segment}}/{{name}}.tsx`

---

## Route File

```typescript
import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { apiFetch, ApiError } from '@/lib/apiFetch'
import { useTranslation } from 'react-i18next'
// Uncomment if this route loads data:
// import { queryClient } from '@/lib/react-query'
// import { queryKeys } from '@/lib/query-keys'
// import { z } from 'zod'

// ── Optional: search param schema ─────────────────────────────────────────────
// const {{name}}SearchSchema = z.object({
//   page: z.number().min(1).default(1),
//   // {{SEARCH_FIELDS}}
// })

export const Route = createFileRoute('/{{segment}}/{{name}}')({

  // ── SEO ─────────────────────────────────────────────────────────────────────
  head: () => ({
    meta: [
      { title: '{{PageTitle}} - Booking for All' },
      { name: 'description', content: '{{PageDescription}}' },
      { property: 'og:title', content: '{{PageTitle}} - Booking for All' },
      { property: 'og:description', content: '{{PageDescription}}' },
      { property: 'og:type', content: 'website' },
    ],
    links: [{ rel: 'canonical', href: '/{{segment}}/{{name}}' }],
  }),

  // ── Auth + RBAC guard ────────────────────────────────────────────────────────
  beforeLoad: async () => {
    // Add a small delay on routes that may load right after OAuth redirect
    // await new Promise((resolve) => setTimeout(resolve, 100))

    try {
      const session = await authClient.getSession()

      if (!session.data) {
        throw redirect({ to: '/login' })
      }

      // Optional: role check — uncomment the relevant block
      // const isSystemAdmin = (session.data.user as any)?.isSystemAdmin
      // if (isSystemAdmin) throw redirect({ to: '/admin' })

      // OWNER check example:
      // const memberships = await apiFetch<any[]>(
      //   `${import.meta.env.VITE_SERVER_URL}/api/members/my-organizations`
      // )
      // const hasRole = memberships.some((m) => m.role === '{{REQUIRED_ROLE}}')
      // if (!hasRole) throw redirect({ to: '/' })

      return { session }
    } catch (error) {
      if (error && typeof error === 'object' && 'to' in error) throw error
      console.warn('{{name}} beforeLoad error:', error)
    }
  },

  // ── Optional: typed search params ───────────────────────────────────────────
  // validateSearch: {{name}}SearchSchema,
  // loaderDeps: ({ search }) => search,

  // ── Optional: data loader ────────────────────────────────────────────────────
  // loader: async ({ deps }) => {
  //   const data = await queryClient.ensureQueryData({
  //     queryKey: queryKeys.{{resource}}.list(deps ?? {}),
  //     queryFn: () =>
  //       apiFetch(`${import.meta.env.VITE_SERVER_URL}/api/{{route-prefix}}`),
  //   })
  //   return { data }
  // },

  component: RouteComponent,
  // pendingComponent: RouteSkeleton,
  // errorComponent: RouteError,
})

// ── Component ──────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { t } = useTranslation()
  const { session } = Route.useRouteContext()
  // const { data } = Route.useLoaderData()
  // const search = Route.useSearch()

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold">
        {t('{{i18nKey}}.title', '{{PageTitle}}')}
      </h1>
      {/* {{CONTENT}} */}
    </div>
  )
}
```

---

## Placeholders to replace

| Placeholder | Example |
|------------|---------|
| `{{segment}}` | `owner` \| `provider` \| `client` \| `admin` |
| `{{name}}` | `departments` |
| `{{SEGMENT}}` | `Owner` |
| `{{PageTitle}}` | `Departments` |
| `{{PageDescription}}` | `Manage your organization's departments` |
| `{{REQUIRED_ROLE}}` | `OWNER` \| `PROVIDER` \| `CLIENT` |
| `{{resource}}` | `departments` (matches query-keys.ts key) |
| `{{route-prefix}}` | `/departments` (Fastify route prefix) |
| `{{SEARCH_FIELDS}}` | `search: z.string().default('')` |
| `{{i18nKey}}` | `owner.departments` |
| `{{CONTENT}}` | JSX placeholder |
</content>
