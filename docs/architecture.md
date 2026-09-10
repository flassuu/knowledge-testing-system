# Architecture

Goal: run a full knowledge test in a classroom with **zero dependence on the
internet**. Everything runs on the teacher's computer; students connect
through the local network.

## Topology

```
┌──────────────────────────────┐
│ Teacher desktop app (Tauri2) │
│  - test builder UI           │
│  - session control           │
│  - live results board        │
└──────────────┬───────────────┘
               │ spawns & owns
               ▼
┌──────────────────────────────┐
│ Local server (single binary) │  Fastify + node:sqlite + WebSocket
│  - REST API                  │
│  - realtime hub (WS)         │
│  - static student client     │
│  - report generation         │
└──────────────┬───────────────┘
               │ HTTP/WS on LAN 0.0.0.0:3300
               ▼
┌──────────────────────────────┐
│ Students (browsers)          │  phones / classroom PCs,
│  - join with 6-char code/QR  │  no install required
│  - answer on mobile UI       │
└──────────────────────────────┘
```

## App layering

### `apps/server` — Node.js API server

- **Framework:** Fastify (v5). Plugins: `@fastify/cors`, `@fastify/static`,
  `@fastify/websocket`.
- **Storage:** SQLite via the built-in `node:sqlite` module — zero native
  dependencies, so the server can be compiled into a single executable with
  `bun build --compile`. DB file: `<data-dir>/app.db`.
- **Migration:** idempotent, versioned migrations run at startup (see
  `src/lib/db.ts`).
- **Packaging:** standalone binary (`testing-server` / `testing-server.exe`),
  no Node.js required on the target machine. The teacher app runs it as a
  Tauri sidecar at production; during development it is started separately.
- **CLI:** `--host`, `--port`, `--data <dir>`, `--webroot <dir>`.

### `apps/web-client` — student client

- Vite + Vue 3 + TypeScript + Tailwind CSS v4, mobile-first.
- i18n (`vue-i18n`): base **en**, **uk** included; locales are plain modules
  in `src/i18n/locales/`, registered in `src/i18n/index.ts`.
- Production: compiled into static files and served by the server itself, so
  students need nothing but a browser.
- Development: Vite dev server with `/api` and `/ws` proxied to the local API.

### `apps/desktop` — teacher client

- Tauri 2 (Rust core + Vue 3 frontend), same i18n conventions.
- Connects to the local API/WS; in dev the server runs separately, in
  production it is spawned as a sidecar binary kept next to the app.
- Minimal Rust: only bridge commands; logic lives in TypeScript.

## Communication

| Flow | Channel |
|------|---------|
| Teacher ↔ Server (CRUD, session control, results) | REST `/api/*`, Bearer token |
| Student → Server (join, submit answers) | REST `/api/*`, participant token |
| Server → Teacher (live: joins, answers, finishes) | WebSocket `/ws` |
| Student ↔ Server (session state, time) | REST polling (cheap, LAN scale) |

## Data flow (end-to-end)

1. Teacher creates a test (questions + settings) in the desktop app.
2. Teacher starts a **session** — server issues a 6-character join code → QR.
3. Students open the teacher's LAN address, enter code + name → `participant` row.
4. Server serves questions (order shuffled deterministically per student).
5. Answers are scored server-side and streamed live to the teacher over WS.
6. On finish, teacher exports a report (PDF/CSV/HTML — format TBD in Phase 3).

## Cross-platform packaging

- **Server:** `bun build --compile` → native binary per platform, built on
  that platform (Linux: here; Windows: CI or cross build).
- **Desktop:** `tauri build` → `.deb` / `.AppImage` (Linux),
  `.msi` / `.nsis` (Windows).
- **Student client:** static files inside the server binary bundle; update by
  replacing the binary.

## Security model (LAN trust)

- Offline classroom LAN: participants hold per-session tokens, teacher uses
  bearer tokens. No TLS (out of scope for v1); origin/CORS is open to the LAN.
- Passing grade and anti-cheat measures documented in the roadmap.

See: [Database schema](./schema.md), [API reference](./api.md).