-- This migration was applied manually via backfill script and db push
-- It captures all the organization isolation changes

-- All changes have been applied via:
-- 1. backfill-org-ids.ts script
-- 2. npx prisma db push

-- Changes included:
-- - Added organizationId to Provider, Event, Booking
-- - Added isSystemAdmin to User
-- - Removed role from User
-- - Added all necessary foreign keys and indexes
-- - Added unique constraints for data integrity

