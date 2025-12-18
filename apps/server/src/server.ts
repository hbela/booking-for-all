import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// In ESM, __dirname is not available by default – reconstruct it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env files in priority order:
// 1. apps/server/.env FIRST (highest priority) - server-specific config with override enabled
// 2. packages/.env or root .env (lower priority) - shared config
// This ensures apps/server/.env DATABASE_URL (Accelerate) overrides packages/.env DATABASE_URL (direct postgres)
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false });

import { buildApp } from './app';

const app = buildApp();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

app
  .listen({ port, host })
  .then(() => app.log.info(`listening on http://${host}:${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });


