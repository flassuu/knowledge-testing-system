# Roadmap

Offline-first, role-based knowledge-testing system (admin / teacher / student).
Progress is tracked as SemVer releases; each phase lists what it owes, and the
checklist is the honest state of it — an item is only ticked when it is done and
verified, not when it is planned.

| Phase | Version | Goal |
|-------|---------|------|
| Phase 0 — Scaffold | **0.0.1** (done) | Monorepo, tooling, docs, CI, demo window |
| Phase 1 — Foundation | **0.1.0** (done) | Data model, accounts & roles, auth, admin base |
| Phase 1.1 — UI/UX polish | **shipped in 0.2.0** | Design & feedback pass over what 0.1.0 already ships |
| Phase 2 — Teacher workbench | **0.2.0** (done) | Test/course authoring and sharing |
| Phase 3 — Session runtime | **0.3.0** (done) | Live testing: join, answer, score, WS board |
| Phase 4 — Reporting | 0.4.0 (done) | Statistics, journals, printable + CSV export |
| Phase 5 — Deployment | **0.5.0** (next) | The three ways it has to run: desktop host, school server, classroom without an admin |
| Phase 6 — MVP polish | 1.0.0 | Packaging polish, e2e, screenshots, offline PWA |

The UI/UX polish pass (originally planned as its own 0.1.1) shipped together
with Phase 2 as **0.2.0** — separating them would have meant a release that
only restyled the same screens.

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
- [x] Import/export share format (JSON) — Phase 2 authoring

## Phase 1.1 — UI/UX polish (done; revisited in v0.4.2)

Nothing new server-side: make everything 0.1.0 already ships feel finished.
Planned as its own 0.1.1, released as part of 0.2.0 together with Phase 2; the
two items that needed a real screen to judge — the component consistency pass and
the desktop About dialog — landed later, the dialog in 0.4.0 and the pass in
0.4.1.

**Revisited in v0.4.2**, because the remaining complaint was not a missing
feature but a wrong one: button sizes followed the language, the Ukrainian login
screen scrolled sideways, and the motion was ad-hoc. What changed: fixed control
geometry from tokens (36/40/48px, square icon buttons, equal-width tabs),
Material 3 Expressive motion tokens with `prefers-reduced-motion` respected, a
language menu with drawn flags instead of two text buttons, text cut to what is
actually needed, and the project renamed **LANtern** with placeholder artwork and
a documented format list for web, PWA and desktop.

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
- [x] Consistency pass: one set of buttons, cards and text fields —
      `AppButton` (66 call sites), `AppCard` (44) and `AppInput` (15). What is
      deliberately *not* a component stays a raw element: text links, table
      sort headers, clickable rows and tab strips do not look like buttons, so
      they should not act like one. Badges were left as they are - they are
      already one component (`MaterialBadge`) plus a handful of chips whose
      tones differ per screen
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
- [x] Desktop: About dialog with the app version and the server it talks to,
      window size/position remembered across restarts, a plain window title
      instead of one with a name in it, and the window permissions it needs
- [x] Web/mobile QA of admin, teacher and student screens at 320, 390, 768px
      (and the desktop at 800×560 and 1080×720), measured in a real browser:
      no horizontal scroll, no touch target under 30px, no unnamed control.
      This found and fixed the 24px header chips, the 28px primary actions and
      a header that scrolled sideways at 320px

## Phase 2 — Teacher workbench (v0.2.0, done)

- [x] Test authoring UX — list + full editor for all 5 question types in the
      teacher dashboard (web-client & desktop)
- [x] Course builder: create courses, attach/detach tests, enroll students,
      upload and download materials
- [x] Test duplication & sharing: `Duplicate` per test (fresh question ids, so
      editing the copy cannot touch the original), `GET /api/tests/:id/export`
      writes a file with no ids and no owner but with the answer keys, and
      `POST /api/tests/import` reads it back
- [x] Offline authoring: a save that cannot reach the server becomes a local
      draft, listed with the tests; drafts upload themselves when the server
      answers again, and a rejected draft keeps its place for the next attempt

## Phase 3 — Session runtime (v0.3.0, done)

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
- [x] WebSocket hub: `GET /ws/sessions/:id` streams status to everyone and the
      participant board to the teacher, pushed on every join, submit, pause,
      resume, finish and timeout sweep; the client falls back to polling when
      the socket cannot be opened
- [x] Join link: the teacher copies a `?join=CODE` link, which fills the code in
      on the student's phone; a scannable QR code for the same link is part of
      Phase 4

## Phase 4 — Reporting (v0.4.0, done)

- [x] Grade journal per test: one row per student across every session of that
      test (attempts, best, last and average percent), class average and pass
      rate judged on each student's last attempt, so someone who improved since
      the first try is not counted as a fail
- [x] Per-question difficulty across every attempt, with the questions most of
      the class missed called out at the top of the report
- [x] Student side: the courses the student is enrolled in with their materials,
      the result of every finished attempt on the home screen, and the QR code
      on the teacher's board to join a session
- [x] CSV export per session (`GET /api/sessions/:id/results.csv`), fetched with
      the bearer token rather than a plain link, UTF-8 BOM and escaped fields so
      spreadsheets open non-ASCII names correctly
- [x] Printable report: the journal screen prints through the browser's own
      dialog with the app chrome dropped and the theme collapsed to ink on
      white (no PDF library needed)
- [x] Tag `v0.4.0` and publish the release

## Phase 5 — Deployment (v0.5.0, next)

The three ways the system is actually used, made to work end to end. Today the
middle one works if the teacher happens to open the web client on the LAN
address, and the other two do not work at all — see
[docs/scenarios.md](./docs/scenarios.md) for the runbook of each.

### 5.1 Reachability — the address students can actually open

**Done.** The join link used to be built from `window.location.href`, which is
`tauri://localhost` in the desktop app and `http://localhost:3300` in a browser
on the teacher's machine: a phone can open neither, so the QR code used to be
decorative. The address is now a server setting, the QR carries it, the teacher's
tab prints it, and it says so when the address is one no phone can reach.

- [x] `publicBaseUrl` server setting, kept in `app_meta` (key/value exists, so
      no schema migration). `GET /api/settings` (auth) and `PATCH /api/settings`
      (admin) with validation: absolute http(s), no path, no trailing slash
- [x] Server reports the LAN addresses it sees (`os.networkInterfaces`) as
      suggestions; the admin can accept one or type their own
- [x] `joinLink()` moved out of the component into a pure function that prefers
      `publicBaseUrl` and falls back to the current origin — unit tested both ways
- [x] Teacher's Live tab shows which address is in the QR, and says so plainly
      when it is `localhost` or `0.0.0.0` ("students cannot reach this")
- [x] Students keep working when the address is wrong: the code can always be
      typed by hand, and the copy-link button copies the LAN address, not the
      origin of the window

### 5.2 Classroom with a key — a teacher who is not an admin

**Done.** A self-registered student was `pending`, could not log in (403), and
only an admin could approve — so in a classroom, where the teacher is alone,
nobody got in. The fix was not more power for teachers: it is a scoped key. A
class key approves a student account and nothing else; a teacher still cannot
touch a user, another teacher's class, or anything an admin holds.

- [x] Table `classrooms` (migration v5): owner, name, `key` (6 chars, the same
      unambiguous alphabet as join codes, unique), status `active | revoked`,
      optional `course_id` for auto-enrolment, timestamps
- [x] Teacher API: create, list own, rename, revoke, regenerate the key, delete
- [x] `GET /api/classrooms/preview?key=` — public, validates a key without
      creating anything, so the register screen can say "Class 9A · Olena M."
- [x] `POST /api/auth/register` accepts an optional `classKey`: a valid key
      creates the account **approved** and records the classroom; an invalid one
      is a clear 400 and the account stays `pending` as before
- [x] Teacher UI: "My classes" with the key as text and as a QR of the
      registration link (`?class=KEY`), the students who came in through it, and
      revoke/regenerate/delete
- [x] Register screen gets an optional class-code field; students who already
      have an account are unaffected
- [x] Tests: key generation and uniqueness, approve-on-valid, reject-on-invalid
      and on revoked, a teacher cannot see or revoke another's class, auto-
      enrolment into the linked course, and that a key never grants teacher rights

### 5.3 The server console — one implementation, three surfaces

**Done, except the desktop view (5.4).** The headless server used to write pino
JSON with no interactive control, and the desktop app had no log view at all. A
teacher running the server in a school computer room needs to see what it is
doing and be able to act without a second machine, so there is now one log stream
with three readers — the terminal, the ring buffer and the live tail — and a
console that acts through the same library functions the API calls.

- [x] Human-readable log lines (level colour, aligned, relative time) when
      stdout is a TTY, unchanged JSON when piped — so `systemd` and CI still work
- [x] Interactive commands on stdin when a TTY, acting through the same
      functions the HTTP API uses: `help`, `status`, `sessions`, `users`,
      `students [pending]`, `approve`, `block`, `password`, `level`, `clear`,
      `stop`. Disabled by `--no-console`, skipped automatically when piped
- [x] In-memory ring buffer of recent lines + `WS /ws/server` (admin only) and
      `GET /api/logs?since=` so the desktop and the web admin can follow the
      same stream live
- [x] Admin "Server" tab in the web client: live console, server status, and the
      same actions as API calls (approve a student, stop the server)
- [ ] Restart is deliberately *not* an API call: only the desktop, which owns the
      process, can bring it back. *(The decision is implemented — there is no such
      endpoint, and the Server tab says restart happens at the machine; the
      desktop side of it is 5.4.)*
- [x] Tests: the formatter (TTY vs piped), the command parser and its
      permissions, the ring buffer's ordering and trimming

### 5.4 The desktop app as a host

**Done.** `src-tauri/src/lib.rs` used to be six lines with one plugin: no sidecar,
no spawn, no console, no settings — the scenario the whole project was imagined
for did not exist. The app now carries the server as a sidecar, starts it, shows
its output, and keeps its settings; `src-tauri/src/host.rs` spawns it with
`std::process` and knows nothing about Tauri, which is what lets its tests start a
real server.

- [x] Bundle the server binary as a sidecar (`bundle.externalBin`) and spawn it
      from a small Rust module (`std::process::Command` + piped stdout → Tauri
      events — no new dependency), with stop/restart and an exit code surfaced
- [x] Console view in the desktop app: colourised, auto-scrolling, filterable by
      level, copy and clear, start/stop/restart, "open in browser" with the LAN
      address
- [x] Settings view: data dir, port, admin password, public address — persisted
      locally, applied on restart
- [x] The desktop API base stops being a build-time constant (`VITE_API_TARGET`)
      and follows the settings, so changing the port does not need a rebuild
- [x] First run: defaults + "Start", and a clear message when the bundled binary
      is missing (a dev build) with the path that was looked for
- [x] Packaging: the sidecar is renamed per platform in CI, and a dev build can
      point at a locally built binary

### 5.5 Making it verifiable

- [x] `docs/scenarios.md`: the runbook for all three scenarios, including what
      each needs, how to try it by hand, and how to tell it worked
- [ ] The browser harness (headless Firefox over WebDriver BiDi, already used
      during development) kept as a dev script with the checks it runs: overflow,
      tap targets, and one happy path per role
- [ ] A CI smoke step for the console: start the binary, send one command on
      stdin, assert the output, and that `--no-console` starts clean

## Phase 6 — MVP polish (v1.0.0)

- [x] Server unit and integration tests: scoring over all five question types,
      the grade journal and CSV export, the session runtime, auth and the role
      boundaries (104 tests)
- [x] Client tests for the logic worth testing: the session clock and answer
      payloads, the QR generator, the download helper, the offline drafts, and an
      i18n catalogue check that compiles both locales (45 tests)
- [x] GitHub-ready README: what the project is, the three roles, the topology,
      headless install with the CLI flags, badges
- [ ] Seed demo data, so a fresh install can be shown without typing anything in
- [ ] Screenshots in the README (teacher workbench, live board, journal, student)
- [ ] Browser e2e for the student flow: join → answer → submit → result
- [ ] Offline PWA caching polish: a manifest and a service worker, so a phone can
      install the client and a room without Wi-Fi still shows what it has

## Out of scope (v1)

- Multi-admin sync, cloud hosting, account recovery
- Question bank sharing/import, forums, anti-cheat beyond answer locking
