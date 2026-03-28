# Add Prisma Model

Add a new model to the Prisma schema:

1. Add model to `packages/db/prisma/schema.prisma`
2. Include proper relations and indexes
3. Add userId ownership if user-owned
4. Run `pnpm db:generate`
5. Create migration with `pnpm db:migrate --name add_model`
6. Update seed script if needed

## Model Template
```prisma
model $ARGUMENTS {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Add your fields here
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
}