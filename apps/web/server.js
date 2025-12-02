import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 4173;
const distPath = resolve(__dirname, 'dist');

// Serve static files (JS, CSS, images, etc.)
app.use(express.static(distPath, {
  // Don't serve index.html for static files
  index: false,
}));

// Handle SPA routing - check for prerendered routes first, then fallback to index.html
app.get('*', (req, res, next) => {
  // Skip if it's a static asset request (has file extension)
  if (req.path.match(/\.[a-zA-Z0-9]+$/)) {
    return next();
  }

  // Try to serve prerendered route (e.g., /login/index.html)
  const prerenderedPath = resolve(distPath, req.path, 'index.html');
  if (existsSync(prerenderedPath)) {
    return res.sendFile(prerenderedPath);
  }

  // Fallback to root index.html for client-side routing
  const indexPath = resolve(distPath, 'index.html');
  if (existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  // 404 if index.html doesn't exist
  res.status(404).send('Not Found');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
  console.log(`📁 Serving from: ${distPath}`);
});

