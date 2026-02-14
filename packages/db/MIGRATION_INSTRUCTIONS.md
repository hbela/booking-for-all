# Migration Instructions: Add Role to Member

## Step 1: Create and Run Prisma Migration

From the **root** of the project, run:

```bash
cd packages/db
npx prisma migrate dev --name add_role_to_member --schema=./prisma/schema/schema.prisma
```

Or if you're already in `packages/db`:

```bash
npx prisma migrate dev --name add_role_to_member --schema=./prisma/schema/schema.prisma
```

**Note:** Make sure your `.env` file is in the `packages/db` directory with `DATABASE_URL` set.

## Step 2: Regenerate Prisma Client

From `packages/db` directory:

```bash
npx prisma generate --schema=./prisma/schema/schema.prisma
```

Or use the npm script:

```bash
npm run db:generate
```

## Step 3: Run Data Migration Script

From the **root** of the project:

```bash
npx tsx packages/db/scripts/migrate-member-roles.ts

```

This will populate the `role` field for all existing Member records with `CLIENT` as the default value.

## Troubleshooting

If you get "Environment variable not found: DATABASE_URL":
- Make sure you have a `.env` file in `packages/db/` directory
- Or set `DATABASE_URL` in your root `.env` file
- Prisma will look for `.env` files in the current directory and parent directories

