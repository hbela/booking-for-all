# Database Migration Workflow

This document describes the proper workflow for managing database migrations between development and production environments.

## Overview

**Key Principle**: Always use migrations for production. Never use `db push` on production databases.

- **Development**: Use `prisma migrate dev` to create and apply migrations
- **Production**: Use `prisma migrate deploy` to apply existing migrations

## Workflow: Dev → Production

### Step 1: Create Migration in Development

```powershell
# From packages/db directory
cd packages/db

# Make sure you're connected to DEV database
# Check your .env file points to dev database
$env:DATABASE_URL="postgres://dev-database-url"
$env:DIRECT_URL="postgres://dev-database-url"

# Create and apply migration
npx prisma migrate dev --name your_migration_name --schema=./prisma/schema/schema.prisma
```

This will:
- Create a new migration file in `prisma/schema/migrations/`
- Apply it to your dev database
- Update the `_prisma_migrations` table

### Step 2: Commit Migration Files

```bash
# Commit the migration files
git add packages/db/prisma/schema/migrations/
git commit -m "feat: add migration for [description]"
git push
```

**Important**: Migration files are version-controlled and should be committed to git.

### Step 3: Deploy to Production

**Option A: Using npm script (Recommended)**

```powershell
# From repository root
# Set PRODUCTION database URLs
$env:DATABASE_URL="postgres://production-direct-url"  # Use direct URL for migrations
$env:DIRECT_URL="postgres://production-direct-url"

# Sync production database (checks status, deploys, verifies)
pnpm db:sync:production
```

**Option B: Using deployment script**

```powershell
# From packages/db directory
cd packages/db

# Set production URLs
$env:DATABASE_URL="postgres://production-direct-url"
$env:DIRECT_URL="postgres://production-direct-url"

# Run deployment script
node scripts/deploy-migrations.mjs
```

**Option C: Direct Prisma command**

```powershell
# From packages/db directory
cd packages/db

# Set PRODUCTION database URLs
$env:DATABASE_URL="postgres://production-direct-url"
$env:DIRECT_URL="postgres://production-direct-url"

# Deploy migrations (this only applies new migrations, doesn't create them)
npx prisma migrate deploy --schema=./prisma/schema/schema.prisma
```

## Understanding Drift

**Drift** occurs when your database schema doesn't match your migration history. This happens when:

1. ✅ **Correct**: Using `migrate dev` → creates migration → applies to dev → commit → deploy to prod
2. ❌ **Wrong**: Using `db push` on production → changes database but no migration history
3. ❌ **Wrong**: Manual SQL changes → database changed but migration history not updated

### How to Detect Drift

```powershell
npx prisma migrate status --schema=./prisma/schema/schema.prisma
```

If you see "Drift detected", it means:
- Your database has changes that aren't in the migration history
- Or your migration history has migrations that aren't in the database

### How to Fix Drift

#### Option 1: Mark Existing Migrations as Applied (if database already has the changes)

If your production database already has the schema changes but the migration history is missing:

**Using npm script (Recommended):**

```powershell
# From repository root
$env:DATABASE_URL="postgres://production-url"
$env:DIRECT_URL="postgres://production-url"

# Fix drift by marking migration as applied
pnpm db:fix-drift 20251122153851_add_organization_timezone
```

**Or using Prisma directly:**

```powershell
# From packages/db directory
cd packages/db

# Set production URLs
$env:DATABASE_URL="postgres://production-url"
$env:DIRECT_URL="postgres://production-url"

# Mark a specific migration as applied (without running it)
npx prisma migrate resolve --applied MIGRATION_NAME --schema=./prisma/schema/schema.prisma

# Example:
npx prisma migrate resolve --applied 20251122153851_add_organization_timezone --schema=./prisma/schema/schema.prisma
```

#### Option 2: Create a Baseline Migration

If your production database has manual changes that need to be captured:

```powershell
# 1. Connect to production database
$env:DATABASE_URL="postgres://production-url"
$env:DIRECT_URL="postgres://production-url"

# 2. Create a migration that captures current state
npx prisma migrate dev --name baseline_production_state --create-only --schema=./prisma/schema/schema.prisma

# 3. Review the generated migration SQL
# 4. Mark it as applied (since database already has these changes)
npx prisma migrate resolve --applied baseline_production_state --schema=./prisma/schema/schema.prisma
```

#### Option 3: Reset and Reapply (⚠️ DESTRUCTIVE - Only for Dev)

**WARNING**: This deletes all data. Only use on development databases.

```powershell
npx prisma migrate reset --schema=./prisma/schema/schema.prisma
```

## Environment-Specific Workflows

### Development Environment

```powershell
# 1. Make schema changes in schema.prisma
# 2. Create and apply migration
npx prisma migrate dev --name descriptive_name --schema=./prisma/schema/schema.prisma

# 3. Verify changes
npx prisma studio --schema=./prisma/schema/schema.prisma
```

### Production Environment

```powershell
# 1. Ensure you have the latest migration files from git
git pull

# 2. Set production database URLs
$env:DATABASE_URL="postgres://production-direct-url"
$env:DIRECT_URL="postgres://production-direct-url"

# 3. Deploy migrations (applies only new migrations)
npx prisma migrate deploy --schema=./prisma/schema/schema.prisma

# 4. Verify deployment
npx prisma migrate status --schema=./prisma/schema/schema.prisma
```

## Best Practices

1. **Always use migrations for production** - Never use `db push` on production
2. **Test migrations in dev first** - Always test migrations on dev before deploying to production
3. **Commit migration files** - Migration files should be in version control
4. **Review migration SQL** - Before deploying, review the generated SQL
5. **Backup before production migrations** - Always backup production database before applying migrations
6. **Use descriptive migration names** - Names should clearly describe what the migration does
7. **One migration per feature** - Don't bundle multiple unrelated changes in one migration

## Troubleshooting

### "Drift detected" Error

**Cause**: Database schema doesn't match migration history.

**Solution**:
1. Check what's different: `npx prisma migrate status`
2. If database has changes not in history: Use `migrate resolve --applied`
3. If history has migrations not in database: Deploy missing migrations

### "Migration already applied" Error

**Cause**: Migration is in the `_prisma_migrations` table but database doesn't have the changes.

**Solution**:
```powershell
# Mark as rolled back, then reapply
npx prisma migrate resolve --rolled-back MIGRATION_NAME --schema=./prisma/schema/schema.prisma
npx prisma migrate deploy --schema=./prisma/schema/schema.prisma
```

### "Can't reach database server" Error

**Cause**: Wrong connection URL or network issue.

**Solution**:
1. Verify `DIRECT_URL` is correct (must be direct PostgreSQL URL, not Accelerate URL)
2. Check network connectivity
3. Verify firewall rules

## Using NPM Scripts (Recommended)

For convenience, use these npm scripts from the repository root:

```powershell
# Development
pnpm db:migrate                    # Create and apply new migration
pnpm db:migrate:status             # Check migration status
pnpm db:studio                     # Open Prisma Studio

# Production
pnpm db:sync:production            # Sync production with latest migrations
pnpm db:migrate:deploy             # Deploy migrations to production
pnpm db:migrate:status             # Check production migration status
pnpm db:fix-drift MIGRATION_NAME   # Fix drift (mark migration as applied)
```

Or from `packages/db` directory:

```powershell
cd packages/db
pnpm db:migrate
pnpm db:sync:production
```

## Quick Reference

| Command | Purpose | Environment |
|---------|---------|-------------|
| `pnpm db:migrate` | Create and apply new migration | Development only |
| `pnpm db:migrate:deploy` | Apply existing migrations | Production |
| `pnpm db:migrate:status` | Check migration status | Both |
| `pnpm db:sync:production` | Sync production with latest migrations | Production |
| `pnpm db:fix-drift MIGRATION_NAME` | Mark migration as applied (fix drift) | Production |
| `prisma db push` | Sync schema without migrations | Development only |
| `prisma migrate reset` | Reset database and reapply all migrations | Development only |

## Current Migration History

- `20251103201638_init` - Initial database schema
- `20251122153851_add_organization_timezone` - Added timezone fields to organization
- `20251129123017_add_org_qr_apk` - Added qrCodeKey and apkKey to organization

