import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:3300'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // The About dialog has no Tauri to ask for a version in a browser, so the
  // version of the build is compiled in.
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.5.0'),
  },
  // Relative base so the server can serve the build from any path.
  base: './',
  server: {
    port: 5173,
    // During dev the student client runs on Vite, the API on the bun server.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/ws': { target: API_TARGET, ws: true },
    },
  },
})