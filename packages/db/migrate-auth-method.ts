import { PrismaClient } from './prisma/generated/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../apps/server/.env') });

// Use DIRECT_URL for migrations (has full permissions)
const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!directUrl) {
  throw new Error('DIRECT_URL or DATABASE_URL must be set');
}

console.log(`🔗 Using database URL: ${directUrl.substring(0, 50)}...`);

// Create Prisma client with DIRECT_URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl,
    },
  },
  log: ['error', 'warn'],
});

/**
 * Migration script to add authMethod column to Member table
 * Run with: npx tsx packages/db/migrate-auth-method.ts
 */
async function migrateAuthMethod() {
  console.log('🔄 Starting authMethod migration...');

  try {
    // Step 1: Add authMethod column as nullable first
    console.log('📝 Step 1: Adding authMethod column...');
    await prisma.$executeRaw`
      ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "authMethod" TEXT;
    `;
    console.log('✅ Step 1 complete: authMethod column added');

    // Step 2: Backfill authMethod for existing members
    console.log('📝 Step 2: Backfilling authMethod for existing members...');
    await prisma.$executeRaw`
      UPDATE "member" m
      SET "authMethod" = (
        SELECT 
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM "account" a 
              WHERE a."userId" = m."userId" 
              AND a."providerId" = 'credential'
            ) THEN 'credential'
            WHEN EXISTS (
              SELECT 1 FROM "account" a 
              WHERE a."userId" = m."userId" 
              AND a."providerId" = 'google'
            ) THEN 'google'
            ELSE 'credential'
          END
      )
      WHERE "authMethod" IS NULL;
    `;
    console.log('✅ Step 2 complete: authMethod backfilled');

    // Step 3: Make authMethod NOT NULL
    console.log('📝 Step 3: Making authMethod NOT NULL...');
    await prisma.$executeRaw`
      ALTER TABLE "member" ALTER COLUMN "authMethod" SET NOT NULL;
    `;
    console.log('✅ Step 3 complete: authMethod is now required');

    // Verification: Count members by authMethod
    console.log('\n📊 Verification - Members by auth method:');
    const result = await prisma.$queryRaw<Array<{ authMethod: string; count: bigint }>>`
      SELECT "authMethod", COUNT(*) as count
      FROM "member"
      GROUP BY "authMethod"
      ORDER BY "authMethod";
    `;
    
    result.forEach(row => {
      console.log(`  - ${row.authMethod}: ${row.count} members`);
    });

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateAuthMethod()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration error:', error);
    process.exit(1);
  });

