#!/usr/bin/env tsx
/**
 * Script to generate QR codes for wellness and medicare organizations
 * Usage: pnpm --filter server exec tsx scripts/generate-qr-codes.ts
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import QRCode from "qrcode";
import prisma from "@booking-for-all/db";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

const S3_REGION = process.env.S3_REGION || "us-east-1";
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "";
const S3_BUCKET = process.env.S3_BUCKET || "";
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || process.env.CORS_ORIGIN || "";

async function generateQRCode(orgId: string, orgName: string) {
  console.log(`\n🔍 Generating QR code for ${orgName} (${orgId})...`);

  // Check if organization exists
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, qrCodeKey: true },
  });

  if (!org) {
    console.error(`❌ Organization not found: ${orgId}`);
    return null;
  }

  if (org.qrCodeKey) {
    console.log(`⚠️  QR code already exists: ${org.qrCodeKey}`);
    console.log(`   To regenerate, delete the existing QR code first.`);
    return org.qrCodeKey;
  }

  // Validate configuration
  if (!PUBLIC_APP_URL) {
    console.error("❌ PUBLIC_APP_URL missing");
    return null;
  }

  // If S3_BUCKET is missing, we'll still generate the key for manual database update
  if (!S3_BUCKET) {
    console.warn("⚠️  S3_BUCKET missing - will generate key for manual database update");
  }

  try {
    // Initialize S3 client
    const s3 = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      forcePathStyle: false,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
    });

    // Generate QR code
    const qrData = `${PUBLIC_APP_URL}/org/${orgId}/app`;
    console.log(`   QR Data: ${qrData}`);

    const pngBuffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: "H",
      type: "png",
      width: 600,
    });

    const key = `orgs/${orgId}/qr.png`;
    console.log(`   S3 Key: ${key}`);

    if (S3_BUCKET) {
      // Upload to S3
      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: pngBuffer,
          ContentType: "image/png",
        })
      );

      console.log(`✅ QR code uploaded to S3: ${key}`);

      // Update organization with QR code key
      await prisma.organization.update({
        where: { id: orgId },
        data: { qrCodeKey: key },
      });

      console.log(`✅ QR code key saved to database`);
    } else {
      console.log(`⚠️  Skipping S3 upload (S3_BUCKET not set)`);
      console.log(`   QR code PNG buffer generated (${pngBuffer.length} bytes)`);
      console.log(`   You can upload this manually to S3 at: ${key}`);
    }
    console.log(`\n📋 QR Code Details:`);
    console.log(`   Organization: ${org.name}`);
    console.log(`   Organization ID: ${orgId}`);
    console.log(`   S3 Key: ${key}`);
    console.log(`   QR Code URL: ${PUBLIC_APP_URL}/api/org/${orgId}/qrcode`);
    console.log(`   File URL: ${PUBLIC_APP_URL}/api/file/${key}`);

    return key;
  } catch (error: any) {
    console.error(`❌ Failed to generate QR code:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return null;
  }
}

async function main() {
  console.log("🚀 QR Code Generator Script");
  console.log("=".repeat(50));

  // Find wellness and medicare organizations by domain
  const wellnessDomain = "wellnessdev.appointer.hu";
  const medicareDomain = "medicaredev.appointer.hu";

  console.log(`\n🔍 Finding organizations...`);
  console.log(`   Looking for wellness: ${wellnessDomain}`);
  console.log(`   Looking for medicare: ${medicareDomain}`);

  // Find organizations by domain (domain field may contain multiple domains separated by commas)
  const allOrgs = await prisma.organization.findMany({
    select: { id: true, name: true, domain: true, qrCodeKey: true },
  });

  const wellnessOrg = allOrgs.find((org) => 
    org.domain && org.domain.split(',').some((d) => d.trim() === wellnessDomain)
  );

  const medicareOrg = allOrgs.find((org) => 
    org.domain && org.domain.split(',').some((d) => d.trim() === medicareDomain)
  );

  if (!wellnessOrg) {
    console.error(`❌ Wellness organization not found with domain: ${wellnessDomain}`);
  } else {
    console.log(`✅ Found Wellness: ${wellnessOrg.name} (${wellnessOrg.id})`);
  }

  if (!medicareOrg) {
    console.error(`❌ Medicare organization not found with domain: ${medicareDomain}`);
  } else {
    console.log(`✅ Found Medicare: ${medicareOrg.name} (${medicareOrg.id})`);
  }

  // Generate QR codes
  const results: Array<{ name: string; orgId: string; key: string | null }> = [];

  if (wellnessOrg) {
    const key = await generateQRCode(wellnessOrg.id, "Wellness");
    results.push({ name: "Wellness", orgId: wellnessOrg.id, key });
  }

  if (medicareOrg) {
    const key = await generateQRCode(medicareOrg.id, "Medicare");
    results.push({ name: "Medicare", orgId: medicareOrg.id, key });
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  results.forEach((result) => {
    if (result.key) {
      console.log(`✅ ${result.name}: ${result.key}`);
      console.log(`   Update SQL: UPDATE organization SET "qrCodeKey" = '${result.key}' WHERE "_id" = '${result.orgId}';`);
    } else {
      console.log(`❌ ${result.name}: Failed to generate`);
    }
  });

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

