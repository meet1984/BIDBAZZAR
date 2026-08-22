import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(currentDirectory, "./src"),
    },
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || 5000}`,
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: process.env.VITE_BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || 5000}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
