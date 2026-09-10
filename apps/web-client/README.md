# @testing-system/web-client

Student client — mobile-first, works on phones and classroom PCs.

- Vite + Vue 3 + TypeScript
- Tailwind CSS v4 (Vite plugin, no config file)
- vue-i18n: locale files in `src/i18n/locales/`
- Development proxy: `/api` and `/ws` → `VITE_API_TARGET` (default `http://localhost:3300`)

The server (`apps/server`) serves the production build of this app, so in a
deployed setting students simply open the teacher's LAN address in a browser.

Run: `pnpm dev:web` (from repo root) or `pnpm dev` here.