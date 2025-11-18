# Prisma Development Setup

## Issue: Prisma Accelerate Connection Error

If you see this error in development:
```
prisma:warn Unable to connect to the Accelerate API
```

This means Prisma is trying to use Accelerate/Data Proxy, but you should use a direct PostgreSQL connection in development.

## Solution

### 1. Set Up Environment Variables

In `apps/server/.env`, ensure you have:

```env
# For development - direct PostgreSQL connection
DIRECT_URL=postgresql://user:password@localhost:5432/database_name

# For production - Prisma Accelerate/Data Proxy URL
DATABASE_URL=prisma+postgres://accelerate-url-here
```

### 2. Regenerate Prisma Client for Development

Since you're using direct connections in development, regenerate Prisma Client **without** `--no-engine`:

```bash
pnpm --filter @booking-for-all/db exec prisma generate
```

This generates Prisma Client with the query engine included, allowing direct PostgreSQL connections.

### 3. Verify the Setup

The code in `packages/db/src/index.ts` will automatically:
- Use `DIRECT_URL` in development (if set and DATABASE_URL is not Accelerate)
- Use `DATABASE_URL` in production or if it's an Accelerate URL

Check the console output when starting the server:
```
🔍 DB Package - selected DIRECT_URL: postgresql://...
📊 Prisma Client initialized with direct connection
```

## For Production

In production, use:
- `DATABASE_URL` with `prisma://` or `prisma+postgres://` URL
- Generate Prisma Client with `--no-engine`:
  ```bash
  pnpm --filter @booking-for-all/db exec prisma generate --no-engine
  ```

## Troubleshooting

1. **Still getting Accelerate errors?**
   - Check that `DIRECT_URL` is set in `apps/server/.env`
   - Verify `NODE_ENV` is not set to "production"
   - Regenerate Prisma Client without `--no-engine`

2. **Can't connect to database?**
   - Verify PostgreSQL is running
   - Check connection string format: `postgresql://user:password@host:port/database`
   - Test connection with: `psql postgresql://user:password@host:port/database`

3. **Production build issues?**
   - Ensure `DATABASE_URL` is set to Accelerate URL
   - Generate with `--no-engine` for production builds

