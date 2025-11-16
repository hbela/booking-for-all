import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// In ESM, __dirname is not available by default – reconstruct it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from monorepo root and from apps/server/.env explicitly
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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


