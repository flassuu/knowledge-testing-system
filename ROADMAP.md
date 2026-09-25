# Roadmap

High-level plan toward an MVP. The repository is at **v0.0.1** — the scaffold
phase: a running baseline outside the product domain (tooling, structure,
i18n, CI builds) plus a trial demo window in the teacher app.

Version mapping: each phase ships as a SemVer release.

| Phase | Version | Content |
|-------|---------|---------|
| Phase 0 — Scaffold | **0.0.1** (done) | Monorepo, tooling, docs, CI builds, demo window |
| Phase 1 — Data model & auth | 0.1.0 | DB schema, teacher auth, test/question CRUD |
| Phase 2 — Session runtime | 0.2.0 | Session lifecycle, join flow, answering, WS hub |
| Phase 3 — Reporting | 0.3.0 | Results API, live dashboard, PDF + CSV export |
| Phase 4 — Packaging & polish | 1.0.0 | Sidecar packaging, design pass, tests, README |

## Phase 0 — Scaffold (v0.0.1, done)

- [x] Monorepo + pnpm workspaces + git (branch `main`)
- [x] Agent rules & opencode config (single root `AGENTS.md`)
- [x] Docs: README, CHANGELOG, ROADMAP, architecture, schema, API
- [x] Server: Fastify + health endpoint + SQLite migration runner running
  in `node` and in a `bun build --compile` binary
- [x] Student client: Vite + Vue 3 + Tailwind v4 + i18n (en/uk), mobile-first layout
- [x] Desktop: Tauri 2 window reaching the server health endpoint
- [x] First clean git commit; `pnpm typecheck && pnpm test` green across apps
- [x] CI builds for Linux/Windows; release **v0.0.1** published with `.exe`, `.msi`,
  `.deb`, `.AppImage`; auto-release workflow on `v*` tags

## Phase 1 — Data model & auth (v0.1.0, week 1)

- DB schema: teachers, tests, questions (5 types), sessions, participants,
  answers — [draft schema](./docs/schema.md)
- Teacher auth (login, bearer tokens) and first-run seed account
- CRUD API for tests and questions with validation

## Phase 2 — Session runtime (v0.2.0, week 2)

- Session lifecycle: create → active → paused → finished; join code + QR
- Student join flow (code + name), question delivery, auto-submit on timeout
- Answer submission + scoring engine (points per question + percent)
- WebSocket hub: live participant board on the teacher side

## Phase 3 — Reporting (v0.3.0, week 3)

- Session results API + teacher live dashboard
- Student result screen (if allowed by test settings)
- Report export: PDF (printable) + CSV (spreadsheets), stamped per session

## Phase 4 — Packaging & polish (v1.0.0, week 4)

- Sidecar packaging: server binary + web client bundled into Tauri app
- Windows `.exe` and Linux `.deb` / `.AppImage` builds
- Design pass (Tailwind theme), empty/loading/error states, seed demo data
- Tests: server scoring unit tests, API integration tests, student flow e2e
- GitHub-ready README (screenshots, badges), license

## Out of scope (v1)

- Multi-teacher sync, cloud hosting, account registration
- Question bank sharing/import (non-functional)
- Anti-cheating measures beyond answer locking