# Route Template — {{DOMAIN}}

## File
`apps/server/src/routes/{{domain}}.ts`

## Registration (add to `apps/server/src/index.ts`)
```typescript
import { {{domain}}Routes } from "./routes/{{domain}}";
fastify.register({{domain}}Routes, { prefix: "/api/{{domain}}" });
```

Also add the Swagger tag to the `tags` array in `index.ts` if this is a new domain:
```typescript
{ name: "{{domain}}", description: "{{DOMAIN}} management" },
```

---

## Route Module

```typescript
import db from "@projectdeck/db";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

export const {{domain}}Routes: FastifyPluginAsync = async (fastify) => {

  // ── GET / ────────────────────────────────────────────────────────────────
  fastify.get("/", {
    schema: {
      tags: ["{{domain}}"],
      description: "List all {{domain}}s",
      // Add query params here if filterable, e.g. by parentId
      response: {
        200: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id:        { type: "string" },
              // {{FIELDS}}
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Optional: parse query params with Zod
    // const q = z.object({ parentId: z.string().optional() }).safeParse(request.query);
    // if (!q.success) return reply.status(400).send(q.error);

    const items = await db.{{model}}.findMany({
      orderBy: { createdAt: "desc" },
    });
    return items;
  });

  // ── GET /:id ─────────────────────────────────────────────────────────────
  fastify.get("/:id", {
    schema: {
      tags: ["{{domain}}"],
      description: "Get a single {{domain}} by ID",
    },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const item = await db.{{model}}.findUnique({ where: { id } });
    if (!item) return reply.status(404).send({ message: "{{DOMAIN}} not found" });

    return item;
  });

  // ── POST / ───────────────────────────────────────────────────────────────
  fastify.post("/", {
    schema: {
      tags: ["{{domain}}"],
      description: "Create a new {{domain}}",
      body: {
        type: "object",
        required: [/* "{{REQUIRED_FIELDS}}" */],
        properties: {
          // {{FIELDS}}
        },
      },
    },
  }, async (request, reply) => {
    const schema = z.object({
      // {{ZOD_FIELDS}}
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const item = await db.{{model}}.create({ data: parsed.data });
    return item;
  });

  // ── PATCH /:id ───────────────────────────────────────────────────────────
  fastify.patch("/:id", {
    schema: {
      tags: ["{{domain}}"],
      description: "Update a {{domain}}",
    },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const schema = z.object({
      // {{ZOD_FIELDS_OPTIONAL}}
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const item = await db.{{model}}.update({ where: { id }, data: parsed.data });
    return item;
  });

  // ── DELETE /:id ──────────────────────────────────────────────────────────
  fastify.delete("/:id", {
    schema: {
      tags: ["{{domain}}"],
      description: "Delete a {{domain}}",
    },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await db.{{model}}.delete({ where: { id } });
    return { success: true };
  });

};
```

---

## Placeholders to replace

| Placeholder | Example |
|------------|---------|
| `{{domain}}` | `comments` |
| `{{DOMAIN}}` | `Comment` |
| `{{model}}` | `comment` (Prisma model name, camelCase) |
| `{{FIELDS}}` | `content: { type: "string" }, authorId: { type: "string" }` |
| `{{ZOD_FIELDS}}` | `content: z.string(), authorId: z.string()` |
| `{{ZOD_FIELDS_OPTIONAL}}` | `content: z.string().optional()` |
| `{{REQUIRED_FIELDS}}` | `"content", "authorId"` |
