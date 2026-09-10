# AGENTS.md

The canonical rules for working in this repository live in
[`.opencode/AGENTS.md`](./.opencode/AGENTS.md).

**Always read `.opencode/AGENTS.md` before starting any task and follow it.**
It defines the project layout, available commands, code conventions,
the quality gate, and the git workflow.

Quick reference:

- Monorepo: `apps/server`, `apps/web-client`, `apps/desktop`.
- Commands from repo root: `pnpm install`, `pnpm dev:*`, `pnpm build:*`,
  `pnpm typecheck`, `pnpm test`.
- Code and docs in English; UI localized via `vue-i18n` (base locale: en, plus uk).
- Strict TypeScript, Tailwind v4, Tauri v2, Fastify + `node:sqlite`.