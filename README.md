# Knowledge Testing System

Offline classroom knowledge-testing suite — a local client-server system for
running tests in a computer lab with **no internet access**. One role-based
application serves an **administrator**, **teachers** and **students**.

> Course project. Works fully on a LAN; nothing leaves the classroom network.

## What's inside

| App | Tech | Purpose |
|-----|------|---------|
| `apps/server` | Node.js, Fastify, SQLite (`node:sqlite`), WebSocket | Embedded REST API + real-time hub; hosted on the admin machine; compiled to a single standalone binary |
| `apps/web-client` | Vue 3, TypeScript, Tailwind CSS v4, PWA | Shared role-based frontend (admin / teacher / student) — mobile-first, one codebase with role-gated features |
| `apps/desktop` | Tauri 2, Vue 3, Tailwind CSS v4 | Same frontend as a native app; the Admin client embeds and runs the server (console + admin panel) |

## Roles

- **Administrator** — hosts the system: runs the embedded server (in the
  desktop client or headless CLI), manages the database, users, participants.
- **Teacher** — desktop app and/or web app on `localhost`: creates/edits
  tests, builds courses with materials, shares tests, reviews statistics and
  journals. May author tests offline and sync them later.
- **Student** — takes tests, views own statistics and course materials
  (phone/PC via PWA, or desktop).

## Architecture

```
   Admin machine (hosts the whole system: Tauri client + embedded server)
          │  HTTP/WS on LAN (0.0.0.0:3300)
   ┌──────┼──────────┬─────────────┐
   ▼      ▼          ▼             ▼
Teacher  Student   Students    (headless
(desktop /   (desktop /   (phones via   CLI)
 web on       web on       Wi-Fi, PWA)
 localhost)   localhost)
```

- **No external internet required** — server + DB + web client live on the
  admin machine; teachers and students connect over the LAN.
- **Role-based single client**: choose a role at first sign-in; the UI adapts.
- **Offline mode**: with the server unreachable, only previously cached
  content is readable (materials, descriptions, statistics) and teachers can
  author local test drafts to sync later.
- Real-time updates are pushed over WebSocket (no polling).
- The server serves the built web client as static files and is compiled into
  one executable, so the admin machine needs **no Node.js, no database
  installation** — just the single app bundle.
- i18n via `vue-i18n`: base locale **en**, **Ukrainian** included,
  adding locales is a one-place change.

## Getting started

Requirements: Node.js ≥ 22.5, pnpm ≥ 9, bun (for server builds only).

```bash
pnpm install
```

### Development

```bash
pnpm dev:server        # API on http://localhost:3300 (health: /api/health)
pnpm dev:web           # web client on http://localhost:5173
pnpm dev:desktop       # desktop client (admin / teacher)
```

### Production build

```bash
pnpm build:server      # standalone binary → apps/server/dist/testing-server
pnpm build:web         # web client → apps/web-client/dist
pnpm build:desktop     # Tauri bundles (.deb / .AppImage / .exe)
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Database schema](./docs/schema.md)
- [API reference](./docs/api.md)
- [Roadmap](./ROADMAP.md)
- [Changelog](./CHANGELOG.md)

## License

MIT (see repository root).