-- AlterTable: Add domain field to organization table
ALTER TABLE "organization" ADD COLUMN "domain" TEXT;

-- CreateIndex: Make domain unique
CREATE UNIQUE INDEX "organization_domain_key" ON "organization"("domain");

