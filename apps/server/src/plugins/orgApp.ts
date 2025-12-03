import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import QRCode from "qrcode";
import prisma from "@booking-for-all/db";
import { AppError } from "../errors/AppError";
import { requireAuthHook, requireAdminHook } from "./authz";

export default fp(async (fastify: FastifyInstance) => {
  const cfg = (fastify as any).config as any;

  // Initialize S3 client
  const s3 = new S3Client({
    region: cfg.S3_REGION || process.env.S3_REGION || "us-east-1",
    endpoint: cfg.S3_ENDPOINT || process.env.S3_ENDPOINT,
    forcePathStyle: false,
    credentials: {
      accessKeyId: cfg.S3_ACCESS_KEY || process.env.S3_ACCESS_KEY || "",
      secretAccessKey: cfg.S3_SECRET_KEY || process.env.S3_SECRET_KEY || "",
    },
  });

  const bucket = cfg.S3_BUCKET || process.env.S3_BUCKET || "";
  const publicAppUrl = cfg.PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || cfg.CORS_ORIGIN || process.env.CORS_ORIGIN || "";

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
          ContentType: data.mimetype || "application/vnd.android.package-archive",
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

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new AppError("Organization not found", "ORG_NOT_FOUND", 404);
    }

    if (!org.apkKey) {
      // Return HTML page with error message
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
      The mobile app APK has not been uploaded for this organization yet.
    </div>
  </div>
</body>
</html>`;
      reply.type("text/html").send(html);
      return;
    }

    // Get QR code URL
    let qrCodeUrl = "";
    if (org.qrCodeKey) {
      qrCodeUrl = `${publicAppUrl}/api/file/${org.qrCodeKey}`;
    } else {
      // Generate QR code on-demand if it doesn't exist
      try {
        if (bucket && publicAppUrl) {
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

          qrCodeUrl = `${publicAppUrl}/api/file/${key}`;
          fastify.log.info(`✅ QR code generated on-demand for organization: ${id}`);
        }
      } catch (error: any) {
        fastify.log.error(error, "❌ Failed to generate QR code on-demand");
      }
    }

    const apkUrl = `${publicAppUrl}/api/file/${org.apkKey}`;
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
      border-radius: 8px;
      font-weight: bold;
      font-size: 16px;
      margin-top: 20px;
      transition: background 0.3s;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .download-btn:hover { background: #5568d3; }
    .download-btn:active { transform: scale(0.98); }
    .info { color: #666; margin-top: 20px; font-size: 14px; line-height: 1.6; }
    @media (max-width: 480px) {
      .container { padding: 30px 20px; }
      h1 { font-size: 20px; }
      .org-name { font-size: 18px; }
      .qr-code { width: 180px; height: 180px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📱 Mobile App Download</h1>
    <div class="org-name">${org.name}</div>
    ${qrCodeUrl ? `
    <div class="qr-container">
      <img src="${qrCodeUrl}" alt="QR Code" class="qr-code" />
      <p class="qr-label">Scan to download on another device</p>
    </div>
    ` : ""}
    <a href="${apkUrl}" class="download-btn" download>
      📥 Download APK
    </a>
    <p class="info">
      Tap the button above to download and install the mobile app for ${org.name}.
      ${qrCodeUrl ? "You can also scan the QR code with another device." : ""}
    </p>
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
      const contentType = data.ContentType || "application/octet-stream";

      reply.header("Content-Type", contentType);
      reply.header("Content-Disposition", `attachment; filename="${key.split("/").pop()}"`);
      return reply.send(Buffer.from(buffer));
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        throw new AppError("File not found", "FILE_NOT_FOUND", 404);
      }
      fastify.log.error(error, "Error serving file from S3");
      throw new AppError("Failed to serve file", "FILE_SERVE_ERROR", 500);
    }
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
          throw new AppError("S3 configuration missing, cannot generate QR code", "S3_CONFIG_MISSING", 500);
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

        fastify.log.info(`✅ QR code generated on-demand for organization: ${id}`);
      } catch (error: any) {
        fastify.log.error(error, "❌ Failed to generate QR code on-demand");
        throw new AppError("Failed to generate QR code", "QR_GENERATION_ERROR", 500);
      }
    }

    const qrUrl = `${publicAppUrl}/api/file/${org.qrCodeKey}`;
    return reply.redirect(qrUrl);
  });
});

