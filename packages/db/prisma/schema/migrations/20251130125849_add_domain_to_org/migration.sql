/*
  Warnings:

  - A unique constraint covering the columns `[domain]` on the table `organization` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "domain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organization_domain_key" ON "organization"("domain");
