---
name: tanstack-query-fastify
description: Generate typed TanStack Query hooks, API client calls, and mutation patterns wired to this project's Fastify 5 backend. Use when adding data-fetching hooks, query keys, mutations with optimistic updates, or auth-aware queries in apps/web.
---

# TanStack Query + Fastify Skill — booking-for-all

## Purpose
Create and extend TanStack Query hooks in `apps/web` that talk to the Fastify 5 backend in `apps/server`. Covers query key factories, typed fetch hooks, mutations with optimistic updates, auth-aware queries, pagination, and prefetching — all wired to this project's conventions.

## When to Use
- Adding a new data-fetching hook for a backend resource
- Implementing a mutation (create / update / delete) with cache invalidation
- Adding optimistic updates to an existing mutation
- Setting up auth-aware or protected queries
- Implementing infinite scroll or paginated lists
- Prefetching data in TanStack Router loaders

## How to Use This Skill

1. Ask the user: **what resource** needs a hook (e.g. `bookings`, `providers`, `events`)?
2. Identify the corresponding Fastify route prefix in `apps/server/src/features/`.
3. Fill in `template.md` with the resource name, endpoint paths, and field types.
4. Write output files under `apps/web/src/`:
   - Query keys → `lib/query-keys.ts` (add to existing factory)
   - Hooks → `hooks/use-{{resource}}.ts`
5. Run `scripts/validate.sh` to confirm no type errors.

## Stack Conventions

| Concern | Tool |
|---------|------|
| Data fetching | TanStack Query 5 (`@tanstack/react-query`) |
| Routing / loaders | TanStack Router (file-based, `apps/web/src/routes/`) |
| Auth | Better-auth — **cookie-based**, use `credentials: 'include'` |
| Toast notifications | sonner (`import { toast } from 'sonner'`) |
| Base API URL | `import.meta.env.VITE_SERVER_URL` |

## Key Rules

### API Client
- Use `credentials: 'include'` on every fetch — Better-auth relies on cookies.
- Base URL comes from `import.meta.env.VITE_SERVER_URL`.
- On `401`/`403` responses, **do not retry** — set `retry: false` or check status in retry callback.
- Throw a typed `ApiError` so hooks can narrow error types.

### Query Keys
- Always use the factory pattern in `lib/query-keys.ts`.
- Scope keys by resource: `['bookings', 'list', filters]`, `['bookings', 'detail', id]`.
- Never inline raw arrays — always go through the factory.

### Queries
- Set `staleTime` based on data volatility:
  - Session / auth: `5 * 60 * 1000` (5 min)
  - Frequently changing (bookings, events): `60 * 1000` (1 min)
  - Stable (org info, providers): `5 * 60 * 1000` (5 min)
- Use `enabled` to gate queries on auth status or a required param.

### Mutations
- Always call `queryClient.invalidateQueries` in `onSettled` (not only `onSuccess`).
- For optimistic updates: cancel → snapshot → mutate cache → rollback in `onError` → invalidate in `onSettled`.
- Show `toast.success` / `toast.error` via sonner in `onSuccess` / `onError`.

### Auth-Aware Patterns
- Use the existing `useSession` / `useCurrentUser` hooks before writing new auth hooks.
- Gate protected queries with `enabled: isAuthenticated`.
- Multi-tenant: always include `activeOrganizationId` from session in query keys when the data is org-scoped.

## Common Pitfalls

| Problem | Fix |
|---------|-----|
| 401 on every request | Check `credentials: 'include'` is set and CORS allows credentials |
| Stale data after mutation | Ensure `invalidateQueries` targets the right key scope |
| Hook fires before auth ready | Add `enabled: !!session` to the query options |
| Org-scoped data leaking across orgs | Include `activeOrganizationId` in the query key |
| Optimistic rollback not working | Return `{ previousData }` from `onMutate` and read `context` in `onError` |
| Infinite loop on `enabled` | Stabilise the dependency (e.g. use `!!userId` not the object itself) |
</content>
</invoke>