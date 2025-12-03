#!/usr/bin/env node

/**
 * Generate placeholder assets for Expo app
 * Creates minimal PNG files for icon, adaptive-icon, and splash
 */

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Minimal 1x1 transparent PNG (base64 encoded)
// This is a valid PNG that can be used as a placeholder
const minimalPNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Create placeholder files
const files = [
  'icon.png',
  'adaptive-icon.png',
  'splash.png',
  'favicon.png'
];

console.log('🎨 Generating placeholder assets...');

files.forEach(file => {
  const filePath = path.join(assetsDir, file);
  fs.writeFileSync(filePath, minimalPNG);
  console.log(`✅ Created: ${file}`);
});

console.log('\n⚠️  Note: These are placeholder images (1x1 transparent PNGs).');
console.log('   Replace them with actual assets before production builds.');
console.log('   Recommended sizes:');
console.log('   - icon.png: 1024x1024');
console.log('   - adaptive-icon.png: 1024x1024');
console.log('   - splash.png: 2048x2048');
console.log('   - favicon.png: 48x48');

