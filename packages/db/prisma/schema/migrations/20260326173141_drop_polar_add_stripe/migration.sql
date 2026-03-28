/*
  Warnings:

  - You are about to drop the column `apkKey` on the `organization` table. All the data in the column will be lost.
  - You are about to drop the column `polarPaymentId` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `polarId` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `polarCheckoutId` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `polarCustomerId` on the `subscription` table. All the data in the column will be lost.
  - You are about to drop the column `polarSubscriptionId` on the `subscription` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[providerId,accountId]` on the table `account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeInvoiceId]` on the table `payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeProductId]` on the table `product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,userId]` on the table `provider` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeSessionId]` on the table `subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organizationId` to the `booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `authMethod` to the `member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stripeProductId` to the `product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `provider` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."payment_polarPaymentId_key";

-- DropIndex
DROP INDEX "public"."product_polarId_key";

-- DropIndex
DROP INDEX "public"."provider_userId_departmentId_key";

-- DropIndex
DROP INDEX "public"."subscription_polarCheckoutId_key";

-- DropIndex
DROP INDEX "public"."subscription_polarSubscriptionId_key";

-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "member" ADD COLUMN     "authMethod" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "organization" DROP COLUMN "apkKey";

-- AlterTable
ALTER TABLE "payment" DROP COLUMN "polarPaymentId",
ADD COLUMN     "stripeInvoiceId" TEXT;

-- AlterTable
ALTER TABLE "product" DROP COLUMN "polarId",
ADD COLUMN     "stripeProductId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "provider" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "subscription" DROP COLUMN "polarCheckoutId",
DROP COLUMN "polarCustomerId",
DROP COLUMN "polarSubscriptionId",
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSessionId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "isSystemAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "booking_organizationId_idx" ON "booking"("organizationId");

-- CreateIndex
CREATE INDEX "department_organizationId_idx" ON "department"("organizationId");

-- CreateIndex
CREATE INDEX "event_organizationId_idx" ON "event"("organizationId");

-- CreateIndex
CREATE INDEX "event_providerId_idx" ON "event"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_stripeInvoiceId_key" ON "payment"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "product_stripeProductId_key" ON "product"("stripeProductId");

-- CreateIndex
CREATE INDEX "provider_organizationId_idx" ON "provider"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_organizationId_userId_key" ON "provider"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_stripeSessionId_key" ON "subscription"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_stripeSubscriptionId_key" ON "subscription"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "organization"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider" ADD CONSTRAINT "provider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("_id") ON DELETE CASCADE ON UPDATE CASCADE;
