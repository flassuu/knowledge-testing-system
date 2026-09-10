# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-09-10

### Added
- Monorepo scaffold (pnpm workspaces): `apps/server`, `apps/web-client`, `apps/desktop`.
- Agent rules and opencode config (root `AGENTS.md`).
- Project docs: README, CHANGELOG, ROADMAP, architecture, schema, API.
- Server scaffold: Fastify app with `GET /api/health`, SQLite bootstrap via
  `node:sqlite` (`DatabaseSync`), idempotent migration runner, CLI args
  (`--host`, `--port`, `--data`, `--webroot`), compiled to a standalone
  single binary with `bun build --compile`.
- Student web client scaffold: Vite + Vue 3 + Tailwind v4, i18n (en/uk),
  mobile-first home view with server status check.
- Desktop scaffold: Tauri 2 + Vue 3, i18n (en/uk).
- Desktop trial demo: «sum of two numbers» with a Test button and the author's
  name (ПІБ) in the window title, localized per locale.
- GitHub Actions workflow (`build-desktop.yml`) building the desktop app for
  Linux (`.deb` / `.AppImage`) and Windows (`.msi` / `.nsis`), uploading the
  bundles as workflow artifacts (`uploadWorkflowArtifacts`).
- GitHub Actions release workflow (`release.yml`): pushing a `v*` tag builds
  on Linux + Windows in the cloud and publishes a GitHub Release automatically.
- ✅ Production bundles built in CI for v0.1.0: `.exe` (NSIS), `.msi` (WiX),
  `.deb`, `.AppImage` — published in [GitHub Release v0.1.0].
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

[GitHub Release v0.1.0]: https://github.com/flassuu/knowledge-testing-system/releases/tag/v0.1.0