-- AlterTable
ALTER TABLE "organization" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Europe/Budapest',
ADD COLUMN "availabilityStartHour" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN "availabilityEndHour" INTEGER NOT NULL DEFAULT 20;

