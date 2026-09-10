# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Monorepo scaffold (pnpm workspaces): `apps/server`, `apps/web-client`, `apps/desktop`.
- Agent rules and opencode config (`.opencode/AGENTS.md`).
- Project docs: README, architecture, roadmap.
- Server scaffold: Fastify app with `GET /api/health` and SQLite bootstrap.
- Student web client scaffold: Vite + Vue 3 + Tailwind v4, i18n (en/uk).
- Desktop scaffold: Tauri 2 + Vue 3.