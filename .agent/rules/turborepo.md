---
trigger: always_on
---


---

## Step 5: Configure Rules for Consistency

Create `.agent/rules/turborepo.md`:

```markdown
# TurboRepo Rules

## Package Management
- Always use `pnpm` (no npm or yarn)
- Run `pnpm install` at root for all dependencies
- Use workspace protocols: `"package": "workspace:*"`

## Workspace Structure
- `apps/web` - Next.js frontend
- `apps/api` - Fastify backend
- `packages/database` - Prisma client and schemas
- `packages/ui` - Shared UI components (shadcn/ui)
- `packages/utils` - Shared utilities
- `packages/types` - Shared TypeScript types

## Build Pipeline
- `build` - Build all apps and packages
- `dev` - Run all apps in development
- `lint` - Lint all packages
- `test` - Run all tests
- `db:generate` - Generate Prisma client
- `db:migrate` - Run migrations
- `db:studio` - Open Prisma Studio

## Import Rules
- `@/` imports within apps point to app root
- `@ui/` for UI components
- `@db/` for database client
- `@utils/` for utilities
- `@types/` for shared types