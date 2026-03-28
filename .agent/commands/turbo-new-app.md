# Create New TurboRepo App

Create a new app in this TurboRepo:

1. Run `pnpm turbo gen app --name $ARGUMENTS`
2. Configure the app based on type:
   - For web apps: Next.js with Tailwind v4 + shadcn/ui
   - For API apps: Fastify with Prisma
3. Add to turbo.json pipeline if needed
4. Update root package.json scripts

## App Types
- `web` - Next.js frontend app
- `api` - Fastify backend service
- `shared` - Shared package (UI components, utilities)