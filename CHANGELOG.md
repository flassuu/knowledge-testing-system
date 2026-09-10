# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Monorepo scaffold (pnpm workspaces): `apps/server`, `apps/web-client`, `apps/desktop`.
- Agent rules and opencode config (`.opencode/AGENTS.md`).
- Project docs: README, architecture, schema, API.
- Server scaffold: Fastify app with `GET /api/health` and SQLite bootstrap.
- Student web client scaffold: Vite + Vue 3 + Tailwind v4, i18n (en/uk).
- Desktop scaffold: Tauri 2 + Vue 3.
- Desktop trial demo: «sum of two numbers» with a Test button and the author's
  name (ПІБ) in the window title, localized per locale.
- GitHub Actions workflow building the desktop app for
  Linux (`.deb` / `.AppImage`) and Windows (`.msi` / `.nsis`).

### Fixed
- Linux AppImage bundling on Arch: needs `patchelf` and `NO_STRIP=true`
  (linuxdeploy fails on `.relr.dyn` sections otherwise).
- Renamed Tauri lib crate so `main.rs` resolves the correct lib target.