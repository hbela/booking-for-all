#!/usr/bin/env node

/**
 * Sync production database with latest migrations from development
 * 
 * This script:
 * 1. Checks migration status
 * 2. Deploys any pending migrations to production
 * 3. Verifies the deployment
 * 
 * Usage:
 *   node scripts/sync-production.mjs
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

// Load environment variables
const envPath = resolve(__dirname, '../../../apps/server/.env');
dotenv.config({ path: envPath });

// Check required environment variables
if (!process.env.DIRECT_URL) {
  console.error('❌ ERROR: DIRECT_URL environment variable is not set');
  console.error('   Please set DIRECT_URL with your production direct PostgreSQL connection string');
  console.error('');
  console.error('   Example:');
  console.error('   $env:DIRECT_URL="postgresql://user:password@host:5432/database"');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  // Use DIRECT_URL as fallback for DATABASE_URL
  process.env.DATABASE_URL = process.env.DIRECT_URL;
  console.log('⚠️  DATABASE_URL not set, using DIRECT_URL');
}

const schemaPath = resolve(__dirname, '../prisma/schema/schema.prisma');

console.log('🔄 Syncing Production Database');
console.log('================================');
console.log('');

// Step 1: Check current migration status
console.log('📊 Step 1: Checking migration status...');
console.log('');

try {
  execSync(
    `npx prisma migrate status --schema="${schemaPath}"`,
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
} catch (error) {
  console.error('');
  console.error('⚠️  Migration status check completed with warnings');
  console.error('   This is normal if there are pending migrations or drift');
  console.error('');
}

console.log('');
console.log('📦 Step 2: Deploying pending migrations...');
console.log('');

// Step 2: Deploy migrations
try {
  execSync(
    `npx prisma migrate deploy --schema="${schemaPath}"`,
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
  console.log('✅ Migrations deployed successfully!');
} catch (error) {
  console.error('');
  console.error('❌ Failed to deploy migrations');
  console.error('');
  console.error('Common issues:');
  console.error('  1. Drift detected - database schema doesn\'t match migration history');
  console.error('     Solution: See MIGRATION_WORKFLOW.md for how to resolve drift');
  console.error('  2. Migration already applied - database already has the changes');
  console.error('     Solution: Use "npx prisma migrate resolve --applied MIGRATION_NAME"');
  console.error('  3. Connection error - check DIRECT_URL is correct');
  process.exit(1);
}

console.log('');
console.log('✅ Step 3: Verifying deployment...');
console.log('');

// Step 3: Verify deployment
try {
  execSync(
    `npx prisma migrate status --schema="${schemaPath}"`,
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
  console.log('✅ Production database is now in sync!');
  console.log('');
} catch (error) {
  console.error('');
  console.error('⚠️  Verification completed with warnings');
  console.error('   Review the output above for any issues');
  console.error('');
}

