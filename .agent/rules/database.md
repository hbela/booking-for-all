---
trigger: always_on
---


---

## 📁 File 3: `.agent/rules/database.md`

```markdown
# 💾 Database Standards (Prisma + PostgreSQL)

## Stack
- **Prisma** - ORM
- **PostgreSQL** - Database
- **Prisma MCP Server** - AI-assisted schema management

---

## 📁 Prisma Structure

packages/database/
├── prisma/
│ ├── schema.prisma # Main schema
│ ├── migrations/ # Auto-generated
│ └── seed.ts # Seed data
├── src/
│ └── index.ts # Client export
└── package.json


---

## 📝 Schema Design Patterns

### Base Model Template
```prisma
// ✅ CORRECT - Complete model with indexes
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

### User Model with Authentication

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String?   // For email/password auth
  emailVerified DateTime?
  image         String?
  
  // Relations
  posts         Post[]
  sessions      Session[]
  accounts      Account[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([email])
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token        String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([token])
  @@index([userId])
}

🔍 Query Patterns
Always Verify Ownership
typescript
// ✅ CORRECT - Ownership check
export async function updatePost(
  prisma: PrismaClient,
  postId: string,
  userId: string,
  data: UpdateData
) {
  // First verify ownership
  const post = await prisma.post.findFirst({
    where: { id: postId, authorId: userId },
  })
  
  if (!post) {
    throw new Error('Post not found or unauthorized')
  }
  
  // Then update
  return await prisma.post.update({
    where: { id: postId },
    data,
  })
}

// ❌ WRONG - Direct update without check
export async function updatePost(
  prisma: PrismaClient,
  postId: string,
  data: UpdateData
) {
  return await prisma.post.update({
    where: { id: postId },
    data,
  })
}
Prevent N+1 Queries
typescript
// ✅ CORRECT - Use include for relations
const posts = await prisma.post.findMany({
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

// ❌ WRONG - N+1 queries
const posts = await prisma.post.findMany()
for (const post of posts) {
  const author = await prisma.user.findUnique({
    where: { id: post.authorId },
  })
}
Pagination Pattern
typescript
// ✅ CORRECT - Cursor-based pagination
export async function getPaginatedPosts(
  prisma: PrismaClient,
  cursor?: string,
  limit: number = 10
) {
  const posts = await prisma.post.findMany({
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { author: true },
  })
  
  let nextCursor: string | undefined
  if (posts.length > limit) {
    const nextItem = posts.pop()
    nextCursor = nextItem!.id
  }
  
  return { posts, nextCursor }
}
🔄 Transactions
typescript
// ✅ CORRECT - Use transactions for multiple operations
export async function createPostWithComments(
  prisma: PrismaClient,
  postData: CreatePostData,
  comments: CreateCommentData[]
) {
  return await prisma.$transaction(async (tx) => {
    // Create post
    const post = await tx.post.create({
      data: postData,
    })
    
    // Create comments
    const createdComments = await Promise.all(
      comments.map(comment =>
        tx.comment.create({
          data: {
            ...comment,
            postId: post.id,
          },
        })
      )
    )
    
    return { post, comments: createdComments }
  })
}
🧪 Seed Data
typescript
// ✅ CORRECT - Seed script
// packages/database/prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clean existing data
  await prisma.comment.deleteMany()
  await prisma.post.deleteMany()
  await prisma.user.deleteMany()
  
  // Create users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin',
        password: '$2a$10$...', // hashed password
      },
    }),
    prisma.user.create({
      data: {
        email: 'user@example.com',
        name: 'Regular User',
        password: '$2a$10$...',
      },
    }),
  ])
  
  // Create posts
  await prisma.post.create({
    data: {
      title: 'First Post',
      content: 'This is the first post content',
      authorId: users[0].id,
      published: true,
    },
  })
  
  console.log('Database seeded!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
🛠️ Migration Workflow
bash
# ✅ CORRECT - Migration workflow
pnpm db:generate          # Generate client after schema changes
pnpm db:migrate           # Create migration from schema changes
pnpm db:studio            # Open Prisma Studio to verify

# ❌ WRONG - Don't edit migrations directly
# Always use `prisma migrate dev` to generate migrations
🔌 Prisma MCP Server (for AI Assistance)
Add to your MCP config for AI-assisted database work:

json
{
  "mcpServers": {
    "prisma": {
      "command": "npx",
      "args": ["prisma", "mcp"]
    }
  }
}
This enables:

Brainstorm data models naturally

Get schema suggestions

Run migrations via natural language

📊 Performance Guidelines
typescript
// ✅ CORRECT - Use indexes on frequently queried fields
model Post {
  // ...
  @@index([authorId])
  @@index([published])
  @@index([createdAt])
}

// ✅ CORRECT - Use select to limit fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // Exclude password
  },
})

// ❌ WRONG - Selecting all fields when not needed
const users = await prisma.user.findMany()
🚫 Database Prohibitions
❌ Don't Do	✅ Do Instead
Raw SQL queries	Use Prisma
Skip ownership checks	Always verify with findFirst
N+1 queries	Use include or select
Missing indexes	Add @@index for common filters
Direct migration edits	Use prisma migrate dev
Large unbounded queries	Add take/limit
Hardcoded IDs	Use cuid() or uuid()
Cascade deletes without thought	Add onDelete: Cascade explicitly

# Generate client after schema change
pnpm db:generate

# Create migration
pnpm db:migrate --name describe_change

# Open studio
pnpm db:studio

# Reset database (dev only)
pnpm prisma migrate reset

# Seed database
pnpm prisma db seed

