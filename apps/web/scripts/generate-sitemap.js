import { writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distPath = resolve(__dirname, '../dist');
const hostname = process.env.SITE_URL || process.env.PUBLIC_APP_URL || 'https://webdev.appointer.hu';

// Public routes that should be in sitemap
const routes = [
  { url: '/', changefreq: 'daily', priority: 1.0 },
  { url: '/login', changefreq: 'monthly', priority: 0.8 },
  // Add more public routes here as needed
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url>
    <loc>${hostname}${route.url}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

writeFileSync(join(distPath, 'sitemap.xml'), sitemap);
console.log('✅ Sitemap generated:', join(distPath, 'sitemap.xml'));
console.log(`   Hostname: ${hostname}`);
console.log(`   Routes: ${routes.length}`);

