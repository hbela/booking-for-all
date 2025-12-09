import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import QRCode from "qrcode";
import prisma from "@booking-for-all/db";
import { AppError } from "../errors/AppError";
import { requireAuthHook, requireAdminHook } from "./authz";

export default fp(async (fastify: FastifyInstance) => {
  const cfg = (fastify as any).config as any;

  // Initialize S3 client (Hetzner S3)
  const s3 = new S3Client({
    region: cfg.S3_REGION || process.env.S3_REGION || "us-east-1",
    endpoint: cfg.S3_ENDPOINT || process.env.S3_ENDPOINT,
    forcePathStyle: false,
    credentials: {
      accessKeyId: cfg.S3_ACCESS_KEY || process.env.S3_ACCESS_KEY || "",
      secretAccessKey: cfg.S3_SECRET_KEY || process.env.S3_SECRET_KEY || "",
    },
  });

  // Initialize R2 client (Cloudflare R2) - fallback for APK files
  const r2AccessKeyId = cfg.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey =
    cfg.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  const r2AccountId = cfg.R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const r2BucketName = cfg.R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;
  const r2Endpoint =
    cfg.R2_ENDPOINT ||
    process.env.R2_ENDPOINT ||
    (r2AccountId
      ? `https://${r2AccountId}.r2.cloudflarestorage.com`
      : undefined);

  const r2 =
    r2AccessKeyId && r2SecretAccessKey && r2BucketName && r2Endpoint
      ? new S3Client({
          region: "auto",
          endpoint: r2Endpoint,
          forcePathStyle: false,
          credentials: {
            accessKeyId: r2AccessKeyId,
            secretAccessKey: r2SecretAccessKey,
          },
        })
      : null;

  const bucket = cfg.S3_BUCKET || process.env.S3_BUCKET || "";
  const publicAppUrl =
    cfg.PUBLIC_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    cfg.CORS_ORIGIN ||
    process.env.CORS_ORIGIN ||
    "";

  // Helper function to resolve APK URL from either S3 or R2
  async function resolveApkUrl(
    orgId: string,
    apkKey: string | null
  ): Promise<{ url: string; source: "s3" | "r2" | null }> {
    // Priority 1: Check S3 if apkKey exists
    if (apkKey) {
      try {
        await s3.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: apkKey,
          })
        );
        fastify.log.info(`✅ APK found in S3: ${apkKey}`);
        return { url: `${publicAppUrl}/api/file/${apkKey}`, source: "s3" };
      } catch (error: any) {
        if (
          error.name !== "NotFound" &&
          error.$metadata?.httpStatusCode !== 404
        ) {
          fastify.log.warn(error, `⚠️ Error checking S3 for APK: ${apkKey}`);
        }
        // Fall through to R2 check
      }
    }

    // Priority 2: Check R2 fallback
    if (r2 && r2BucketName) {
      // Try organization-specific path first
      const r2Key = `organizations/${orgId}/app-release.apk`;
      try {
        await r2.send(
          new HeadObjectCommand({
            Bucket: r2BucketName,
            Key: r2Key,
          })
        );
        fastify.log.info(`✅ APK found in R2: ${r2Key}`);
        return { url: `${publicAppUrl}/api/r2-file/${r2Key}`, source: "r2" };
      } catch (error: any) {
        if (
          error.name !== "NotFound" &&
          error.$metadata?.httpStatusCode !== 404
        ) {
          fastify.log.warn(error, `⚠️ Error checking R2 for APK: ${r2Key}`);
        }
        // Try releases fallback if organization-specific not found
        // First try: releases/app-release.apk (main releases path)
        const releasesR2Key = `releases/app-release.apk`;
        try {
          await r2.send(
            new HeadObjectCommand({
              Bucket: r2BucketName,
              Key: releasesR2Key,
            })
          );
          fastify.log.info(
            `✅ APK found in R2 (releases fallback): ${releasesR2Key}`
          );
          return {
            url: `${publicAppUrl}/api/r2-file/${releasesR2Key}`,
            source: "r2",
          };
        } catch (releasesError: any) {
          if (
            releasesError.name !== "NotFound" &&
            releasesError.$metadata?.httpStatusCode !== 404
          ) {
            fastify.log.warn(
              releasesError,
              `⚠️ Error checking R2 for releases APK: ${releasesR2Key}`
            );
          }
          // Try dev branch fallback if main releases path not found
          const devR2Key = `releases/dev/app-release.apk`;
          try {
            await r2.send(
              new HeadObjectCommand({
                Bucket: r2BucketName,
                Key: devR2Key,
              })
            );
            fastify.log.info(`✅ APK found in R2 (dev fallback): ${devR2Key}`);
            return {
              url: `${publicAppUrl}/api/r2-file/${devR2Key}`,
              source: "r2",
            };
          } catch (devError: any) {
            if (
              devError.name !== "NotFound" &&
              devError.$metadata?.httpStatusCode !== 404
            ) {
              fastify.log.warn(
                devError,
                `⚠️ Error checking R2 for dev APK: ${devR2Key}`
              );
            }
          }
        }
      }
    }

    return { url: "", source: null };
  }

  // ------------------------
  // Generate QR Code + Upload to S3
  // ------------------------
  fastify.post(
    "/api/admin/organizations/:id/qrcode",
    { preValidation: [requireAuthHook, requireAdminHook] },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const org = await prisma.organization.findUnique({ where: { id } });
      if (!org) {
        throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
      }

      const qrData = `${publicAppUrl}/org/${id}/app`;

      const pngBuffer = await QRCode.toBuffer(qrData, {
        errorCorrectionLevel: "H",
        type: "png",
        width: 600,
      });

      const key = `orgs/${id}/qr.png`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: pngBuffer,
          ContentType: "image/png",
        })
      );

      await prisma.organization.update({
        where: { id },
        data: { qrCodeKey: key },
      });

      return reply.send({ success: true, data: { key } });
    }
  );

  // ------------------------
  // Upload APK File
  // ------------------------
  fastify.post(
    "/api/admin/organizations/:id/upload-apk",
    { preValidation: [requireAuthHook, requireAdminHook] },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const org = await prisma.organization.findUnique({ where: { id } });
      if (!org) {
        throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
      }

      const data = await req.file();
      if (!data) {
        throw new AppError("No file provided", "NO_FILE", 400);
      }

      if (!data.filename.endsWith(".apk")) {
        throw new AppError("APK file required", "INVALID_FILE_TYPE", 400);
      }

      const buffer = await data.toBuffer();
      const key = `orgs/${id}/${Date.now()}.apk`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType:
            data.mimetype || "application/vnd.android.package-archive",
        })
      );

      await prisma.organization.update({
        where: { id },
        data: { apkKey: key },
      });

      return reply.send({ success: true, data: { key } });
    }
  );

  // ------------------------
  // Download APK Page (Public Route)
  // ------------------------
  fastify.get("/org/:id/app", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { orgId } = req.query as { orgId?: string };

    // Use orgId from query param if provided, otherwise use path param
    const finalOrgId = orgId || id;

    const org = await prisma.organization.findUnique({
      where: { id: finalOrgId },
    });
    if (!org) {
      throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
    }

    // Check if request is from mobile app (deep link detection)
    const userAgent = req.headers["user-agent"] || "";
    const isMobileApp =
      userAgent.includes("BookingForAll") ||
      userAgent.includes("bookingapp") ||
      req.headers["x-app-request"] === "true";

    // If mobile app is making the request, redirect to deep link
    if (isMobileApp) {
      const deepLink = `bookingapp://org?orgId=${finalOrgId}&orgSlug=${
        org.slug || ""
      }`;
      return reply.redirect(302, deepLink);
    }

    // Resolve APK URL from S3 or R2
    const apkResult = await resolveApkUrl(finalOrgId, org.apkKey);

    // Get QR code URL
    let qrCodeUrl = "";
    if (org.qrCodeKey) {
      qrCodeUrl = `${publicAppUrl}/api/file/${org.qrCodeKey}`;
    } else {
      // Generate QR code on-demand if it doesn't exist
      try {
        if (bucket && publicAppUrl) {
          // Update QR code to include orgId in query param
          const qrData = `${publicAppUrl}/org/${finalOrgId}/app?orgId=${finalOrgId}`;
          const pngBuffer = await QRCode.toBuffer(qrData, {
            errorCorrectionLevel: "H",
            type: "png",
            width: 600,
          });

          const key = `orgs/${finalOrgId}/qr.png`;
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: pngBuffer,
              ContentType: "image/png",
            })
          );

          await prisma.organization.update({
            where: { id: finalOrgId },
            data: { qrCodeKey: key },
          });

          qrCodeUrl = `${publicAppUrl}/api/file/${key}`;
          fastify.log.info(
            `✅ QR code generated on-demand for organization: ${finalOrgId}`
          );
        }
      } catch (error: any) {
        fastify.log.error(error, "❌ Failed to generate QR code on-demand");
      }
    }

    // If no APK found in either location, show error page
    if (!apkResult.url) {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${org.name} - Mobile App Download</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
    .org-name { color: #667eea; font-size: 20px; margin-bottom: 30px; font-weight: 600; }
    .error { color: #e74c3c; background: #fee; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .qr-container { margin: 30px 0; }
    .qr-code { width: 200px; height: 200px; border: 3px solid #667eea; border-radius: 12px; margin: 0 auto; }
    .download-btn {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 16px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      font-size: 16px;
      margin-top: 20px;
      transition: background 0.3s;
    }
    .download-btn:hover { background: #5568d3; }
    .info { color: #666; margin-top: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📱 Mobile App Download</h1>
    <div class="org-name">${org.name}</div>
    <div class="error">
      <strong>APK not available</strong><br>
      The mobile app APK has not been uploaded for this organization yet.<br><br>
      <small style="color: #666;">
        Please contact the administrator to upload the APK file or build it using the GitHub Actions workflow.
      </small>
    </div>
    ${
      qrCodeUrl
        ? `
    <div class="qr-container">
      <img src="${qrCodeUrl}" alt="QR Code" class="qr-code" />
      <p class="qr-label">Scan to share this page</p>
    </div>
    `
        : ""
    }
  </div>
</body>
</html>`;
      reply.type("text/html").send(html);
      return;
    }

    const apkUrl = apkResult.url;
    const apkSource = apkResult.source;
    fastify.log.info(
      `📦 Serving APK from ${apkSource} for organization: ${finalOrgId}`
    );

    // Build deep link for post-install configuration
    const deepLink = `bookingapp://org?orgId=${finalOrgId}&orgSlug=${
      org.slug || ""
    }`;
    const universalLink = `https://app.booking-for-all.com/org?orgId=${finalOrgId}&orgSlug=${
      org.slug || ""
    }`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${org.name} - Mobile App Download</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
    .org-name { color: #667eea; font-size: 20px; margin-bottom: 30px; font-weight: 600; }
    .qr-container { margin: 30px 0; }
    .qr-code { width: 200px; height: 200px; border: 3px solid #667eea; border-radius: 12px; margin: 0 auto; display: block; }
    .qr-label { color: #666; font-size: 14px; margin-top: 10px; }
    .download-btn {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 16px 32px;
      text-decoration: none;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      font-size: 16px;
      margin: 10px 5px;
      transition: background 0.3s;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      cursor: pointer;
      min-width: 200px;
    }
    .download-btn:hover { background: #5568d3; }
    .download-btn:active { transform: scale(0.98); }
    .download-btn.secondary {
      background: #28a745;
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
    }
    .download-btn.secondary:hover { background: #218838; }
    .info { color: #666; margin-top: 20px; font-size: 14px; line-height: 1.6; }
    .info-section {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: left;
    }
    .info-section p {
      margin: 10px 0;
      font-size: 14px;
    }
    @media (max-width: 480px) {
      .container { padding: 30px 20px; }
      h1 { font-size: 20px; }
      .org-name { font-size: 18px; }
      .qr-code { width: 180px; height: 180px; }
    }
  </style>
  <script>
    // Try to open app if installed (universal link)
    function tryOpenApp() {
      const deepLink = '${deepLink}';
      const universalLink = '${universalLink}';
      
      // Try universal link first (works for both installed and not installed)
      if (universalLink && universalLink !== 'https://app.booking-for-all.com/org?orgId=undefined&orgSlug=undefined') {
        window.location.href = universalLink;
      } else {
        // Fallback: Try deep link
        window.location.href = deepLink;
      }
    }
    
    // Auto-detect if app is installed on mobile devices
    window.addEventListener('load', () => {
      // Check if we're on mobile
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        // Small delay to let page render, then try to open app
        setTimeout(() => {
          // Only auto-open if user hasn't interacted yet
          // This prevents interrupting manual downloads
        }, 1000);
      }
    });
  </script>
</head>
<body>
  <div class="container">
    <h1>📱 Mobile App Download</h1>
    <div class="org-name">${org.name}</div>
    
    ${
      apkUrl
        ? `
    <a href="${apkUrl}" class="download-btn" download>
      📥 Download APK
    </a>
    `
        : ""
    }
    
    <div class="info-section">
      <p><strong>After installing the app:</strong></p>
      <p>Tap the button below to configure the app with your organization (${org.name}):</p>
      <button onclick="tryOpenApp()" class="download-btn secondary">
        🔗 Open App & Configure
      </button>
      <p style="margin-top: 10px; font-size: 12px; text-align: center;">
        Or scan the QR code again after installation.
      </p>
    </div>
    
    ${
      qrCodeUrl
        ? `
    <div class="qr-container">
      <img src="${qrCodeUrl}" alt="QR Code" class="qr-code" />
      <p class="qr-label">Scan to download on another device</p>
    </div>
    `
        : ""
    }
    
    <div class="info">
      <p><strong>Note:</strong> Enable "Install unknown apps" in your phone settings if needed.</p>
      <p style="font-size: 12px; margin-top: 10px;">
        Settings → Apps → Special app access → Install unknown apps
      </p>
    </div>
  </div>
</body>
</html>`;

    reply.type("text/html").send(html);
  });

  // ------------------------
  // Serve File from S3 (Public Route)
  // ------------------------
  fastify.get("/api/file/:key", async (req, reply) => {
    const { key } = req.params as { key: string };

    try {
      const data = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      if (!data.Body) {
        throw new AppError("File not found", "FILE_NOT_FOUND", 404);
      }

      const buffer = await data.Body.transformToByteArray();
      const filename = key.split("/").pop() || "file";
      // Ensure APK files have the correct content type for mobile browsers
      let contentType = data.ContentType || "application/octet-stream";
      if (filename.endsWith(".apk")) {
        contentType = "application/vnd.android.package-archive";
      }

      reply.header("Content-Type", contentType);
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      reply.header("Content-Length", buffer.length.toString());
      // Add cache control for APK files
      if (filename.endsWith(".apk")) {
        reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
      }
      return reply.send(Buffer.from(buffer));
    } catch (error: any) {
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        throw new AppError("File not found", "FILE_NOT_FOUND", 404);
      }
      fastify.log.error(error, "Error serving file from S3");
      throw new AppError("Failed to serve file", "FILE_SERVE_ERROR", 500);
    }
  });

  // ------------------------
  // Serve File from R2 (Public Route) - Proxy for R2 files
  // ------------------------
  // Use catch-all route pattern to handle paths with slashes like "releases/dev/app-release.apk"
  fastify.get("/api/r2-file/*", async (req, reply) => {
    // Extract the key from the URL (everything after /api/r2-file/)
    const urlPath = req.url.split("?")[0]; // Remove query params
    const key = urlPath.replace("/api/r2-file/", "");

    if (!r2 || !r2BucketName) {
      throw new AppError("R2 not configured", "R2_NOT_CONFIGURED", 503);
    }

    if (!key || key.length === 0) {
      throw new AppError("File key is required", "KEY_REQUIRED", 400);
    }

    fastify.log.info(
      {
        key,
        bucket: r2BucketName,
        url: req.url,
        urlPath,
      },
      "📥 Serving R2 file"
    );

    try {
      const data = await r2.send(
        new GetObjectCommand({
          Bucket: r2BucketName,
          Key: key,
        })
      );

      if (!data.Body) {
        throw new AppError("File not found", "FILE_NOT_FOUND", 404);
      }

      const buffer = await data.Body.transformToByteArray();
      const filename = key.split("/").pop() || "app-release.apk";
      // Ensure APK files have the correct content type for mobile browsers
      let contentType =
        data.ContentType || "application/vnd.android.package-archive";
      if (filename.endsWith(".apk")) {
        contentType = "application/vnd.android.package-archive";
      }

      reply.header("Content-Type", contentType);
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      reply.header("Content-Length", buffer.length.toString());
      // Add cache control for APK files
      reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
      fastify.log.info(
        {
          key,
          bucket: r2BucketName,
          size: buffer.length,
          contentType,
        },
        `✅ Served file from R2: ${key}`
      );
      return reply.send(Buffer.from(buffer));
    } catch (error: any) {
      fastify.log.error(
        {
          error: error.message,
          errorName: error.name,
          httpStatusCode: error.$metadata?.httpStatusCode,
          key,
          bucket: r2BucketName,
        },
        "❌ Error serving file from R2"
      );

      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        throw new AppError("File not found", "FILE_NOT_FOUND", 404);
      }
      throw new AppError("Failed to serve file", "FILE_SERVE_ERROR", 500);
    }
  });

  // ------------------------
  // Install Endpoint (Public API Route) - Returns JSON with install information
  // ------------------------
  fastify.get("/api/install/:orgId", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const queryOrgId = (req.query as { orgId?: string }).orgId;

    // Use orgId from query param if provided, otherwise use path param
    const finalOrgId = queryOrgId || orgId;

    const org = await prisma.organization.findUnique({
      where: { id: finalOrgId },
      select: {
        id: true,
        name: true,
        slug: true,
        apkKey: true,
        qrCodeKey: true,
      },
    });

    if (!org) {
      throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
    }

    // Resolve APK URL from S3 or R2
    const apkResult = await resolveApkUrl(finalOrgId, org.apkKey);

    // Build QR code URL if available
    let qrCodeUrl = "";
    if (org.qrCodeKey) {
      qrCodeUrl = `${publicAppUrl}/api/file/${org.qrCodeKey}`;
    }

    // Build deep link and universal link
    const deepLink = `bookingapp://org?orgId=${finalOrgId}&orgSlug=${org.slug || ""}`;
    const universalLink = `https://app.booking-for-all.com/org?orgId=${finalOrgId}&orgSlug=${org.slug || ""}`;

    // Build install page URL
    const installPageUrl = `${publicAppUrl}/org/${finalOrgId}/app?orgId=${finalOrgId}`;

    reply.send({
      success: true,
      data: {
        organizationId: org.id,
        organizationName: org.name,
        organizationSlug: org.slug,
        apk: {
          available: !!apkResult.url,
          downloadUrl: apkResult.url || null,
          source: apkResult.source || null,
        },
        qrCode: {
          available: !!qrCodeUrl,
          imageUrl: qrCodeUrl || null,
        },
        deepLink,
        universalLink,
        installPageUrl,
      },
    });
  });

  // ------------------------
  // Get QR Code Image (Public Route)
  // ------------------------
  fastify.get("/api/org/:id/qrcode", async (req, reply) => {
    const { id } = req.params as { id: string };

    let org = await prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
    }

    // If QR code doesn't exist, generate it on-demand
    if (!org.qrCodeKey) {
      try {
        if (!bucket || !publicAppUrl) {
          throw new AppError(
            "S3 configuration missing, cannot generate QR code",
            "S3_CONFIG_MISSING",
            500
          );
        }

        const qrData = `${publicAppUrl}/org/${id}/app`;
        const pngBuffer = await QRCode.toBuffer(qrData, {
          errorCorrectionLevel: "H",
          type: "png",
          width: 600,
        });

        const key = `orgs/${id}/qr.png`;

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: pngBuffer,
            ContentType: "image/png",
          })
        );

        org = await prisma.organization.update({
          where: { id },
          data: { qrCodeKey: key },
        });

        fastify.log.info(
          `✅ QR code generated on-demand for organization: ${id}`
        );
      } catch (error: any) {
        fastify.log.error(error, "❌ Failed to generate QR code on-demand");
        throw new AppError(
          "Failed to generate QR code",
          "QR_GENERATION_ERROR",
          500
        );
      }
    }

    // Return the QR code image directly instead of redirecting
    try {
      const data = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: org.qrCodeKey,
        })
      );

      if (!data.Body) {
        throw new AppError("QR code file not found", "FILE_NOT_FOUND", 404);
      }

      const buffer = await data.Body.transformToByteArray();
      reply.header("Content-Type", "image/png");
      reply.header("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
      return reply.send(Buffer.from(buffer));
    } catch (error: any) {
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        throw new AppError("QR code file not found", "FILE_NOT_FOUND", 404);
      }
      fastify.log.error(error, "Error serving QR code from S3");
      throw new AppError("Failed to serve QR code", "QR_SERVE_ERROR", 500);
    }
  });
});
