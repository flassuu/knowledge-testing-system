# AGENTS.md — Agent rules for this repository

> This file is the **single source of truth** for working in this repo.
> Read it fully before starting any task. Re-read it whenever a task touches
> architecture, conventions, or build tooling. If an instruction here
> contradicts a user request, follow this file and ask the user.

## Project overview

Offline classroom knowledge-testing system (course project). A local
client-server suite: a **teacher desktop app** (Tauri 2 + Vue 3), a
**mobile-first student web client** (Vue 3 + PWA), and an embedded
**Node.js REST/WebSocket server** (Fastify + `node:sqlite`) that is compiled
into a single standalone binary with `bun build --compile`.

All code, comments, identifiers, and technical docs are written in **English**.
User-facing UI uses an **i18n** system (`vue-i18n`) — English is the base
locale, Ukrainian is provided out of the box, adding a new locale must be a
one-place change (see web-client/desktop i18n conventions below).

## Repository layout

```
apps/
  server/        Node.js API + WS server (Fastify, node:sqlite, bun-compiled)
  web-client/    Student mobile-first web app (Vite + Vue 3 + Tailwind v4)
  desktop/       Teacher desktop app (Tauri 2 + Vue 3 + Tailwind v4)
docs/            Architecture, DB schema, API reference
```

## Environment

- OS: Arch Linux, dev machine only. Targets: Windows (.exe) and Linux
  (.deb / .AppImage).
- Runtime: Node.js >= 22.5 (uses built-in `node:sqlite`), pnpm >= 9.
- `bun` is used only to compile the server into a standalone binary —
  it is NOT the runtime for anything else.
- Tauri build on Linux requires `webkit2gtk-4.1`
  (`sudo pacman -S webkit2gtk-4.1`) — install when a desktop build is needed.

## Commands (run from repo root)

| Task | Command |
|------|---------|
| Install deps | `pnpm install` |
| Run server (dev) | `pnpm dev:server` |
| Run student web (dev) | `pnpm dev:web` |
| Run desktop (dev) | `pnpm dev:desktop` |
| Build server binary | `pnpm build:server` |
| Build web client | `pnpm build:web` |
| Typecheck all | `pnpm typecheck` |
| Run all tests | `pnpm test` |

## Conventions

- **Package scope:** `@testing-system/*` (`server`, `web-client`, `desktop`).
- **Strict TypeScript** everywhere (`strict: true`), extends `tsconfig.base.json`.
- **No `any`** unless absolutely unavoidable; document why in a comment.
- **Do not add comments** unless they explain non-obvious decisions
  (DIFF conventions: the codebase uses minimal comments).
- Follow existing file layout in each app; mirror sibling files when extending.
- API design is REST + JSON; real-time updates go through WebSocket
  (`@fastify/websocket`), never long-polling.
- IDs are UUIDs (server-side); short join codes are 6 uppercase chars.

## Server rules

- SQLite via `node:sqlite` (`DatabaseSync`). Never add a native driver
  dependency (breaks `bun build --compile`).
- CLI args: `--port`, `--host`, `--data <dir>`, `--webroot <dir>`.
- DB file lives in the `--data` dir. Migrations run idempotently at startup.
- Everything must keep working when compiled to a single binary.

## Frontend rules (web-client & desktop)

- Tailwind CSS **v4** (Vite plugin `@tailwindcss/vite`) — no
  `tailwind.config.js`.
- `vue-i18n`: locales live in `src/i18n/locales/<locale>.ts`; a locale is
  registered by adding one import + one entry in the messages map.
  English is the fallback locale; do not hard-code UI strings.
- Mobile-first: build for narrow screens first, desktop is a progressive
  enhancement (web-client especially).

## Desktop (Tauri) rules

- Tauri **v2**. Rust in `src-tauri/`. Keep Rust minimal, prefer JS.
- The server binary is expected next to the app as a sidecar
  (`bundle.externalBin`) — do not assume a running server during dev;
  handle "server not reachable" states gracefully.

## Git workflow

- Branch `main`, conventional commits
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Commit only when the user asks. Keep the repo history clean;
  no intermediate scaffolding noise.
- Never commit secrets, DB files, or build artifacts (see `.gitignore`).

## Quality gate (run before finishing any task)

1. `pnpm typecheck` passes for each touched package.
2. `pnpm --filter <pkg> test` passes for touched logic.
3. `pnpm build:server` and `pnpm build:web` succeed if server/web touched.
4. No new dependencies without user confirmation.
5. Update `CHANGELOG.md` (Unreleased section) when user-visible behavior changes.