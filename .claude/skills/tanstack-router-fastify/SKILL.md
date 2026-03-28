---
name: tanstack-router-fastify
description: Create or extend TanStack Router file-based routes in apps/web — beforeLoad auth guards, RBAC redirects, loaders with queryClient.ensureQueryData, search params, nested layouts, and SEO head(). Use when adding a new route, protecting an existing one, or wiring a loader to the Fastify backend.
---

# TanStack Router + Fastify Skill — booking-for-all

## Purpose
Create and extend file-based routes under `apps/web/src/routes/` following the project's conventions: `createFileRoute`, Better-auth session checks, RBAC redirects, `apiFetch` for data loading, typed search params via Zod, and SEO `head()` on every route.

## When to Use
- Adding a new page route under any role segment (`/client/`, `/owner/`, `/provider/`, `/admin/`)
- Adding `beforeLoad` auth + RBAC guard to an existing unprotected route
- Wiring a `loader` to prefetch data before the component renders
- Adding typed `validateSearch` / `loaderDeps` for URL filter state
- Creating a nested layout route with `<Outlet />`

## How to Use This Skill

1. Ask the user: **what route path** and **which role segment** (`client`, `owner`, `provider`, `admin`, or public)?
2. Identify the Fastify feature endpoint(s) in `apps/server/src/features/`.
3. Fill in `template.md` with the path, role, and resource name.
4. Write the file to `apps/web/src/routes/<segment>/<name>.tsx`.
5. Run `scripts/validate.sh` to confirm no type errors.

## Route File Structure

Every route in this project follows this anatomy:

```typescript
import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { apiFetch, ApiError } from '@/lib/apiFetch'
import { queryClient } from '@/lib/react-query'   // if using loader
import { queryKeys } from '@/lib/query-keys'       // if using loader
import { useTranslation } from 'react-i18next'     // if using i18n

export const Route = createFileRoute('/segment/path')({
  head: () => ({ meta: [...] }),     // SEO — required on every route
  beforeLoad: async () => { ... },   // Auth + RBAC guard
  loader: async ({ context, deps }) => { ... }, // Prefetch data
  component: RouteComponent,
  pendingComponent: RouteSkeleton,   // Optional loading state
  errorComponent: RouteError,        // Optional error state
})

function RouteComponent() {
  const { session } = Route.useRouteContext()  // from beforeLoad return
  const data = Route.useLoaderData()           // from loader return
  // ...
}
```

## Key Rules

### Auth Checks (`beforeLoad`)
- **Always** use `authClient.getSession()` (async) in `beforeLoad` — never the reactive hook.
- The response is `{ data: Session | null }` — check `session.data`, not `session`.
- Re-throw redirect errors so TanStack Router catches them:
  ```typescript
  } catch (error) {
    if (error && typeof error === 'object' && 'to' in error) throw error
    console.warn('beforeLoad error:', error)
  }
  ```

### RBAC Redirect Matrix
| User type | Default redirect |
|-----------|-----------------|
| `isSystemAdmin === true` | `/admin` |
| role `OWNER` | `/owner/` |
| role `PROVIDER` | `/provider/` |
| role `CLIENT` | `/client/organizations/${orgId}` |
| unauthenticated | `/login` |

### Data Fetching (`loader`)
- Use `queryClient.ensureQueryData` so the TanStack Query cache is populated before render.
- Always use keys from `lib/query-keys.ts` — never inline arrays.
- For org-scoped data, include `activeOrganizationId` in the query key.
- Use `apiFetch` (not raw `fetch`) — it handles `credentials: 'include'`, unified `{ success, data }` unwrapping, and throws `ApiError`.

### `apiFetch` Usage
```typescript
import { apiFetch, ApiError } from '@/lib/apiFetch'

const data = await apiFetch<MyType>(
  `${import.meta.env.VITE_SERVER_URL}/api/resource`
)
```
- Full URL required (prefix with `import.meta.env.VITE_SERVER_URL`).
- Throws `ApiError` (has `.message`, `.code`, `.status`) — catch specifically with `instanceof ApiError`.

### Search Params
- Always validate with a **Zod schema** via `validateSearch`.
- Declare `loaderDeps` to tell the loader when to re-run.
- Navigate with `replace: true` when updating filters to avoid polluting browser history.

### SEO (`head()`)
Every route must export a `head()` returning at minimum:
- `title` meta
- `description` meta
- `og:title` + `og:description` + `og:type` meta
- `canonical` link

### i18n
- Import `useTranslation` from `react-i18next` for all user-facing strings.
- Namespace keys come from `packages/i18n/src/` — check existing keys before adding new ones.

### Component Access to Route Data
- `Route.useRouteContext()` — gets the object returned by `beforeLoad`
- `Route.useLoaderData()` — gets the object returned by `loader`
- `Route.useSearch()` — gets typed search params
- `Route.useParams()` — gets typed path params

## Common Pitfalls

| Problem | Fix |
|---------|-----|
| `beforeLoad` blocks on redirect | Re-throw errors with `'to' in error` check |
| Session check returns stale data | Add small `await new Promise(resolve => setTimeout(resolve, 100))` before `getSession()` on login route |
| `apiFetch` 401 errors | Ensure `credentials: 'include'` is set — it is, by default in `apiFetch` |
| Loader data undefined in component | Use `Route.useLoaderData()` not `useLoaderData()` from the package |
| Search param not triggering loader re-run | Add the param to `loaderDeps` |
| Org-scoped data leaking across orgs | Include `activeOrganizationId` in the query key |
| Type error on `navigate({ to: ... })` | Use `as any` for dynamic paths or register the route tree |
</content>
