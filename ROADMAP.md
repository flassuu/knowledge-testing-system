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

## Phase 1.1 — UI/UX polish (v0.1.1, almost done)

Nothing new server-side: make everything 0.1.0 already ships feel finished.
Released as a separate minor so the polish sprint never blocks Phase 2.

Batches 1–8 are in. The two items still open below (component consistency
pass, desktop About dialog) are visual work — they need a real screen and
window to judge, so they wait for a dedicated pass rather than a blind refactor.

### Design rules (binding)

These rules apply to every screen of web-client and desktop. No exceptions.

1. **No emoji in the UI.** Icons come from Lucide (`@lucide/vue`) only —
   never paste an emoji or decorative glyph into markup, buttons, placeholders
   or labels. The single exception is user-authored content (e.g. a material
   title), which is rendered as-is.
2. **One cohesive style, modelled on Material 3 Expressive**: rounded shape
   scale (cards `rounded-2xl`, controls `rounded-xl`, chips pill), tonal
   surfaces instead of flat white, and short expressive motion (150–250 ms)
   on state changes.
3. **Colour only through semantic theme tokens** (`bg-surface`,
   `text-on-surface`, `bg-primary`, …), never raw palette classes
   (`bg-slate-800`, `text-rose-600`, …), so light and dark both work.
4. **Exactly two themes: light and dark.** No extra palettes, no per-component
   hard-coded colours.

**Design system & states**
- [ ] Consistency pass: shared spacing/typography tokens, one set of
      buttons/cards/badges/inputs (drop ad-hoc Tailwind class soup)
- [x] Light/dark theming: semantic M3 Expressive token layer in Tailwind v4
      (`@theme inline` + `:root`/`.dark`), class-based dark on `<html>`,
      theme switcher in every header, system preference as first-run default,
      persisted choice with an anti-flash boot script, global `:focus-visible`
      ring and `prefers-reduced-motion` guard
- [x] State coverage: shared `<EmptyState/>` (icon, title, hint, optional
      call-to-action) and `<SkeletonList/>` (card + table variants, pulse) on
      every list — tests, courses, course details, users, participants,
      system stats and the boot screen; inline error alerts kept per screen
- [x] Global toast notifications (success/error) via a shared, dependency-free
      `useToast()` + `<ToastHost/>` (tests, courses, students, materials, user
      actions), plus an app-wide offline banner and a "server is back" toast
      driven by one shared health-poll composable

**Sign-in & auth UX**
- [x] Enter-to-submit, "show password" toggle, remember the last username
      and role, autocomplete attributes — the role picker switches instantly
      without a page reload
- [x] One-click role switching (no reload); focus management after
      login/logout still open

**Admin dashboard**
- [x] Confirm dialog before blocking a user (Users tab)
- [x] Users/Participants as sortable tables on wide screens (cards stay on
      narrow) with result counts and `aria-sort` on the headers
- [x] Bulk approve of pending students: row checkboxes, select-all-pending,
      one-click approval with a toast; confirm dialog guards blocking

**Teacher workbench**
- [x] Confirm dialogs before destructive deletes: test, course, remove
      student, detach test (material delete UI not implemented yet)
- [x] Editor ergonomics: duplicate a question, move questions up/down, and a
      live test preview (student view with the correct answers highlighted)
      before saving
- [x] Course page: searchable test-attach picker (type, question count and
      time limit per row, no more bare `<select>`) and material rows with a
      file-type badge resolved from MIME type with an extension fallback

**A11y, i18n & desktop**
- [x] Accessibility pass: focus rings actually visible again (the `outline-none`
      utility was beating the global `:focus-visible` ring), `aria-label` on every
      icon-only control and on all 14 placeholder-only form controls, keyboard
      focus trap + focus restore in both dialogs, contrast audit of all 15
      bg/text token pairs in both themes (all ≥ 4.5:1)
- [x] i18n hygiene: last hardcoded strings (server-status tooltip) moved into
      the locales, `<html lang>` synced to the active locale, locale choice
      persisted
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

- [x] Session lifecycle (create → active → paused → finished) with a 6-character
      join code (no ambiguous 0/O or 1/I glyphs) and snapshots of the test's time
      limit and pass mark
- [x] Student join flow; deterministic per-student question shuffle that
      survives a reload, with every answer key stripped from the payload
- [x] Scoring engine (points + percent) as pure functions over all five
      question types, with unit tests
- [x] Auto-submit on timeout, enforced both in the client clock and by a
      server-side sweep on every entry point that grades or closes a session
- [x] Student UI: code entry, the paper with all five input types, a
      server-corrected countdown, submit with confirmation, graded result with
      a per-question breakdown
- [x] Teacher side UI: start a session from a test, join code shown large with
      a copy button, participant board (polling every 4s) with working markers,
      percentages and pass badges, pause / resume / finish with confirmation
- [ ] WebSocket hub so the participant board updates without polling
- [ ] QR code for the join link

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