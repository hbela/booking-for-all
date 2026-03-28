---
trigger: always_on
---

# 📋 Creating a Comprehensive Stack Standards Rule for TanStack + Fastify TurboRepo

Let me create a comprehensive `stack-standards.md` rule file specifically for your TanStack + Fastify stack. This rule will ensure consistency across your entire TurboRepo.

## 📁 File Location

Create this file at:
```
.agent/rules/stack-standards.md
```

This file will be automatically loaded by Agent Kit and Claude Code, ensuring every AI assistant follows your stack conventions.

---

## 📄 The Complete Stack Standards Rule

```markdown
# 🏗️ TurboRepo Stack Standards

## Project Structure
This is a **TurboRepo monorepo** with the following structure:
```
apps/
├── web/          # React frontend (TanStack Router + Query + Form)
├── server/       # Fastify backend (REST API + WebSocket)
packages/
├── database/     # Prisma client + schema
├── ui/           # shadcn/ui components
├── types/        # Shared TypeScript types
├── utils/        # Shared utilities
└── theme/        # Tailwind v4 theme configuration
```

---

## 🎨 Frontend Stack (apps/web)

### TanStack Router
```typescript
// ✅ CORRECT - Use file-based routing with TanStack Router
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: async ({ context: { queryClient } }) => {
    return await queryClient.ensureQueryData(postsQueryOptions)
  },
  pendingComponent: LoadingSpinner,
  errorComponent: ErrorBoundary,
})

// ❌ WRONG - Don't use Next.js patterns in TanStack Router
// export default function Page() // Next.js pattern
// getServerSideProps() // Next.js specific
```

### TanStack Query
```typescript
// ✅ CORRECT - Centralized query options
// src/lib/queries/posts.ts
import { queryOptions } from '@tanstack/react-query'

export const postsQueryOptions = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetch('/api/posts').then(res => res.json()),
  staleTime: 1000 * 60 * 5, // 5 minutes
  gcTime: 1000 * 60 * 10, // 10 minutes
})

// ✅ CORRECT - Use in components with useSuspenseQuery
function PostsList() {
  const { data } = useSuspenseQuery(postsQueryOptions)
  return <Posts data={data} />
}

// ❌ WRONG - Don't fetch directly in components
function PostsList() {
  const [posts, setPosts] = useState([]) // NO
  useEffect(() => { fetch('/api/posts') }, []) // NO
}
```

### TanStack Form
```typescript
// ✅ CORRECT - Use TanStack Form with validation
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'
import { z } from 'zod'

const postSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
})

function CreatePostForm() {
  const form = useForm({
    defaultValues: { title: '', content: '' },
    validatorAdapter: zodValidator(),
    validators: { onChange: postSchema },
    onSubmit: async ({ value }) => {
      await createPostMutation.mutateAsync(value)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <form.Field
        name="title"
        children={(field) => (
          <>
            <input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors && (
              <p className="text-destructive text-sm">{field.state.meta.errors.join(', ')}</p>
            )}
          </>
        )}
      />
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <button type="submit" disabled={!canSubmit}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        )}
      />
    </form>
  )
}

// ❌ WRONG - Don't use react-hook-form with TanStack stack
// import { useForm } from 'react-hook-form'
```

---

## 🚀 Backend Stack (apps/server)

### Fastify with TypeScript
```typescript
// ✅ CORRECT - Plugin-based architecture
// apps/server/src/index.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'

const fastify = Fastify({
  logger: process.env.NODE_ENV === 'development',
  ajv: {
    customOptions: { strict: 'log' },
  },
})

// Register plugins
await fastify.register(cors, {
  origin: process.env.FRONTEND_URL,
  credentials: true,
})
await fastify.register(helmet)
await fastify.register(import('./plugins/prisma'))
await fastify.register(import('./plugins/auth'))
await fastify.register(import('./routes/posts'))

// Error handling
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error)
  reply.status(error.statusCode || 500).send({
    error: error.name,
    message: error.message,
    statusCode: error.statusCode || 500,
  })
})

await fastify.listen({ port: 3001, host: '0.0.0.0' })
```

### Route with Validation
```typescript
// ✅ CORRECT - Zod validation for all routes
import { FastifyInstance } from 'fastify'
import { z } from 'zod'

const createPostSchema = {
  body: z.object({
    title: z.string().min(3).max(100),
    content: z.string().min(10),
  }),
  response: {
    201: z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      createdAt: z.date(),
    }),
    400: z.object({ error: z.string() }),
    401: z.object({ error: z.string() }),
  },
}

export default async function (fastify: FastifyInstance) {
  fastify.post('/posts', {
    schema: createPostSchema,
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { title, content } = request.body
    const userId = request.user.id

    const post = await fastify.prisma.post.create({
      data: { title, content, authorId: userId },
    })

    return reply.status(201).send(post)
  })
}
```

---

## 💾 Database Standards (Prisma + PostgreSQL)

### Schema Design
```prisma
// ✅ CORRECT - Always include indexes and relations
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId])
  @@index([published])
  @@index([createdAt])
}

// ❌ WRONG - Missing indexes for common queries
model Post {
  id        String   @id @default(cuid())
  authorId  String   // No @index
  createdAt DateTime // No @index
}
```

### Query Patterns with Ownership
```typescript
// ✅ CORRECT - Always verify ownership
export async function updatePost(postId: string, data: UpdateData, userId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, authorId: userId },
  })

  if (!post) {
    throw new Error('Post not found or unauthorized')
  }

  return await prisma.post.update({
    where: { id: postId },
    data,
  })
}

// ❌ WRONG - No ownership check
export async function updatePost(postId: string, data: UpdateData) {
  return await prisma.post.update({
    where: { id: postId }, // Could update someone else's post
    data,
  })
}
```

### Prevent N+1 Queries
```typescript
// ✅ CORRECT - Use include/select
const posts = await prisma.post.findMany({
  where: { published: true },
  include: {
    author: {
      select: { id: true, name: true, email: true },
    },
    comments: {
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { author: true },
    },
  },
})

// ❌ WRONG - N+1 in loop
const posts = await prisma.post.findMany()
for (const post of posts) {
  const author = await prisma.user.findUnique({ // N+1
    where: { id: post.authorId },
  })
}
```

---

## 🎨 UI Standards (shadcn/ui + Tailwind v4)

### Component Structure
```tsx
// ✅ CORRECT - shadcn/ui pattern with Tailwind v4
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'ghost'
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border bg-card text-card-foreground shadow-sm',
          variant === 'ghost' && 'border-transparent bg-transparent shadow-none',
          className
        )}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

// ❌ WRONG - Inline styles or custom CSS
// <div style={{ backgroundColor: 'blue' }}>
```

### Tailwind v4 Usage
```tsx
// ✅ CORRECT - Theme variables for colors
<div className="bg-primary text-primary-foreground hover:bg-primary/90">
  {/* Uses CSS variables from theme */}
</div>

// ✅ CORRECT - Dark mode with variant
<div className="bg-white dark:bg-gray-900">
  {/* Works with dark class on html */}
</div>

// ❌ WRONG - Hardcoded colors
<div className="bg-blue-500 text-white">
  {/* Use theme variables instead */}
</div>
```

---

## 🔄 Shared Types & Utilities

### Shared Types Package
```typescript
// packages/types/src/post.ts
export interface Post {
  id: string
  title: string
  content: string | null
  published: boolean
  authorId: string
  author: User
  createdAt: Date
  updatedAt: Date
}

export type CreatePostInput = Pick<Post, 'title' | 'content'>
export type UpdatePostInput = Partial<CreatePostInput>

// ✅ CORRECT - Import from shared package
// In web: import type { Post } from '@repo/types'
// In server: import type { Post } from '@repo/types'
```

### Shared Utilities
```typescript
// packages/utils/src/date.ts
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

// ✅ CORRECT - Use shared utils across apps
// import { formatDate } from '@repo/utils'
```

---

## 🔐 Authentication (BetterAuth)

```typescript
// ✅ CORRECT - BetterAuth with Prisma adapter
// apps/server/src/plugins/auth.ts
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'

export default async function (fastify: FastifyInstance) {
  const auth = betterAuth({
    database: prismaAdapter(fastify.prisma),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
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
```

---

## 🧪 Testing Standards

### Unit Tests (Vitest)
```typescript
// ✅ CORRECT - Test with Vitest
import { describe, it, expect, vi } from 'vitest'
import { createPost } from './post.service'

describe('createPost', () => {
  it('should create a post with valid data', async () => {
    const result = await createPost({
      title: 'Test Post',
      content: 'Content',
      authorId: 'user-1',
    })

    expect(result).toMatchObject({
      title: 'Test Post',
      authorId: 'user-1',
    })
  })

  it('should throw if title is too short', async () => {
    await expect(createPost({
      title: 'Hi',
      content: 'Content',
      authorId: 'user-1',
    })).rejects.toThrow('Title must be at least 3 characters')
  })
})
```

