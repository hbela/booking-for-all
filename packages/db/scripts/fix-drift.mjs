#!/usr/bin/env node

/**
 * Fix database drift by marking migrations as applied
 * 
 * Use this when:
 * - Production database has schema changes but migration history is missing
 * - You see "Drift detected" errors
 * 
 * Usage:
 *   node scripts/fix-drift.mjs MIGRATION_NAME
 * 
 * Example:
 *   node scripts/fix-drift.mjs 20251122153851_add_organization_timezone
 * 
 * Environment variables required:
 *   - DIRECT_URL: Production database direct connection URL
 *   - DATABASE_URL: Production database URL (can be same as DIRECT_URL)
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get migration name from command line
const migrationName = process.argv[2];

if (!migrationName) {
  console.error('❌ ERROR: Migration name is required');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/fix-drift.mjs MIGRATION_NAME');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/fix-drift.mjs 20251122153851_add_organization_timezone');
  console.error('');
  console.error('This will mark the migration as applied without running it.');
  console.error('Use this when the database already has the changes but migration history is missing.');
  process.exit(1);
}

// Load environment variables
const envPath = resolve(__dirname, '../../../apps/server/.env');
dotenv.config({ path: envPath });

// Check required environment variables
if (!process.env.DIRECT_URL) {
  console.error('❌ ERROR: DIRECT_URL environment variable is not set');
  console.error('   Please set DIRECT_URL with your production direct PostgreSQL connection string');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
  console.log('⚠️  DATABASE_URL not set, using DIRECT_URL');
}

const schemaPath = resolve(__dirname, '../prisma/schema/schema.prisma');

console.log('🔧 Fixing Database Drift');
console.log('========================');
console.log('');
console.log(`Migration: ${migrationName}`);
console.log('');

console.log('⚠️  WARNING: This will mark the migration as applied without running it.');
console.log('   Only use this if the database already has the schema changes.');
console.log('');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
console.log('');

// Wait 5 seconds
await new Promise(resolve => setTimeout(resolve, 5000));

console.log('📝 Marking migration as applied...');
console.log('');

try {
  execSync(
    `npx prisma migrate resolve --applied ${migrationName} --schema="${schemaPath}"`,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
        DIRECT_URL: process.env.DIRECT_URL,
      },
      cwd: resolve(__dirname, '..'),
    }
  );
  
  console.log('');
  console.log('✅ Migration marked as applied!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Verify migration status: pnpm db:migrate:status');
  console.log('  2. If there are more migrations, deploy them: pnpm db:sync:production');
  console.log('');
} catch (error) {
  console.error('');
  console.error('❌ Failed to mark migration as applied');
  console.error('');
  console.error('Common issues:');
  console.error('  1. Migration name is incorrect - check the exact name in prisma/schema/migrations/');
  console.error('  2. Migration already applied - check status with: pnpm db:migrate:status');
  console.error('  3. Connection error - check DIRECT_URL is correct');
  process.exit(1);
}

