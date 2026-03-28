# Prisma Skill — ProjectDeck

## Purpose
Guidance for schema design, querying, transactions, and error handling using Prisma in ProjectDeck. Covers the actual setup: `@projectdeck/db` singleton backed by `pg` pool + `@prisma/adapter-pg` (driver adapters preview).

## When to Use
- Adding or modifying a Prisma schema model
- Writing or optimising Prisma queries in route handlers
- Handling Prisma errors (unique violations, not-found, etc.)
- Running transactions across multiple models
- Debugging connection or query issues

## How to Use This Skill

1. Identify the **affected schema file(s)** under `packages/db/prisma/schema/`.
2. Fill in `template.md` with the new model definition.
3. Write or update the `.prisma` file.
4. Run `scripts/validate.sh` to push the schema and regenerate the client.
5. Use the query patterns below in route handlers.

---

## Key Rules

### Package import
```typescript
import db from "@projectdeck/db";  // always this — never new PrismaClient()
```

### Schema location
Each domain has its own file: `packages/db/prisma/schema/<domain>.prisma`
The root config (`schema.prisma`) enables `prismaSchemaFolder` + `driverAdapters`.

### After any schema change
```bash
pnpm run db:generate   # regenerate Prisma client types
pnpm run db:push       # push to DB without a migration (dev)
# OR
pnpm run db:migrate    # create a named migration (production-ready)
```

### Singleton client (`packages/db/src/index.ts`)
```typescript
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
export default prisma;
```
The pool is managed by `pg` — do **not** call `$connect()` / `$disconnect()` manually in routes.

---

## Query Patterns

### Basic CRUD
```typescript
// List with optional filter
const items = await db.task.findMany({
  where: projectId ? { projectId } : {},
  orderBy: { createdAt: "desc" },
});

// Single record — handle null
const item = await db.project.findUnique({ where: { id } });
if (!item) return reply.status(404).send({ message: "Not found" });

// Create
const created = await db.task.create({ data: { ...parsed.data } });

// Update
const updated = await db.task.update({ where: { id }, data: { ...parsed.data } });

// Delete
await db.task.delete({ where: { id } });
```

### Relations — include vs select
```typescript
// include: full related object
const project = await db.project.findUnique({
  where: { id },
  include: {
    organization: { select: { name: true } },
    _count: { select: { tasks: true } },
  },
});

// select: only specific fields (faster, smaller payload)
const names = await db.organization.findMany({
  select: { id: true, name: true, slug: true },
});
```

### Transactions
```typescript
// Sequential (interactive) transaction — use when steps depend on each other
const result = await db.$transaction(async (tx) => {
  const org = await tx.organization.create({ data: orgData });
  const member = await tx.member.create({
    data: { organizationId: org.id, userId, role: "owner" },
  });
  return { org, member };
});

// Batch transaction — all-or-nothing for independent operations
await db.$transaction([
  db.task.update({ where: { id: t1 }, data: { status: "done" } }),
  db.task.update({ where: { id: t2 }, data: { status: "done" } }),
]);
```

### Unique constraint pre-check pattern
```typescript
const existing = await db.project.findUnique({ where: { slug } });
if (existing) return reply.status(409).send({ message: "Slug already taken" });
```

### Pagination (offset)
```typescript
const page  = Number(request.query.page)  || 1;
const limit = Number(request.query.limit) || 20;

const [items, total] = await db.$transaction([
  db.task.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
  db.task.count(),
]);
return { data: items, total, page, pages: Math.ceil(total / limit) };
```

---

## Error Handling

Catch Prisma errors in route handlers or a global error hook:

```typescript
import { Prisma } from "@prisma/client";

try {
  await db.task.create({ data });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return reply.status(409).send({ message: "Unique constraint violation", field: error.meta?.target });
    }
    if (error.code === "P2025") {
      return reply.status(404).send({ message: "Record not found" });
    }
  }
  throw error; // re-throw unknown errors
}
```

Common Prisma error codes:
| Code | Meaning | HTTP |
|------|---------|------|
| `P2002` | Unique constraint failed | 409 |
| `P2025` | Record not found (update/delete) | 404 |
| `P2003` | Foreign key constraint failed | 400 |
| `P2014` | Relation violation | 400 |

---

## Schema Conventions

| Convention | Example |
|-----------|---------|
| ID field | `id String @id @default(cuid())` |
| Timestamps | `createdAt DateTime @default(now())` / `updatedAt DateTime @updatedAt` |
| Table name | `@@map("snake_case_name")` |
| Unique slug | `slug String @unique` |
| Soft foreign keys | Use `onDelete: SetNull` for optional relations, `Cascade` for owned children |
| Nullable optional | `field String?` |

---

## Existing Models (quick reference)

| Model | File | Key unique fields |
|-------|------|-------------------|
| `Task` | `task.prisma` | `code` |
| `Project` | `project.prisma` | `slug` |
| `Organization` | `organization.prisma` | `slug`, `website` |
| `Member` | `organization.prisma` | `(organizationId, userId)` |
| `Note` | `note.prisma` | — (belongs to org/project/task) |
| `User`, `Session`, `Account`, `Verification` | `auth.prisma` | managed by Better-Auth |

---

## Common Issues

| Problem | Fix |
|---------|-----|
| `db.X` type not found after schema change | Run `pnpm run db:generate` |
| `P2002` on create | Pre-check unique field, return `409` |
| `P2025` on update/delete | Record was already deleted; return `404` |
| Schema changes not reflected in DB | Run `pnpm run db:push` (dev) or `db:migrate` (prod) |
| `driverAdapters` preview error | Ensure `previewFeatures = ["prismaSchemaFolder", "driverAdapters"]` in `schema.prisma` |
