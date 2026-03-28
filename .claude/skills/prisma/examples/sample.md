# Example — Note Model

The `Note` model is a good reference because it demonstrates:
- Optional polymorphic relations (belongs to org, project, or task)
- `Cascade` delete from all three parents
- Minimal required fields

---

## Schema (`packages/db/prisma/schema/note.prisma`)

```prisma
model Note {
  id      String @id @default(cuid())
  title   String
  content String

  // Polymorphic parent — at most one will be set
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  projectId String?
  project   Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)

  taskId String?
  task   Task?   @relation(fields: [taskId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("note")
}
```

---

## Route queries using this model (`apps/server/src/routes/notes.ts`)

### List notes filtered by parent
```typescript
import db from "@projectdeck/db";
import { z } from "zod";

const querySchema = z.object({
  organizationId: z.string().optional(),
  projectId:      z.string().optional(),
  taskId:         z.string().optional(),
});

const parsed = querySchema.safeParse(request.query);
if (!parsed.success) return reply.status(400).send(parsed.error);

const notes = await db.note.findMany({
  where: {
    ...(parsed.data.organizationId && { organizationId: parsed.data.organizationId }),
    ...(parsed.data.projectId      && { projectId:      parsed.data.projectId }),
    ...(parsed.data.taskId         && { taskId:         parsed.data.taskId }),
  },
  orderBy: { createdAt: "desc" },
});
```

### Create a note
```typescript
const schema = z.object({
  title:          z.string().min(1),
  content:        z.string(),
  organizationId: z.string().optional(),
  projectId:      z.string().optional(),
  taskId:         z.string().optional(),
});

const parsed = schema.safeParse(request.body);
if (!parsed.success) return reply.status(400).send(parsed.error);

const note = await db.note.create({ data: parsed.data });
return note;
```

### Update a note
```typescript
const { id } = z.object({ id: z.string() }).parse(request.params);

const schema = z.object({
  title:   z.string().optional(),
  content: z.string().optional(),
});

const parsed = schema.safeParse(request.body);
if (!parsed.success) return reply.status(400).send(parsed.error);

const note = await db.note.update({ where: { id }, data: parsed.data });
return note;
```

### Delete a note
```typescript
const { id } = z.object({ id: z.string() }).parse(request.params);
await db.note.delete({ where: { id } });
return { success: true };
```

---

## Task model — unique constraint example

```prisma
model Task {
  id              String    @id @default(cuid())
  code            String    @unique   // enforced unique — TASK-1234
  title           String
  status          String              // todo | in-progress | done | canceled | backlog
  label           String?             // bug | feature | documentation
  priority        String              // low | medium | high
  startDate       DateTime?
  expectedEndDate DateTime?
  endDate         DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  projectId String?
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  notes     Note[]

  @@map("task")
}
```

**Key pattern:** `onDelete: SetNull` on `projectId` — a task survives project deletion (field is `String?`).
Compare with `Note → Organization` which uses `Cascade` — notes are owned by their parent.

---

## What makes these good schemas

- `@@map("snake_case")` keeps DB table names consistent regardless of model name casing
- `@default(cuid())` for IDs — URL-safe, sortable, no collision risk
- `updatedAt @updatedAt` — Prisma sets this automatically on every update
- Nullable FK (`String?`) paired with `SetNull` for weak ownership
- Non-nullable FK (`String`) paired with `Cascade` for strong ownership
