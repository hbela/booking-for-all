import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackRouter({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Stub out i18next-fs-backend for frontend (it's only used in backend)
      "i18next-fs-backend": path.resolve(__dirname, "./src/lib/i18n-stub.ts"),
    },
    preserveSymlinks: false,
  },
  optimizeDeps: {
    include: ["@booking-for-all/i18n"],
    exclude: ["i18next-fs-backend"],
  },
  server: {
    host: "0.0.0.0",
    port: 4173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: [
      "app.appointer.hu",
      "web.appointer.hu",
      // Dev subdomains
      "webdev.appointer.hu",
      "wellnessdev.appointer.hu",
      "medicaredev.appointer.hu",
    ],
    // Enable history API fallback for SPA routing
    // This ensures all routes serve index.html and let React Router handle routing
    strictPort: false,
  },
});
