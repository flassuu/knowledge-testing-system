# Roadmap

Offline-first, role-based knowledge-testing system (admin / teacher / student).
Progress is tracked as SemVer releases; the phase plan is deliberately
**flexible** — only Phase 1 is broken down in detail, later phases are refined
while development proceeds.

| Phase | Version | Goal |
|-------|---------|------|
| Phase 0 — Scaffold | **0.0.1** (done) | Monorepo, tooling, docs, CI, demo window |
| Phase 1 — Foundation | **0.1.0** (done) | Data model, accounts & roles, auth, admin base |
| Phase 1.1 — UI/UX polish | **0.1.1** (next) | Design & feedback pass over what 0.1.0 already ships |
| Phase 2 — Teacher workbench | 0.2.0 | Test/course authoring, sharing, offline drafts |
| Phase 3 — Session runtime | 0.3.0 | Live testing: join, answer, score, WS board |
| Phase 4 — Reporting | 0.4.0 | Statistics, journals, PDF + CSV export |
| Phase 5 — MVP polish | 1.0.0 | Student UX, packaging, tests, README |

## Phase 0 — Scaffold (v0.0.1, done)

- [x] Monorepo + pnpm workspaces + git (`main`)
- [x] Server binary, health endpoint, migration runner (node + bun-compiled)
- [x] Web client & desktop foundations, i18n (en/uk), CI builds, release v0.0.1

## Phase 1 — Foundation (v0.1.0, done)

**Data model ([docs/schema.md](./docs/schema.md))**
- [x] `users` with role enum (`admin | teacher | student`) and status
      (`pending | approved | blocked`), built-in admin seed
- [x] `sessions` — opaque bearer tokens, SHA-256 hashed at rest
- [x] `courses`, `course_enrollments`, `course_tests`, `materials` (files)
- [x] `tests`, `questions` (5 types) — live-run `sessions`, `participants`,
      `answers` land with Phase 3

**Accounts & auth**
- [x] Register/login endpoints; password hashing (scrypt, no deps); role-scoped bearer tokens
- [x] Admin creates teachers; student self-registration + approval workflow
- [x] Role-based UI shell in web + desktop: role picker on sign-in, login/register
      screens, per-role dashboards; token persisted, restores session on start

**Admin basics**
- [x] Admin panel: users management (list, filters, approve/block) in the UI
- [x] Participants list (courses × enrolled students) & DB health views
      (schema version, table counts, uptime) in the admin UI
- [x] First-run bootstrap: seed admin account (server + UI login with it)

**Tests & courses (CRUD)**
- [x] Test/question CRUD with per-type payload validation (5 question types)
- [x] Course CRUD + material upload (static files, no multipart deps)
- [x] Admin insights: DB health (+ table counts) and participants list
- [ ] Import/export share format (JSON) — Phase 2 authoring

## Phase 1.1 — UI/UX polish (v0.1.1, next)

Nothing new server-side: make everything 0.1.0 already ships feel finished.
Released as a separate minor so the polish sprint never blocks Phase 2.

**Design system & states**
- [ ] Consistency pass: shared spacing/typography tokens, one set of
      buttons/cards/badges/inputs (drop ad-hoc Tailwind class soup)
- [ ] State coverage everywhere: empty states with a call-to-action
      (e.g. "no tests yet → Create test"), loading skeletons, inline errors
- [ ] Global toast notifications (success/error) instead of throwaway inline
      alerts; offline banner when the server goes away mid-session

**Sign-in & auth UX**
- [ ] Enter-to-submit, "show password", remember the last username,
      autocomplete attributes, focus management after login/logout
- [ ] Keep the role picker fast: one click to switch role, no page reload

**Admin dashboard**
- [ ] Users/Participants as proper tables on desktop widths (cards stay for
      narrow) with sortable columns and result counts
- [ ] Bulk approve of pending students; confirm dialogs before block/delete

**Teacher workbench**
- [ ] Confirm dialogs before any destructive delete (test, course, material)
- [ ] Editor ergonomics: duplicate a question, reorder questions, live test
      preview before saving
- [ ] Course page: clearer test-attach picker and file list with type badges

**A11y, i18n & desktop**
- [ ] Visible focus rings, aria-labels on icon-only controls, contrast and
      reduced-motion pass
- [ ] i18n hygiene: move the remaining hardcoded strings (tooltips, titles)
      into locales; persist the chosen locale
- [ ] Desktop: About dialog with version, remember window size/position,
      cleaner window title; verify admin/teacher screens at 1080×720
- [ ] Web/mobile QA of admin & teacher screens served over LAN on narrow widths

## Phase 2 — Teacher workbench (v0.2.0, in progress)

- [x] Test authoring UX — list + full editor for all 5 question types in the
      teacher dashboard (web-client & desktop)
- [x] Course builder: create courses, attach/detach tests, enroll students,
      upload and download materials
- [ ] Test duplication & sharing (JSON import/export)
- [ ] Offline authoring: local drafts that sync when the server is reachable

## Phase 3 — Session runtime (v0.3.0, flexible)

- Session lifecycle (create → active → paused → finished), join code + QR
- Student join flow; deterministic per-student question shuffle
- Scoring engine (points + percent); auto-submit on timeout
- WebSocket hub: live participant board on the teacher side

## Phase 4 — Reporting (v0.4.0, flexible)

- Results API + teacher live dashboard; grade journals
- Student result screen (per test settings)
- Report export: PDF (printable) + CSV (spreadsheets) per session

## Phase 5 — MVP polish (v1.0.0, flexible)

- Sidecar packaging; offline PWA caching polish
- Design pass, empty/loading/error states, seed demo data
- Server scoring unit tests, API integration tests, student flow e2e
- GitHub-ready README, screenshots, badges

## Out of scope (v1)

- Multi-admin sync, cloud hosting, account recovery
- Question bank sharing/import, forums, anti-cheat beyond answer locking