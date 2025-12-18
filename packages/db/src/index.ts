import { PrismaClient } from "../prisma/generated/index.js";
import { withAccelerate } from "@prisma/extension-accelerate";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load apps/server/.env FIRST (highest priority) to ensure it overrides packages/.env
// This is critical because apps/server/.env should contain the correct DATABASE_URL
// From packages/db/src, we need to go up 3 levels to root, then into apps/server
const serverEnvPath = path.resolve(__dirname, "../../../apps/server/.env");
const cwdEnvPath = path.resolve(process.cwd(), ".env"); // apps/server/.env if cwd is apps/server
const packagesEnvPath = path.resolve(__dirname, "../../.env"); // packages/.env

// Determine which path is actually apps/server/.env
const actualServerEnvPath = fs.existsSync(serverEnvPath) ? serverEnvPath : 
                            (fs.existsSync(cwdEnvPath) && process.cwd().endsWith('apps/server') ? cwdEnvPath : null);

// #region agent log
fetch('http://127.0.0.1:7242/ingest/b8bb93ec-15de-4b3a-bec0-935d0a287309',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'packages/db/src/index.ts:11',message:'Starting env file loading',data:{cwd:process.cwd(),__dirname,serverEnvPath,exists:fs.existsSync(serverEnvPath),cwdEnvPath,existsCwd:fs.existsSync(cwdEnvPath),packagesEnvPath,existsPackages:fs.existsSync(packagesEnvPath),actualServerEnvPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
// #endregion

// Load apps/server/.env FIRST with override: true to ensure it takes precedence
if (actualServerEnvPath) {
  // #region agent log
  const beforeLoad = { DATABASE_URL: process.env.DATABASE_URL?.substring(0, 50) || 'NOT SET', DIRECT_URL: process.env.DIRECT_URL?.substring(0, 50) || 'NOT SET' };
  // #endregion
  dotenv.config({ path: actualServerEnvPath, override: true });
  // #region agent log
  const afterLoad = { DATABASE_URL: process.env.DATABASE_URL?.substring(0, 50) || 'NOT SET', DIRECT_URL: process.env.DIRECT_URL?.substring(0, 50) || 'NOT SET' };
  fetch('http://127.0.0.1:7242/ingest/b8bb93ec-15de-4b3a-bec0-935d0a287309',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'packages/db/src/index.ts:25',message:'Loaded apps/server/.env with override',data:{envPath:actualServerEnvPath,beforeLoad,afterLoad,changed:beforeLoad.DATABASE_URL!==afterLoad.DATABASE_URL||beforeLoad.DIRECT_URL!==afterLoad.DIRECT_URL},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
}

// Load other env files with override: false (they won't override apps/server/.env)
const otherEnvPaths = [
  cwdEnvPath !== actualServerEnvPath ? cwdEnvPath : null,
  packagesEnvPath,
].filter((p): p is string => p !== null && fs.existsSync(p));

for (const envPath of otherEnvPaths) {
  // #region agent log
  const beforeLoad = { DATABASE_URL: process.env.DATABASE_URL?.substring(0, 50) || 'NOT SET', DIRECT_URL: process.env.DIRECT_URL?.substring(0, 50) || 'NOT SET' };
  // #endregion
  dotenv.config({ path: envPath, override: false });
  // #region agent log
  const afterLoad = { DATABASE_URL: process.env.DATABASE_URL?.substring(0, 50) || 'NOT SET', DIRECT_URL: process.env.DIRECT_URL?.substring(0, 50) || 'NOT SET' };
  fetch('http://127.0.0.1:7242/ingest/b8bb93ec-15de-4b3a-bec0-935d0a287309',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'packages/db/src/index.ts:35',message:'Loaded other env file',data:{envPath,beforeLoad,afterLoad,changed:beforeLoad.DATABASE_URL!==afterLoad.DATABASE_URL||beforeLoad.DIRECT_URL!==afterLoad.DIRECT_URL},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
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

// #region agent log
fetch('http://127.0.0.1:7242/ingest/b8bb93ec-15de-4b3a-bec0-935d0a287309',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'packages/db/src/index.ts:31',message:'After env loading - raw values',data:{nodeEnv,isProductionEnv,directUrl:directUrl?.substring(0,50)||'NOT SET',accelerateUrl:accelerateUrl?.substring(0,50)||'NOT SET'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
// #endregion

// Check if DATABASE_URL is a Data Proxy URL (prisma://)
// When using --no-engine, Prisma Client requires prisma:// format (Data Proxy)
const isAccelerateOrDataProxyUrl =
  accelerateUrl?.startsWith("prisma://") ||
  accelerateUrl?.startsWith("prisma+postgres://");

// Check if DIRECT_URL is actually a Prisma Accelerate URL
// NOTE: Direct postgres URLs to db.prisma.io are NOT Accelerate URLs - they are direct connections
// Accelerate URLs use prisma:// or prisma+postgres:// protocol
// A direct postgres:// URL to db.prisma.io is still a direct connection, not Accelerate
const isDirectUrlActuallyAccelerate =
  directUrl?.startsWith("prisma://") ||
  directUrl?.startsWith("prisma+postgres://");

// #region agent log
fetch('http://127.0.0.1:7242/ingest/b8bb93ec-15de-4b3a-bec0-935d0a287309',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'packages/db/src/index.ts:45',message:'URL type detection',data:{isAccelerateOrDataProxyUrl,isDirectUrlActuallyAccelerate},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
// #endregion

// In development, prefer DIRECT_URL only if:
// 1. It's set AND
// 2. DATABASE_URL is NOT an Accelerate/Data Proxy URL (which requires --no-engine) AND
// 3. DIRECT_URL is NOT actually a Prisma Accelerate URL (it's a real direct PostgreSQL connection)
// Otherwise, use DATABASE_URL (which works with --no-engine)
const shouldUseDirectUrl =
  !isProductionEnv &&
  !!directUrl &&
  !isAccelerateOrDataProxyUrl &&
  !isDirectUrlActuallyAccelerate;

// #region agent log
fetch('http://127.0.0.1:7242/ingest/b8bb93ec-15de-4b3a-bec0-935d0a287309',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'packages/db/src/index.ts:56',message:'shouldUseDirectUrl decision',data:{isProductionEnv,hasDirectUrl:!!directUrl,shouldUseDirectUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
// #endregion

const databaseUrl = shouldUseDirectUrl ? directUrl : accelerateUrl;

// #region agent log
fetch('http://127.0.0.1:7242/ingest/b8bb93ec-15de-4b3a-bec0-935d0a287309',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'packages/db/src/index.ts:58',message:'Final database URL selection',data:{databaseUrl:databaseUrl?.substring(0,50)||'NOT SET',source:shouldUseDirectUrl?'DIRECT_URL':'DATABASE_URL'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
// #endregion

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
const isAccelerateUrl = databaseUrl.startsWith("prisma+postgres://");
const isDataProxyUrl = databaseUrl.startsWith("prisma://");

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

// Apply Accelerate extension only if using Accelerate URL (prisma+postgres://)
// Note: Data Proxy (prisma://) does not use the Accelerate extension
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
