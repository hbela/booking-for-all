# Understanding Database Drift

## What Happened?

You encountered a "Drift detected" error when trying to create a new migration. This happened because:

1. **Production database was updated directly** (likely using `db push` or manual SQL)
2. **Migration history was not updated** - The `_prisma_migrations` table didn't record these changes
3. **Prisma detected the mismatch** - When you tried to create a new migration, Prisma saw that the database schema didn't match the migration history

## Why This Is a Problem

- **No migration history** - You can't track what changes were made
- **Can't rollback** - Without migration history, you can't easily revert changes
- **Team confusion** - Other developers don't know what changed
- **Deployment issues** - New migrations may conflict with existing changes

## How We Fixed It

We resolved the drift by:

1. **Marked existing migration as applied** - Used `prisma migrate resolve --applied` to tell Prisma that the timezone migration was already in the database
2. **Created new migration** - Successfully created the `add_org_qr_apk` migration
3. **Applied to dev** - Migration is now in dev database with proper history

## How to Prevent This in the Future

### ✅ DO: Use Migrations for Production

```powershell
# 1. Create migration in dev
pnpm db:migrate --name your_feature

# 2. Commit migration files
git add packages/db/prisma/schema/migrations/
git commit -m "feat: add migration for your feature"
git push

# 3. Deploy to production
$env:DATABASE_URL="postgres://production-url"
$env:DIRECT_URL="postgres://production-url"
pnpm db:sync:production
```

### ❌ DON'T: Use db push on Production

```powershell
# ❌ NEVER do this on production
npx prisma db push --schema=./prisma/schema/schema.prisma
```

**Why?** `db push` changes the database but doesn't create migration files or update migration history.

### ❌ DON'T: Make Manual SQL Changes

```sql
-- ❌ NEVER do this on production
ALTER TABLE organization ADD COLUMN new_field TEXT;
```

**Why?** Manual changes aren't tracked in migration history and can cause drift.

## Current Status

✅ **Dev Database**: Up to date with all migrations including `add_org_qr_apk`  
⚠️ **Production Database**: Needs to be synced

## Next Steps: Sync Production

To sync your production database with the new migration:

```powershell
# 1. Set production database URLs
$env:DATABASE_URL="postgres://production-direct-url"
$env:DIRECT_URL="postgres://production-direct-url"

# 2. Sync production (this will apply the new migration)
pnpm db:sync:production
```

This will:
- Check current migration status
- Deploy the `add_org_qr_apk` migration
- Verify the deployment

## If You See Drift Again

If you encounter drift in the future:

1. **Check what's different:**
   ```powershell
   pnpm db:migrate:status
   ```

2. **If database has changes not in history:**
   ```powershell
   # Mark the migration as applied (if database already has the changes)
   pnpm db:fix-drift MIGRATION_NAME
   ```

3. **If history has migrations not in database:**
   ```powershell
   # Deploy missing migrations
   pnpm db:sync:production
   ```

## Best Practices Summary

1. ✅ Always use `pnpm db:migrate` in development
2. ✅ Always use `pnpm db:sync:production` for production
3. ❌ Never use `db push` on production
4. ❌ Never make manual SQL changes on production
5. ✅ Always commit migration files to git
6. ✅ Test migrations in dev before deploying to production

## Resources

- **Workflow Guide**: See `MIGRATION_WORKFLOW.md` for detailed workflow
- **Scripts**: 
  - `scripts/sync-production.mjs` - Sync production database
  - `scripts/fix-drift.mjs` - Fix drift issues
  - `scripts/deploy-migrations.mjs` - Deploy migrations

