# Database Commands Documentation

This document explains all the database-related npm scripts available in the `@booking-for-all/db` package.

## Prisma Schema Location

All commands use the custom schema path: `./prisma/schema/schema.prisma` (instead of the default `./prisma/schema.prisma`).

---

## Prisma Client Generation Commands

### `npm run db:generate`
**Purpose**: Generate Prisma Client from the schema for development.

**Command**: `prisma generate --schema=./prisma/schema/schema.prisma`

**When to use**:
- After modifying the Prisma schema
- When Prisma Client types are out of sync
- After pulling changes that include schema updates

**What it does**:
- Reads the Prisma schema file
- Generates TypeScript types and Prisma Client code
- Outputs to `prisma/generated/` directory

---

### `npm run db:generate:dev`
**Purpose**: Same as `db:generate` - generates Prisma Client for development.

**Command**: `prisma generate --schema=./prisma/schema/schema.prisma`

**Note**: This is identical to `db:generate`. Both commands generate the full Prisma Client with query engine.

---

### `npm run db:generate:prod`
**Purpose**: Generate Prisma Client for production builds (without query engine).

**Command**: `prisma generate --no-engine --schema=./prisma/schema/schema.prisma`

**When to use**:
- In CI/CD pipelines for production builds
- When you want to reduce bundle size
- For serverless deployments where query engine is provided separately

**What it does**:
- Generates Prisma Client without bundling the query engine
- Smaller output size
- Query engine must be provided at runtime (e.g., via Prisma Accelerate or edge runtime)

**Difference from dev**: The `--no-engine` flag excludes the query engine binary.

---

## Migration Commands

### `npm run db:migrate`
**Purpose**: **CREATE AND APPLY** new database migrations during development.

**Command**: `prisma migrate dev --schema=./prisma/schema/schema.prisma`

**Key Point**: This command **creates** new migration files AND applies them. Use this when you've modified the schema and need to generate a new migration.

**When to use**:
- After modifying the Prisma schema file
- When you need to create a new migration file
- During development when schema changes are needed

**What it does**:
1. Compares your schema with the current database state
2. **Creates a new migration file** if schema changes are detected
3. Applies the migration to your development database
4. Regenerates Prisma Client automatically
5. Prompts you to name the migration if creating a new one

**Example workflow**:
```bash
# 1. Edit schema.prisma (add a new field, table, etc.)
# 2. Run migration - this CREATES the migration file
npm run db:migrate
# 3. Enter migration name when prompted (e.g., "add_user_email_field")
# 4. Migration file is created in prisma/migrations/ and applied automatically
```

**⚠️ Important**: 
- This command **creates** migration files - use it when you've changed the schema
- Modifies your development database
- **Never use it on production!** Use `db:migrate:deploy` instead

---

### `npm run db:migrate:deploy`
**Purpose**: **APPLY ONLY** existing migrations to any database (dev, staging, production).

**Command**: `prisma migrate deploy --schema=./prisma/schema/schema.prisma`

**Key Point**: This command **only applies** existing migration files. It does NOT create new migrations. Use this when you have migration files and want to apply them to a database.

**When to use**:
- Applying existing migrations to development database
- Deploying migrations to production/staging
- Applying migrations that were created in development to a different database
- In CI/CD pipelines for production deployments
- When you accidentally applied a migration to the wrong database and need to apply it to the correct one

**What it does**:
1. Reads migration files from `prisma/migrations/` directory
2. Checks which migrations have already been applied to the target database
3. Applies only pending migrations in order
4. **Does NOT create new migrations** (unlike `db:migrate`)
5. **Does NOT regenerate Prisma Client**
6. Uses whatever `DATABASE_URL`/`DIRECT_URL` environment variables are set to

**Example scenarios**:
```bash
# Scenario 1: Apply existing migrations to dev database
# (after accidentally applying to production)
# 1. Update .env to point to dev database
# 2. Apply existing migrations
npm run db:migrate:deploy

# Scenario 2: Deploy to production
# 1. Set production DATABASE_URL
# 2. Apply all pending migrations
npm run db:migrate:deploy
```

**⚠️ Important**: 
- This is a **read-only operation on migration files** - it only applies, never creates
- Only applies existing migrations that are in `prisma/migrations/`
- Safe for production use
- Uses whatever database connection is in your environment variables
- **If you need to create a new migration, use `db:migrate` instead**

---

### `npm run db:migrate:status`
**Purpose**: Check the status of migrations (which are applied, which are pending).

**Command**: `prisma migrate status --schema=./prisma/schema/schema.prisma`

**When to use**:
- Before deploying to production
- To verify migration state
- To troubleshoot migration issues

**What it does**:
- Compares migration files with database migration history
- Shows which migrations have been applied
- Shows which migrations are pending
- Detects drift (schema differences not covered by migrations)

**Output example**:
```
✅ Database is up to date!
✅ 3 migrations found in prisma/migrations
✅ 3 migrations applied to database
```

---

## Custom Script Commands

### `npm run db:sync:production`
**Purpose**: Synchronize production database with latest migrations from development.

**Command**: `node scripts/sync-production.mjs`

**When to use**:
- Deploying database changes to production
- Syncing production database after creating migrations in development
- Automated production deployments

**What it does**:
1. Checks migration status
2. Deploys any pending migrations to production
3. Verifies the deployment was successful

**Environment variables required**:
- `DIRECT_URL`: Production database direct connection URL
- `DATABASE_URL`: Production database URL (can be same as DIRECT_URL)

**⚠️ Important**: 
- This script reads environment variables from `apps/server/.env`
- Only use this when you're ready to deploy to production
- Make sure you have backups before running

---

### `npm run db:deploy`
**Purpose**: Deploy Prisma migrations to production database.

**Command**: `node scripts/deploy-migrations.mjs`

**When to use**:
- Alternative to `db:migrate:deploy` with custom deployment logic
- When you need more control over the deployment process

**What it does**:
- Uses explicit `--schema` flag to avoid config parsing issues
- Deploys migrations to production database
- Handles environment variable loading from `apps/server/.env`

**Environment variables required**:
- `DIRECT_URL`: Production database direct connection URL
- `DATABASE_URL`: Production database URL (can be same as DIRECT_URL)

**Difference from `db:migrate:deploy`**: This is a wrapper script that ensures proper schema path and environment variable loading.

---

### `npm run db:fix-drift`
**Purpose**: Fix database drift by marking migrations as applied without running them.

**Command**: `node scripts/fix-drift.mjs [MIGRATION_NAME]`

**When to use**:
- Production database has schema changes but migration history is missing
- You see "Drift detected" errors
- Manual schema changes were made directly to the database
- You need to sync migration history with actual database state

**What it does**:
1. Takes a migration name as argument
2. Marks the migration as applied in the database without running it
3. Useful when schema changes were applied manually

**Example usage**:
```bash
npm run db:fix-drift 20251122153851_add_organization_timezone
```

**⚠️ Warning**: 
- Use with caution - this bypasses normal migration execution
- Only use when you're certain the schema changes are already in the database
- Can cause issues if used incorrectly

**Environment variables required**:
- `DIRECT_URL`: Production database direct connection URL
- `DATABASE_URL`: Production database URL (can be same as DIRECT_URL)

---

### `npm run db:migrate-data`
**Purpose**: Migrate data from SQLite to PostgreSQL (one-time data migration script).

**Command**: `tsx scripts/migrate-sqlite-to-postgres.ts`

**When to use**:
- One-time migration from SQLite to PostgreSQL
- Moving from development SQLite to production PostgreSQL
- Data migration between database systems

**What it does**:
- Reads data from SQLite database
- Transforms and writes data to PostgreSQL database
- Handles schema differences between databases

**⚠️ Important**: 
- This is a one-time data migration script
- Not for regular use
- Make sure to backup both databases before running

---

## Additional Commands (Not in lines 18-28)

### `npm run db:push`
**Purpose**: Push schema changes directly to database without creating migrations (prototyping).

**Command**: `prisma db push --schema=./prisma/schema/schema.prisma`

**When to use**:
- Quick prototyping
- Development/testing when you don't need migration history
- Resetting development database

**⚠️ Warning**: 
- Does NOT create migration files
- Not suitable for production
- Can cause data loss if schema changes are incompatible

---

### `npm run db:studio`
**Purpose**: Open Prisma Studio - a visual database browser and editor.

**Command**: `prisma studio --schema=./prisma/schema/schema.prisma`

**When to use**:
- Viewing database data in a GUI
- Manually editing records
- Debugging data issues
- Exploring database structure

**What it does**:
- Opens a web-based database browser at `http://localhost:5555`
- Allows you to view, edit, and delete records
- Provides a visual interface to your database

---

## Common Workflows

### Development Workflow (Creating New Migrations)
```bash
# 1. Make changes to schema.prisma
# 2. Create and apply migration (CREATES migration file)
npm run db:migrate

# 3. Prisma Client is auto-regenerated
# 4. View database in Prisma Studio (optional)
npm run db:studio
```

### Applying Existing Migrations to Different Database
```bash
# Scenario: You have migration files and want to apply them to dev/staging/production

# 1. Update .env with target database connection
#    DATABASE_URL=postgresql://user:pass@host:5432/target_db
#    DIRECT_URL=postgresql://user:pass@host:5432/target_db

# 2. Apply existing migrations (does NOT create new ones)
npm run db:migrate:deploy

# 3. Verify migration status
npm run db:migrate:status
```

### Production Deployment Workflow
```bash
# 1. Check migration status
npm run db:migrate:status

# 2. Deploy migrations to production (applies existing migrations only)
npm run db:migrate:deploy
# OR
npm run db:deploy

# 3. Verify deployment
npm run db:migrate:status
```

### Production Sync Workflow
```bash
# Sync production with latest migrations
npm run db:sync:production
```

## Key Differences Summary

| Command | Creates Migrations? | Applies Migrations? | Regenerates Client? | Use Case |
|---------|---------------------|-------------------|---------------------|----------|
| `db:migrate` | ✅ **Yes** | ✅ Yes | ✅ Yes | Schema changed, need new migration |
| `db:migrate:deploy` | ❌ **No** | ✅ Yes | ❌ No | Apply existing migrations to any database |
| `db:migrate:status` | ❌ No | ❌ No | ❌ No | Check which migrations are applied |

**Remember**: 
- **Changed schema?** → Use `db:migrate` (creates + applies)
- **Have migration files?** → Use `db:migrate:deploy` (applies only)

---

## Environment Variables

All commands require proper database connection strings:

- **Development**: Usually in `apps/server/.env` or `packages/db/.env`
- **Production**: Set via environment variables or `.env` file

Required variables:
- `DATABASE_URL`: Main database connection string
- `DIRECT_URL`: Direct connection string (for migrations, usually same as DATABASE_URL)

Example:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/dbname?schema=public"
```

---

## Troubleshooting

### "Could not find Prisma Schema" error
- Make sure you're running commands from `packages/db` directory
- Or use the npm scripts which include the `--schema` flag

### Migration drift detected
- Use `npm run db:migrate:status` to see what's different
- Use `npm run db:fix-drift` if you manually applied changes
- Or create a new migration to sync the schema

### Production deployment fails
- Check `DATABASE_URL` and `DIRECT_URL` are set correctly
- Verify database is accessible
- Check migration status first with `db:migrate:status`
- Ensure you have proper database permissions

---

## Best Practices

1. **Always create migrations in development** - Use `db:migrate` to create migration files
2. **Never use `db:push` in production** - It doesn't create migration history
3. **Check status before deploying** - Use `db:migrate:status` to verify state
4. **Backup before production changes** - Always backup production database before migrations
5. **Test migrations locally first** - Apply migrations to a test database before production
6. **Use `db:migrate:deploy` for production** - Never use `db:migrate` on production databases

