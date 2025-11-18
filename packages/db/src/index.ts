import { PrismaClient } from "../prisma/generated/index.js";
import { withAccelerate } from "@prisma/extension-accelerate";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "apps/server/.env"),
  path.resolve(__dirname, "../../apps/server/.env"),
  path.resolve(__dirname, "../../.env"),
];

for (const envPath of envCandidates) {
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath, override: false });
}

const nodeEnv =
  process.env.NODE_ENV ??
  process.env.APP_ENV ??
  process.env.VITE_NODE_ENV ??
  "development";
const normalizedEnv = nodeEnv.toLowerCase();
const isProductionEnv = normalizedEnv === "production";
const directUrl = process.env.DIRECT_URL?.trim();
const accelerateUrl = process.env.DATABASE_URL?.trim();

// Check if DATABASE_URL is an Accelerate/Data Proxy URL (prisma:// or prisma+postgres://)
// If so, we must use it even in development (Prisma Client generated with --no-engine requires this)
const isAccelerateOrDataProxyUrl =
  accelerateUrl?.startsWith("prisma://") ||
  accelerateUrl?.startsWith("prisma+postgres://");

// In development, prefer DIRECT_URL only if:
// 1. It's set AND
// 2. DATABASE_URL is NOT an Accelerate/Data Proxy URL (which requires --no-engine)
// Otherwise, use DATABASE_URL (which works with --no-engine)
const shouldUseDirectUrl =
  !isProductionEnv && !!directUrl && !isAccelerateOrDataProxyUrl;

const databaseUrl = shouldUseDirectUrl ? directUrl : accelerateUrl;

if (!databaseUrl) {
  throw new Error(
    "Prisma client failed to initialize: set DATABASE_URL (production) or DIRECT_URL (development).",
  );
}

console.log(
  `🔍 DB Package - selected ${
    shouldUseDirectUrl ? "DIRECT_URL" : "DATABASE_URL"
  }: ${databaseUrl.substring(0, 50)}...`,
);

// Check if using Accelerate (prisma+postgres://) or Data Proxy (prisma://)
const isAccelerateUrl =
  databaseUrl.startsWith("prisma+postgres://") ||
  databaseUrl.startsWith("prisma://");

// Create base Prisma Client
const basePrismaClient = new PrismaClient({
  log: ["error", "warn"],
  datasources: databaseUrl
    ? {
        db: {
          url: databaseUrl,
        },
      }
    : undefined,
});

// Apply Accelerate extension only if using Accelerate URL
const basePrisma = isAccelerateUrl
  ? basePrismaClient.$extends(withAccelerate())
  : basePrismaClient;

// Extend Prisma Client with Accelerate to fix role values from better-auth
const prisma = basePrisma.$extends({
  query: {
    user: {
      async create({ args, query }: any) {
        // Map lowercase better-auth roles to uppercase enum values
        if (args.data.role && typeof args.data.role === "string") {
          const roleMap: Record<string, string> = {
            user: "CLIENT",
            admin: "ADMIN",
            owner: "OWNER",
            provider: "PROVIDER",
            // Already uppercase - keep as is
            ADMIN: "ADMIN",
            OWNER: "OWNER",
            PROVIDER: "PROVIDER",
            CLIENT: "CLIENT",
          };

          const originalRole = args.data.role;
          args.data.role = roleMap[originalRole] || "CLIENT";
          console.log(
            `🔄 Role mapping: "${originalRole}" → "${args.data.role}"`
          );
        }

        return query(args);
      },
      async update({ args, query }: any) {
        // Map role values if being updated
        if (args.data.role && typeof args.data.role === "string") {
          const roleMap: Record<string, string> = {
            user: "CLIENT",
            admin: "ADMIN",
            owner: "OWNER",
            provider: "PROVIDER",
            ADMIN: "ADMIN",
            OWNER: "OWNER",
            PROVIDER: "PROVIDER",
            CLIENT: "CLIENT",
          };

          const originalRole = args.data.role;
          args.data.role = roleMap[originalRole] || "CLIENT";
          console.log(
            `🔄 Role mapping: "${originalRole}" → "${args.data.role}"`
          );
        }

        return query(args);
      },
      async upsert({ args, query }: any) {
        // Map role values in create and update
        if (args.create.role && typeof args.create.role === "string") {
          const roleMap: Record<string, string> = {
            user: "CLIENT",
            admin: "ADMIN",
            owner: "OWNER",
            provider: "PROVIDER",
            ADMIN: "ADMIN",
            OWNER: "OWNER",
            PROVIDER: "PROVIDER",
            CLIENT: "CLIENT",
          };

          args.create.role = roleMap[args.create.role] || "CLIENT";
        }

        if (args.update.role && typeof args.update.role === "string") {
          const roleMap: Record<string, string> = {
            user: "CLIENT",
            admin: "ADMIN",
            owner: "OWNER",
            provider: "PROVIDER",
            ADMIN: "ADMIN",
            OWNER: "OWNER",
            PROVIDER: "PROVIDER",
            CLIENT: "CLIENT",
          };

          args.update.role = roleMap[args.update.role] || "CLIENT";
        }

        return query(args);
      },
    },
  },
});

console.log(
  `📊 Prisma Client initialized with ${
    isAccelerateUrl ? "Accelerate" : "direct connection"
  } and role mapping extension`
);

export default prisma;
