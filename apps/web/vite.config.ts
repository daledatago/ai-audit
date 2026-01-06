import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 8080,
    proxy: {
      // IMPORTANT: use an /api prefix so we don't clash with SPA routes like /workspaces
      "/api": {
        target: "http://127.0.0.1:18083",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },

      // optional: keep these if you want direct access in dev
      "/openapi.json": { target: "http://127.0.0.1:18083", changeOrigin: true },
      "/docs": { target: "http://127.0.0.1:18083", changeOrigin: true },
    },
  },
});
