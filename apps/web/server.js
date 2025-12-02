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
  // Normalize path - remove double slashes and trailing slashes
  let normalizedPath = req.path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  
  // Skip if it's a static asset request (has file extension)
  if (normalizedPath.match(/\.[a-zA-Z0-9]+$/)) {
    return next();
  }

  // For root path, serve index.html directly
  if (normalizedPath === '/') {
    const indexPath = resolve(distPath, 'index.html');
    if (existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }

  // Try to serve prerendered route (e.g., /login/index.html)
  const prerenderedPath = resolve(distPath, normalizedPath, 'index.html');
  if (existsSync(prerenderedPath)) {
    console.log(`✅ Serving prerendered route: ${normalizedPath}`);
    return res.sendFile(prerenderedPath);
  }

  // Fallback to root index.html for client-side routing
  const indexPath = resolve(distPath, 'index.html');
  if (existsSync(indexPath)) {
    console.log(`📄 Serving root index.html for client-side routing: ${normalizedPath}`);
    return res.sendFile(indexPath);
  }

  // 404 if index.html doesn't exist
  console.error(`❌ index.html not found in ${distPath}`);
  res.status(404).send('Not Found');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
  console.log(`📁 Serving from: ${distPath}`);
});

