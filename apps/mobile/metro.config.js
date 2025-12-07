// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the workspace root
const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Add workspace root to watchFolders (merge with Expo's defaults)
config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

// Add workspace node_modules to resolver paths for pnpm workspace support
config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths || []),
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Configure path alias resolution for @/
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  '@': path.resolve(projectRoot, 'src'),
};

module.exports = config;

