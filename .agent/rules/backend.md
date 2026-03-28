---
trigger: always_on
---

## 📁 File 2: `.agent/rules/backend.md`

```markdown
# 🚀 Backend Stack Standards (apps/server)

## Stack
- **Fastify** - Web framework
- **Zod** - Validation
- **BetterAuth** - Authentication
- **Prisma** - Database access (via shared package)

---

## 📁 File Structure
apps/server/
├── src/
│ ├── index.ts # Fastify app entry
│ ├── plugins/ # Fastify plugins
│ │ ├── prisma.ts # Prisma plugin
│ │ ├── auth.ts # BetterAuth plugin
│ │ └── cors.ts # CORS config
│ ├── routes/ # API routes
│ │ └── posts.ts # Posts CRUD
│ ├── services/ # Business logic
│ │ └── post.service.ts
│ └── types/ # Request/Response types

text

---
## 🔌 Fastify Plugins

### Prisma Plugin
```typescript
// ✅ CORRECT - Plugin pattern
// src/plugins/prisma.ts
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@repo/database'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

export default async function prismaPlugin(fastify: FastifyInstance) {
  const prisma = new PrismaClient()
  
  await prisma.$connect()
  fastify.decorate('prisma', prisma)
  
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
}
Authentication Plugin
typescript
// ✅ CORRECT - BetterAuth integration
// src/plugins/auth.ts
import { FastifyInstance } from 'fastify'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'

declare module 'fastify' {
  interface FastifyInstance {
    auth: ReturnType<typeof betterAuth>
  }
}

export default async function authPlugin(fastify: FastifyInstance) {
  const auth = betterAuth({
    database: prismaAdapter(fastify.prisma),
    emailAndPassword: { enabled: true },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    },
  })
  
  fastify.decorate('auth', auth)
  fastify.decorate('authenticate', async (request: any, reply: any) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    if (!session) {
      reply.status(401).send({ error: 'Unauthorized' })
      return
    }
    request.user = session.user
  })
}
🛣️ Route Patterns
Route with Validation
typescript
// ✅ CORRECT - Full validation with Zod
// src/routes/posts.ts
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createPost, getPosts } from '../services/post.service'

const createPostSchema = {
  body: z.object({
    title: z.string().min(3).max(100),
    content: z.string().min(10).max(5000),
  }),
  response: {
    201: z.object({
      id: z.string(),
      title: z.string(),
      content: z.string().nullable(),
      createdAt: z.date(),
    }),
    400: z.object({ error: z.string() }),
    401: z.object({ error: z.string() }),
  },
}

export default async function postRoutes(fastify: FastifyInstance) {
  // Create post
  fastify.post('/posts', {
    schema: createPostSchema,
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { title, content } = request.body as z.infer<typeof createPostSchema.body>
    const userId = request.user.id
    
    const post = await createPost({ title, content, authorId: userId })
    return reply.status(201).send(post)
  })
  
  // Get posts with pagination
  fastify.get('/posts', {
    schema: {
      querystring: z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(10),
      }),
    },
  }, async (request, reply) => {
    const { page, limit } = request.query
    const posts = await getPosts({ page, limit })
    return { posts, page, limit }
  })
}
💼 Service Layer
typescript
// ✅ CORRECT - Separate business logic
// src/services/post.service.ts
import { FastifyInstance } from 'fastify'

export interface CreatePostInput {
  title: string
  content: string
  authorId: string
}

export async function createPost(
  fastify: FastifyInstance,
  data: CreatePostInput
) {
  const { title, content, authorId } = data
  
  // Business logic here
  if (title.length < 3) {
    throw new Error('Title too short')
  }
  
  return await fastify.prisma.post.create({
    data: {
      title,
      content,
      author: { connect: { id: authorId } },
    },
    include: { author: true },
  })
}

export async function getPosts(
  fastify: FastifyInstance,
  { page = 1, limit = 10 }
) {
  return await fastify.prisma.post.findMany({
    where: { published: true },
    skip: (page - 1) * limit,
    take: limit,
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
}
⚠️ Error Handling
typescript
// ✅ CORRECT - Global error handler
// src/index.ts
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error)
  
  // Handle Zod validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      details: error.validation,
    })
  }
  
  // Handle known errors
  if (error.message === 'Not found') {
    return reply.status(404).send({ error: error.message })
  }
  
  // Default error
  reply.status(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
  })
})
🔐 Authentication Middleware
typescript
// ✅ CORRECT - Protect routes
fastify.get('/profile', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const user = await fastify.prisma.user.findUnique({
    where: { id: request.user.id },
    select: { id: true, email: true, name: true },
  })
  return user
})

// ❌ WRONG - No auth check
// fastify.get('/profile', async (request, reply) => {
//   // Can access anyone's profile
// })
📡 WebSocket Support (if needed)
typescript
// ✅ CORRECT - WebSocket with Fastify
import websocket from '@fastify/websocket'

await fastify.register(websocket)

fastify.get('/ws', { websocket: true }, (connection, req) => {
  connection.socket.on('message', async (message) => {
    const data = JSON.parse(message.toString())
    // Handle message
    connection.socket.send(JSON.stringify({ type: 'pong' }))
  })
})
🚫 Backend Prohibitions
❌ Don't Use	✅ Use Instead
Express	Fastify
any type	Zod schemas with proper types
Direct SQL	Prisma
Manual validation	Zod with Fastify schema
console.log	fastify.log (pino)
Hardcoded secrets	Environment variables
No auth checks	preHandler: [fastify.authenticate]
CORS errors	@fastify/cors plugin
Sync operations	Always use async/await
