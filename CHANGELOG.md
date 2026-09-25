# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

## [0.1.0] — 2026-09-25

Phase 1 release: the role-based foundation ships as a testable product —
accounts & auth, tests & courses CRUD with materials, and full admin and
teacher UIs in the web client and the desktop app. 35 integration tests green.

### Added
- **Server — accounts & roles (Phase 1)**: `users`/`sessions` tables with role
  (`admin | teacher | student`) and status (`pending | approved | blocked`),
  built-in admin account seeded on first boot (`ADMIN_USERNAME` /
  `ADMIN_PASSWORD` env overrides), password hashing with `node:crypto` scrypt
  (no new dependencies), opaque bearer sessions (SHA-256 at rest, 12 h expiry).
- **Auth API**: `POST /api/auth/register` (students self-register → pending),
  `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- **Admin API**: `GET /api/users` (role/status/search filters),
  `POST /api/users` (create teacher), `PATCH /api/users/:id/status`
  (approve/block, revokes live sessions), `DELETE /api/users/:id`.
- **Admin insights API** (admin only): `GET /api/admin/stats` (schema version,
  DB health, uptime, table counts) and `GET /api/admin/participants` (flat
  course × student enrollment list) — backed by 5 integration tests.
- **Tests & questions API** (`admin`/`teacher`): `GET/POST /api/tests`,
  `GET/PUT/DELETE /api/tests/:id`; embedded questions for all 5 types
  (single choice, multiple choice, true/false, short answer, matching) with
  per-type payload validation; questions are replaced atomically on update.
- **Courses API** (`admin`/`teacher`): `GET/POST /api/courses`,
  `GET/PATCH/DELETE /api/courses/:id`; enroll/unenroll students by username;
  attach/detach tests; raw `application/octet-stream` material upload
  (100 MiB cap, allow-listed MIME) via
  `POST /api/courses/:id/materials?name=<file>`, streamed back through
  `GET /api/courses/:id/materials/:materialId/file`.
- Integration tests covering accounts & auth (13) plus tests/courses CRUD
  incl. file round-trip, cross-teacher isolation and question validation
  (17 more) — **35 total green**.
- **Role-based UI shell** in web-client and desktop: sign-in screen with a
  role picker (student / teacher / administrator), student self-registration,
  per-role dashboards, persisted session restored on start, server-status chip,
  uniform error messages (i18n en/uk).
- **Teacher workbench UI (Phase 2 start)** in web-client and desktop:
  - **Tests tab**: list own tests; full test editor with all five question
    types (correct-answer marking for choices, time limit in minutes, passing
    score), create/edit/delete, per-type client-side validation.
  - **Courses tab**: create/delete courses; course page with students
    (enroll by username, remove), attached tests (attach/detach), and
    materials (file picker uploads raw bytes, download via authenticated fetch).
- **Admin dashboard** in web-client and desktop: live user management with
  search + role/status filters and approve/block; **Participants** tab
  (courses × students with course filter, status badges, enrollment dates);
  **System & DB** tab (server version, uptime, schema version, database
  health, table counts); **create-teacher form** (approved immediately).
- `docs/api.md` and `docs/schema.md` for the new API surface and data model.

### Changed
- **Architecture rewritten around a role-based single product**: one client
  serves Administrator / Teacher / Student, roles are chosen at sign-in;
  topology updated — the admin machine hosts the embedded server, teachers and
  students connect over the LAN; offline mode (cached materials/statistics and
  teacher-side local test drafts) documented in `docs/architecture.md`.
- Roadmap re-scoped to the same vision with a detailed Phase 1 and flexible
  later phases; README updated (roles, topology diagram, offline mode).
- **Desktop**: the v0.0.1 trial demo window (Rust bridge greeting + "sum of
  two numbers", unused `greet` command) removed — the app now opens the same
  role-based sign-in flow; author name stays in the window title.
- Shared `apps/api` layer (typed fetch client, error envelope, token storage)
  between web-client and desktop frontends.

### Fixed
- **`Sign out` now always clears the local session** (web-client + desktop),
  even when the server is unreachable, so it always returns to sign-in.
- **Desktop app reaches the API in production builds**: the built webview runs
  on the Tauri origin, so all API calls (health checks, REST, material
  downloads) now target `http://localhost:3300` explicitly instead of the Vite
  dev proxy; override at build time with `VITE_API_TARGET`. Cross-origin
  requests are served by the existing CORS setup (documented in `docs/api.md`).

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