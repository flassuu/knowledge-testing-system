# Knowledge Testing System

Offline classroom knowledge-testing suite — a local client-server system for
running tests in a computer lab with **no internet access**.

> Course project. Works fully on a LAN; nothing leaves the classroom network.

## What's inside

| App | Tech | Purpose |
|-----|------|---------|
| `apps/server` | Node.js, Fastify, SQLite (`node:sqlite`), WebSocket | Embedded REST API + real-time session server; compiled to a single standalone binary |
| `apps/web-client` | Vue 3, TypeScript, Tailwind CSS v4, PWA | Mobile-first student client: join a session by code/QR, answer questions in a browser |
| `apps/desktop` | Tauri 2, Vue 3, Tailwind CSS v4 | Teacher app: create tests, run sessions, watch results live, export reports |

## Architecture

```
   Teacher (desktop app)
          │  spawns & talks to
          ▼
   Local server (single binary: Fastify + SQLite)
          │  HTTP/WS on LAN (0.0.0.0:3300)
          ▼
   Students (browsers: phones / PCs via join code or QR)
```

- **No external internet required** — server + DB + web client are served
  from the teacher's machine.
- Real-time updates are pushed over WebSocket (no polling).
- The server serves the built student web client as static files and is
  compiled into one executable, so the teacher's machine needs **no Node.js,
  no database installation** — just the single app bundle.
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
pnpm dev:web           # student web client on http://localhost:5173
pnpm dev:desktop       # teacher desktop app
```

### Production build

```bash
pnpm build:server      # standalone binary → apps/server/dist/testing-server
pnpm build:web         # student client → apps/web-client/dist
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