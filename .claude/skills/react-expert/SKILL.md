---
name: react-expert
description: Build React 19 components in apps/web using Radix UI, Tailwind CSS 4, TanStack Form, sonner, and i18next following booking-for-all conventions.
---

# React Expert Skill — booking-for-all

## Purpose
Create and extend React 19 components in `apps/web/src/` following project conventions: Radix UI primitives, Tailwind CSS 4 utility classes, TanStack Form for form state, sonner for toasts, and i18next for all user-visible strings.

## When to Use
- Building a new page component or shared UI component
- Adding a form with validation (TanStack Form + Zod)
- Integrating a Radix UI primitive (Dialog, DropdownMenu, Select, etc.)
- Adding calendar/scheduling UI with `react-big-calendar`
- Wiring i18n translations into a component
- Refactoring class-based or non-idiomatic React to React 19 patterns

## How to Use This Skill

1. Ask the user: **what component** is needed and **which route segment** it belongs to?
2. Identify the relevant i18n keys in `packages/i18n/src/`.
3. Fill in `template.md` and write the component file.
4. Run `scripts/validate.sh` to confirm no type errors.

## Key Rules

### File locations
- Page components: `apps/web/src/routes/<segment>/<page>.tsx`
- Shared/reusable components: `apps/web/src/components/<name>.tsx`
- Form components: co-locate with the page or in `apps/web/src/components/forms/`

### Styling
- **Tailwind CSS 4** — use utility classes only, no inline styles.
- Follow the design system already in the codebase; check existing components before inventing new patterns.
- Use `cn()` (clsx/tailwind-merge helper) for conditional class merging.

### Forms (TanStack Form)
```typescript
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'

const form = useForm({
  defaultValues: { /* ... */ },
  validatorAdapter: zodValidator(),
  onSubmit: async ({ value }) => { /* call mutation */ },
})
```

### Toasts (sonner)
```typescript
import { toast } from 'sonner'
toast.success('Booking confirmed')
toast.error(err.message ?? 'Something went wrong')
```

### i18n
```typescript
import { useTranslation } from 'react-i18next'
const { t } = useTranslation()
// Keys live in packages/i18n/src/en.ts (and hu.ts, de.ts)
```

### Radix UI
- Import from `@radix-ui/react-*` — primitives only, no styled wrappers unless already in the codebase.
- Always provide accessible labels (`aria-label`, `VisuallyHidden`, or visible text).

### React 19 patterns
- Prefer `use()` for promise unwrapping inside Suspense boundaries.
- Use `useOptimistic` for instant UI feedback on mutations (pairs well with TanStack Query optimistic updates).
- Server Actions are **not** used — this is a SPA backed by a Fastify API.

## Common Pitfalls
| Problem | Fix |
|---------|-----|
| Hydration mismatch | Pre-rendered routes must not use `window`/`document` at module level — guard with `useEffect` |
| Missing translation key | Add to all three locales (`en.ts`, `hu.ts`, `de.ts`) in `packages/i18n/src/` |
| Form not resetting after submit | Call `form.reset()` in `onSubmit` after the mutation succeeds |
| Radix Dialog not closing | Control `open` state and set to `false` in `onSuccess` handler |
