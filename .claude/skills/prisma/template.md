# Schema Template — {{MODEL}}

## File
`packages/db/prisma/schema/{{domain}}.prisma`

---

## Schema Definition

```prisma
model {{MODEL}} {
  id        String   @id @default(cuid())

  // ── Required fields ───────────────────────────────────────────────────────
  // {{REQUIRED_FIELD}}  {{TYPE}}
  // e.g.  name          String

  // ── Optional fields ───────────────────────────────────────────────────────
  // {{OPTIONAL_FIELD}}  {{TYPE}}?
  // e.g.  description   String?

  // ── Unique fields ─────────────────────────────────────────────────────────
  // {{UNIQUE_FIELD}}    {{TYPE}}  @unique
  // e.g.  slug          String    @unique

  // ── Relations ─────────────────────────────────────────────────────────────
  // Parent (many-to-one): add FK + relation
  // {{parentId}}        String
  // {{parent}}          {{ParentModel}}  @relation(fields: [{{parentId}}], references: [id], onDelete: Cascade)
  //
  // Children (one-to-many): add back-relation only
  // {{children}}        {{ChildModel}}[]

  // ── Timestamps (always include) ───────────────────────────────────────────
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // ── Composite unique (if needed) ──────────────────────────────────────────
  // @@unique([{{field1}}, {{field2}}])

  @@map("{{table_name}}")  // snake_case table name
}
```

---

## After writing the schema

```bash
# Regenerate Prisma client types
pnpm run db:generate

# Push schema to the database (dev — no migration file)
pnpm run db:push

# OR create a named migration (production-ready)
pnpm run db:migrate
```

---

## Zod schema for route validation (reference)

```typescript
import { z } from "zod";

// Create
export const create{{MODEL}}Schema = z.object({
  // {{REQUIRED_FIELD}}: z.string(),
  // {{OPTIONAL_FIELD}}: z.string().optional(),
});

// Update (all fields optional)
export const update{{MODEL}}Schema = create{{MODEL}}Schema.partial();
```

---

## Placeholders to replace

| Placeholder | Example |
|------------|---------|
| `{{MODEL}}` | `Comment` |
| `{{domain}}` | `comment` |
| `{{table_name}}` | `comment` |
| `{{REQUIRED_FIELD}}` | `content` |
| `{{OPTIONAL_FIELD}}` | `summary` |
| `{{UNIQUE_FIELD}}` | `slug` |
| `{{TYPE}}` | `String`, `Int`, `Boolean`, `DateTime` |
| `{{parentId}}` | `projectId` |
| `{{parent}}` | `project` |
| `{{ParentModel}}` | `Project` |
| `{{children}}` | `replies` |
| `{{ChildModel}}` | `Reply` |

---

## onDelete reference

| Scenario | onDelete |
|----------|---------|
| Child is meaningless without parent | `Cascade` |
| Child can exist without parent | `SetNull` (field must be `String?`) |
| Prevent parent deletion if children exist | `Restrict` |
