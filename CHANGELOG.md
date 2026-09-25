# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

## [Unreleased]

### Added
- **Server — tests & courses (data model + CRUD)**: migration v3 adds
  `tests`, `questions`, `courses`, `course_enrollments`, `course_tests`,
  `materials` with full domain validation.
- **Tests API** (`admin`/`teacher`): `GET/POST /api/tests`,
  `GET/PUT/DELETE /api/tests/:id`; embedded questions for all 5 types
  (single choice, multiple choice, true/false, short answer, matching) with
  per-type payload validation; questions are replaced atomically on update.
- **Courses API** (`admin`/`teacher`): `GET/POST /api/courses`,
  `GET/PATCH/DELETE /api/courses/:id`; enroll/unenroll students by username
  (`POST /api/courses/:id/enrollments`, `DELETE .../:userId`); attach/detach
  tests (`POST /api/courses/:id/tests`, `DELETE .../:testId`).
- **Material uploads**: raw `application/octet-stream` files (no multipart /
  native deps) via `POST /api/courses/:id/materials?name=<file>` —
  100 MiB cap, allow-listed MIME types — streamed back through
  `GET /api/courses/:id/materials/:materialId/file`.
- Integration tests for tests & courses CRUD incl. file round-trip,
  cross-teacher isolation, and question payload validation (17 tests green).
- **Frontend fix**: `Sign out` now clears the local session even when the
  server is unreachable, so the button always returns to the sign-in screen
  (web-client + desktop).
- **Teacher workbench UI (Phase 2 start)** in web-client and desktop:
  - **Tests tab**: list own tests; full test editor with all five question
    types (single/multiple choice with correct-answer marking, true/false,
    short answer, matching pairs), time limit (minutes) and passing score
    settings; create, edit, delete; per-type client-side validation.
  - **Courses tab**: create/delete courses; course page with students
    (enroll by username, remove), attached tests (attach/detach), and
    materials (file picker uploads raw bytes, download back through an
    authenticated fetch).

### Changed
- **Role-based UI shell (Phase 1)** in web-client and desktop: sign-in screen
  with a role picker (student / teacher / administrator), student
  self-registration, per-role dashboards, persisted session restored on start,
  server-status chip, uniform error messages (i18n en/uk).
- Admin dashboard with live user management: search + role/status filters,
  approve pending students, block/unblock accounts (wired to the new API).
- Teacher and student dashboards with placeholders for the upcoming phases
  (test/course builder, live sessions, reports).
- `apps/api` layer (typed fetch client, error envelope, token storage) shared
  between web-client and desktop frontends.
- **Server — accounts & roles foundation (Phase 1)**: `users`/`sessions`
  tables with role (`admin | teacher | student`) and status
  (`pending | approved | blocked`); built-in admin account seeded on first
  boot (`ADMIN_USERNAME` / `ADMIN_PASSWORD` env overrides); password hashing
  with `node:crypto` scrypt (no new dependencies); opaque bearer sessions
  (SHA-256 at rest, 12 h expiry).
- Auth API: `POST /api/auth/register` (students self-register → pending),
  `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Admin API: `GET /api/users` (filters: role/status/search),
  `POST /api/users` (create teacher), `PATCH /api/users/:id/status`
  (approve/block, revokes live sessions), `DELETE /api/users/:id`.
- Uniform error envelope `{ "error": { "code", "message" } }` across routes.
- Integration tests covering the full accounts & auth flow (13 tests green).

### Changed
- **Desktop**: the v0.0.1 trial demo window (Rust bridge greeting + "sum of two
  numbers", unused `greet` command) was removed — the desktop app now opens
  the same role-based sign-in flow; author name stays in the window title.
- **Architecture rewritten around a role-based single product**: one client
  serves Administrator / Teacher / Student, roles are chosen at sign-in.
  Topology updated — the admin machine hosts the embedded server; teachers and
  students connect over the LAN; offline mode (cached materials/statistics and
  teacher-side local test drafts) documented in `docs/architecture.md`.
- Roadmap re-scoped to the same vision with a detailed Phase 1
  (data model, accounts & roles, auth, admin base) and flexible later phases.
- README updated: roles section, new topology diagram, offline mode.
- `docs/api.md` documents the Phase 1 auth & user-management endpoints.

### Added (docs)
- New `docs/schema.md` draft: role/status model (`users`, admin seed), courses,
  materials, tests, questions (5 types), sessions, participants, answers.

## [0.0.1] — 2026-09-10

### Added
- **Project creation**: monorepo scaffold (pnpm workspaces) with three apps:
  `apps/server`, `apps/web-client`, `apps/desktop`.
- Agent rules and opencode config (root `AGENTS.md`).
- Project docs: README, CHANGELOG, ROADMAP, architecture, API reference.
- Server foundation: Fastify app with `GET /api/health`, SQLite bootstrap via
  `node:sqlite` (`DatabaseSync`), idempotent migration runner, CLI args
  (`--host`, `--port`, `--data`, `--webroot`), compiled to a standalone
  single binary with `bun build --compile`.
- Student client foundation: Vite + Vue 3 + Tailwind v4 + i18n (en/uk),
  mobile-first home view with server status check.
- Desktop foundation: Tauri 2 + Vue 3, i18n (en/uk).
- **Trial demo window** in the desktop app: «sum of two numbers» with a Test
  button and the author's name (ПІБ) in the window title, localized per locale.
- GitHub Actions: build workflow (`build-desktop.yml`) producing Linux
  (`.deb` / `.AppImage`) and Windows (`.msi` / `.nsis`) bundles with artifact
  upload; auto-release workflow (`release.yml`) triggered by `v*` tags.
- ✅ Production bundles built in CI for v0.0.1: `.exe` (NSIS), `.msi` (WiX),
  `.deb`, `.AppImage` — published in [GitHub Release v0.0.1].
- Local Linux verification: `.deb` and `.AppImage` built and launched on Arch.

### Fixed
- Server standalone binary: resolve the data/webroot dir from
  `process.execPath`, not `import.meta.dir` (which is `$bunfs` inside the
  compiled binary).
- Linux AppImage bundling on Arch: needs `patchelf` and `NO_STRIP=true`
  (linuxdeploy fails on `.relr.dyn` sections otherwise).
- Renamed Tauri lib crate so `main.rs` resolves the correct lib target.
- Desktop Vite config: dropped `build.target` (rolldown-vite requires
  `esbuild`, which is not installed).
- CI Linux build: removed `libappindicator3-dev` (conflict with
  `libayatana-appindicator3-dev` → "held broken packages").
- CI artifacts: switched to `tauri-apps/tauri-action@v1` with
  `uploadWorkflowArtifacts: true` (the old `uploadArtifacts` input did nothing).
- Linux AppImage blank white window on Mesa 26 + Wayland: launcher
  `scripts/run-linux-appimage.sh` sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` and
  preloads the system `libwayland-client.so` (bundled one is ABI-incompatible
  with Mesa 26).

[GitHub Release v0.0.1]: https://github.com/flassuu/knowledge-testing-system/releases/tag/v0.0.1