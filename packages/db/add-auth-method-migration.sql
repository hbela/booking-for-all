-- Add authMethod column to member table with default value
-- This migration adds organization-scoped authentication methods

-- Step 1: Add authMethod column as nullable first
ALTER TABLE "member" ADD COLUMN "authMethod" TEXT;

-- Step 2: Backfill authMethod for existing members
-- Logic: Check user's Account table to determine which auth method they used
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
      ELSE 'credential' -- default fallback
    END
);

-- Step 3: Make authMethod NOT NULL now that all rows have a value
ALTER TABLE "member" ALTER COLUMN "authMethod" SET NOT NULL;

-- Verification query (optional - run separately to check results):
-- SELECT m.id, m."userId", m."organizationId", m."authMethod", 
--        array_agg(DISTINCT a."providerId") as accounts
-- FROM "member" m
-- LEFT JOIN "account" a ON a."userId" = m."userId"
-- GROUP BY m.id, m."userId", m."organizationId", m."authMethod";

