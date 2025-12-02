import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 4173;
const distPath = resolve(__dirname, 'dist');

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - IP: ${req.ip || req.socket.remoteAddress}`);
  next();
});

// Add error handling for uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Simple health check endpoint (no file system operations)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check server status
app.get('/debug/status', (req, res) => {
  const status = {
    server: 'running',
    timestamp: new Date().toISOString(),
    distPath,
    distExists: existsSync(distPath),
    indexHtmlExists: existsSync(resolve(distPath, 'index.html')),
    loginDirExists: existsSync(resolve(distPath, 'login')),
    loginIndexExists: existsSync(resolve(distPath, 'login', 'index.html')),
    assetsDirExists: existsSync(resolve(distPath, 'assets')),
    env: {
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
    },
  };
  
  // Try to list some files
  try {
    status.distContents = readdirSync(distPath).slice(0, 10); // First 10 items
  } catch (e) {
    status.distContentsError = e.message;
  }
  
  res.json(status);
});

// Serve static files (JS, CSS, images, etc.)
app.use(express.static(distPath, {
  // Don't serve index.html for static files
  index: false,
}));

// Handle SPA routing - always serve root index.html and let React Router handle routing
// Prerendered files are for SEO/crawlers, but for serving we use client-side routing
app.get('*', (req, res, next) => {
  // Normalize path - remove double slashes and trailing slashes
  let normalizedPath = req.path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  
  // Skip if it's a static asset request (has file extension)
  if (normalizedPath.match(/\.[a-zA-Z0-9]+$/)) {
    return next();
  }

  // Always serve root index.html for SPA routing
  // React Router will handle the client-side routing
  const indexPath = resolve(distPath, 'index.html');
  if (existsSync(indexPath)) {
    console.log(`📄 Serving root index.html for SPA routing: ${normalizedPath}`);
    return res.sendFile(indexPath);
  }

  // 404 if index.html doesn't exist
  console.error(`❌ index.html not found in ${distPath}`);
  res.status(404).send('Not Found');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Start server with error handling
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${port}`);
  console.log(`📁 Serving from: ${distPath}`);
  console.log(`📦 Dist exists: ${existsSync(distPath)}`);
  console.log(`📄 index.html exists: ${existsSync(resolve(distPath, 'index.html'))}`);
}).on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

