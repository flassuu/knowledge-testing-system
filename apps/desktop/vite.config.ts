import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

// Teacher desktop app frontend. The webview talks to the local API server
// (default http://localhost:3300) directly; in dev the server is started
// separately with `pnpm dev:server`.
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:3300";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/ws": { target: apiTarget, ws: true },
    },
  },
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_ENV_*"],
}))