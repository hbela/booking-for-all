# Initialize BookingProduction Database

Since Prisma Accelerate doesn't support direct SQL execution, use Prisma migrations to initialize your database.

## Prerequisites

You need **two connection URLs** from Prisma Accelerate:
1. **Accelerate URL** (for application): `prisma+postgres://accelerate.prisma-data.net/?api_key=...`
2. **Direct URL** (for migrations): A direct PostgreSQL connection string

> **Note**: If you only have the Accelerate URL, you can find the direct connection URL in your Prisma Accelerate dashboard under "Connection Details" or "Direct Connection".

## Method 1: Using Prisma Migrations (Recommended)

### Step 1: Set Environment Variables

**IMPORTANT**: The schema file now includes the connection URLs. You need to set the `DIRECT_URL` environment variable for migrations.

**Option A: Add to `apps/server/.env` file:**

```env
# Direct connection URL for migrations (REQUIRED for migrate deploy)
DIRECT_URL=postgresql://user:password@host:5432/database

# Accelerate URL (for application runtime)
DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY
```

**Option B: Set environment variables directly in PowerShell:**

```powershell
# Windows PowerShell - Set for current session
$env:DIRECT_URL="postgresql://user:password@host:5432/database"
$env:DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
```

**Option C: Set environment variables directly in Bash:**

```bash
# Linux/Mac
export DIRECT_URL="postgresql://user:password@host:5432/database"
export DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
```

### Step 2: Deploy Migrations

**IMPORTANT**: Due to Prisma CLI issues with TypeScript config files, use the deployment script:

```powershell
# From packages/db directory
cd packages/db

# Set both environment variables (DIRECT_URL is required, DATABASE_URL can be the same)
$env:DIRECT_URL="postgres://your-direct-connection-string"
$env:DATABASE_URL="postgres://your-direct-connection-string"  # Can be same as DIRECT_URL

# Run the deployment script
node scripts/deploy-migrations.mjs
```

**Alternative**: If you prefer to run Prisma directly, you need to copy migrations to the expected location first:

```powershell
# Copy migrations to where Prisma expects them (relative to schema)
Copy-Item -Path "prisma\migrations" -Destination "prisma\schema\migrations" -Recurse

# Then run migrate deploy
$env:DATABASE_URL="postgres://..."
$env:DIRECT_URL="postgres://..."
npx prisma migrate deploy --schema=./prisma/schema/schema.prisma
```

This will apply all migrations in order:
- `20251103201638_init` - Creates all tables, indexes, and foreign keys
- `20251122153851_add_organization_timezone` - Adds timezone fields to organization

## Method 2: Using Prisma DB Push (Alternative)

If you don't have a direct connection URL or want to sync the schema directly:

```bash
# From packages/db directory
npx prisma db push
```

**Note**: `db push` syncs the schema but doesn't create migration history. Use migrations for production.

## Method 3: Using Prisma Migrate Deploy with Custom Connection

You can also specify the connection URL directly:

```bash
cd packages/db
npx prisma migrate deploy --schema=./prisma/schema/schema.prisma
```

With environment variable:
```bash
DIRECT_URL="postgresql://..." npx prisma migrate deploy
```

## Verify the Setup

After running migrations, verify the structure:

```bash
# Open Prisma Studio to view the database
npx prisma studio
```

Or check the tables:
```bash
npx prisma db execute --stdin
# Then paste: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

## Important Notes

1. **Direct URL Required**: Prisma migrations require a direct PostgreSQL connection, not the Accelerate URL
2. **No Data**: Migrations only create the structure - no data is inserted
3. **Migration History**: After running `migrate deploy`, Prisma will track which migrations have been applied
4. **Production Setup**: For production, keep the Accelerate URL in `DATABASE_URL` and use the direct URL only for migrations

## Troubleshooting

**Note**: The `prisma.config.ts` file has been removed as Prisma CLI doesn't support config files and was causing parsing errors. All Prisma commands should use the `--schema` flag to specify the schema file location.

**Error: "Environment variable not found: DATABASE_URL" or "DIRECT_URL"**
- Make sure you've set the environment variables (see Step 1)
- For migrations, `DIRECT_URL` is required (direct PostgreSQL connection)
- `DATABASE_URL` can be the Accelerate URL or the same as DIRECT_URL

**Error: "Can't reach database server"**
- Verify your direct connection URL is correct
- Check that the database is accessible from your network
- Ensure firewall rules allow your IP

**Error: "Migration already applied"**
- If migrations were partially applied, you may need to mark them as applied:
  ```bash
  npx prisma migrate resolve --applied 20251103201638_init
  npx prisma migrate resolve --applied 20251122153851_add_organization_timezone
  ```

**Error: "Schema and database are out of sync"**
- Run `npx prisma db push` to sync, or
- Create a new migration: `npx prisma migrate dev --name sync_schema`

