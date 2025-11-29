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
  // Download APK (Public Route)
  // ------------------------
  fastify.get("/org/:id/app", async (req, reply) => {
    const { id } = req.params as { id: string };

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org || !org.apkKey) {
      throw new AppError("No APK found for this organization", "APK_NOT_FOUND", 404);
    }

    const apkUrl = `${publicAppUrl}/api/file/${org.apkKey}`;
    return reply.redirect(apkUrl);
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

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org || !org.qrCodeKey) {
      throw new AppError("QR code not found for this organization", "QR_NOT_FOUND", 404);
    }

    const qrUrl = `${publicAppUrl}/api/file/${org.qrCodeKey}`;
    return reply.redirect(qrUrl);
  });
});

