# Roadmap

High-level plan toward an MVP in ~4 weeks. The current repository is the
**scaffold phase** — a running baseline outside the product domain, to lock in
tooling, structure, i18n, and CI-friendly builds before product work begins.

## Phase 0 — Scaffold (baseline, in progress)

- [x] Monorepo + pnpm workspaces + git (branch `main`)
- [x] Agent rules & opencode config
- [x] Docs: README, CHANGELOG, ROADMAP
- [ ] Server: Fastify + health endpoint + SQLite migration runner running
  in `node` and in a `bun build --compile` binary
- [ ] Student client: Vite + Vue 3 + Tailwind v4 + i18n (en/uk), mobile-first layout
- [ ] Desktop: Tauri 2 window reaching the server health endpoint
- [ ] First clean git commit; `pnpm typecheck && pnpm test` green across apps

## Phase 1 — Data model & auth (week 1)

- DB schema: teachers, tests, questions (5 types), sessions, participants,
  answers — [draft schema](./docs/schema.md)
- Teacher auth (login, bearer tokens) and first-run seed account
- CRUD API for tests and questions with validation

## Phase 2 — Session runtime (week 2)

- Session lifecycle: create → active → paused → finished; join code + QR
- Student join flow (code + name), question delivery, auto-submit on timeout
- Answer submission + scoring engine
- WebSocket hub: live participant board on the teacher side

## Phase 3 — Reporting (week 3)

- Session results API + teacher live dashboard
- Student result screen (if allowed by test settings)
- Report export (format TBD — PDF/CSV/HTML) stamped per session

## Phase 4 — Packaging & polish (week 4)

- Sidecar packaging: server binary + web client bundled into Tauri app
- Windows `.exe` and Linux `.deb` / `.AppImage` builds
- Design pass (Tailwind theme), empty/loading/error states, seed demo data
- Tests: server scoring unit tests, API integration tests, student flow e2e
- GitHub-ready README (screenshots, badges), license

## Out of scope (v1)

- Multi-teacher sync, cloud hosting, account registration
- Question bank sharing/import (non-functional)
- Anti-cheating measures beyond answer locking