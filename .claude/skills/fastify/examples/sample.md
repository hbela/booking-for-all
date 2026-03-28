# Example — Tasks Route

This is the real `apps/server/src/routes/tasks.ts` as a reference for expected output quality.

## Registration in `index.ts`
```typescript
import { tasksRoutes } from "./routes/tasks";
fastify.register(tasksRoutes, { prefix: "/api/tasks" });
```

Swagger tag already present in `index.ts`:
```typescript
{ name: "tasks", description: "Task management" },
```

---

## Completed Route File

```typescript
import db from "@projectdeck/db";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

export const tasksRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET / ────────────────────────────────────────────────────────────────
  fastify.get("/", {
    schema: {
      tags: ["tasks"],
      description: "Get all tasks, optionally filtered by project",
      querystring: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Filter tasks by project ID" },
        },
      },
      response: {
        200: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id:              { type: "string" },
              title:           { type: "string" },
              status:          { type: "string" },
              priority:        { type: "string" },
              label:           { type: "string", nullable: true },
              code:            { type: "string" },
              projectId:       { type: "string", nullable: true },
              startDate:       { type: "string", format: "date-time", nullable: true },
              expectedEndDate: { type: "string", format: "date-time", nullable: true },
              endDate:         { type: "string", format: "date-time", nullable: true },
              createdAt:       { type: "string", format: "date-time" },
              updatedAt:       { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const querySchema = z.object({
      projectId: z.string().optional(),
    });

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const where = parsed.data.projectId ? { projectId: parsed.data.projectId } : {};

    const tasks = await db.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return tasks;
  });

  // ── POST / ───────────────────────────────────────────────────────────────
  fastify.post("/", {
    schema: {
      tags: ["tasks"],
      description: "Create a new task",
      body: {
        type: "object",
        required: ["title", "status", "priority"],
        properties: {
          title:           { type: "string" },
          status:          { type: "string" },
          priority:        { type: "string" },
          label:           { type: "string", nullable: true },
          code:            { type: "string" },
          projectId:       { type: "string", nullable: true },
          startDate:       { type: "string", format: "date-time", nullable: true },
          expectedEndDate: { type: "string", format: "date-time", nullable: true },
          endDate:         { type: "string", format: "date-time", nullable: true },
        },
      },
    },
  }, async (request, reply) => {
    const schema = z.object({
      title:           z.string(),
      status:          z.string(),
      label:           z.string().optional().nullable(),
      priority:        z.string(),
      code:            z.string().optional(),
      startDate:       z.string().nullable().optional(),
      expectedEndDate: z.string().nullable().optional(),
      endDate:         z.string().nullable().optional(),
      projectId:       z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const code = parsed.data.code || `TASK-${Math.floor(Math.random() * 10000)}`;

    const task = await db.task.create({
      data: {
        title:           parsed.data.title,
        status:          parsed.data.status,
        label:           parsed.data.label,
        priority:        parsed.data.priority,
        code,
        startDate:       parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        expectedEndDate: parsed.data.expectedEndDate ? new Date(parsed.data.expectedEndDate) : null,
        endDate:         parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        projectId:       parsed.data.projectId,
      },
    });
    return task;
  });

  // ── PATCH /:id ───────────────────────────────────────────────────────────
  fastify.patch("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const bodySchema = z.object({
      status:          z.string().optional(),
      priority:        z.string().optional(),
      label:           z.string().optional(),
      title:           z.string().optional(),
      startDate:       z.string().nullable().optional(),
      expectedEndDate: z.string().nullable().optional(),
      endDate:         z.string().nullable().optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const task = await db.task.update({
      where: { id },
      data: {
        ...parsed.data,
        startDate:       parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        expectedEndDate: parsed.data.expectedEndDate ? new Date(parsed.data.expectedEndDate) : undefined,
        endDate:         parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      },
    });
    return task;
  });

  // ── DELETE /:id ──────────────────────────────────────────────────────────
  fastify.delete("/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await db.task.delete({ where: { id } });
    return { success: true };
  });

};
```

---

## What makes this a good route

- Query params validated with Zod `safeParse` before use
- `schema` block on GET/POST for Swagger visibility
- Date fields converted from ISO strings to `Date` objects before Prisma insert/update
- Auto-generated `code` fallback if client doesn't supply one
- Consistent `{ success: true }` shape for DELETE responses
