# AGENTS.md — Agent rules for this repository

> This file is the **single source of truth** for working in this repo.
> Read it fully before starting any task. Re-read it whenever a task touches
> architecture, conventions, or build tooling. If an instruction here
> contradicts a user request, follow this file and ask the user.

## Project overview

Offline classroom knowledge-testing system (course project). A local
client-server suite: a **teacher desktop app** (Tauri 2 + Vue 3), a
**mobile-first student web client** (Vue 3 + PWA), and an embedded
**Node.js REST/WebSocket server** (Fastify + `node:sqlite`) that is compiled
into a single standalone binary with `bun build --compile`.

All code, comments, identifiers, and technical docs are written in **English**.
User-facing UI uses an **i18n** system (`vue-i18n`) — English is the base
locale, Ukrainian is provided out of the box, adding a new locale must be a
one-place change (see web-client/desktop i18n conventions below).

## Repository layout

```
apps/
  server/        Node.js API + WS server (Fastify, node:sqlite, bun-compiled)
  web-client/    Student mobile-first web app (Vite + Vue 3 + Tailwind v4)
  desktop/       Teacher desktop app (Tauri 2 + Vue 3 + Tailwind v4)
docs/            Architecture, DB schema, API reference
dist/releases/   Downloaded CI bundles (gitignored)
```

## Environment

- OS: Arch Linux, dev machine only. Targets: Windows (.exe) and Linux
  (.deb / .AppImage).
- Runtime: Node.js >= 22.5 (uses built-in `node:sqlite`), pnpm >= 9.
- `bun` is used only to compile the server into a standalone binary —
  it is NOT the runtime for anything else.
- Tauri build on Linux requires `webkit2gtk-4.1`
  (`sudo pacman -S webkit2gtk-4.1`).
- AppImage packaging needs `patchelf` in `$PATH` and, on Arch, `NO_STRIP=true`
  (linuxdeploy's internal `strip` chokes on `.relr.dyn` sections from modern
  binutils). Build with:
  `NO_STRIP=true pnpm --filter @testing-system/desktop tauri build`.
- Windows builds are done in CI (`.github/workflows/build-desktop.yml`),
  not cross-compiled locally.
- Releases are also done in CI: pushing a `v*` tag triggers
  `.github/workflows/release.yml`, which builds on Linux + Windows in the
  cloud and uploads the bundles to a GitHub Release.

## Commands (run from repo root)

| Task | Command |
|------|---------|
| Install deps | `pnpm install` |
| Run server (dev) | `pnpm dev:server` |
| Run student web (dev) | `pnpm dev:web` |
| Run desktop (dev) | `pnpm dev:desktop` |
| Build server binary | `pnpm build:server` |
| Build web client | `pnpm build:web` |
| Typecheck all | `pnpm typecheck` |
| Run all tests | `pnpm test` |
| Server + desktop tests | `cd apps/desktop/src-tauri && cargo test` |
| Browser checks (layout, happy paths) | `pnpm check:browser` (needs a server on :3300) |
| Console smoke (pty + piped) | `pnpm smoke:console` |
| Prepare the desktop sidecar | `pnpm desktop:sidecar` |

## Conventions

- **Package scope:** `@testing-system/*` (`server`, `web-client`, `desktop`).
- **Strict TypeScript** everywhere (`strict: true`), extends `tsconfig.base.json`.
- **No `any`** unless absolutely unavoidable; document why in a comment.
- **Do not add comments** unless they explain non-obvious decisions
  (DIFF conventions: the codebase uses minimal comments).
- Follow existing file layout in each app; mirror sibling files when extending.
- API design is REST + JSON; real-time updates go through WebSocket
  (`@fastify/websocket`), never long-polling.
- IDs are UUIDs (server-side); short join codes are 6 uppercase chars.

## Server rules

- SQLite via `node:sqlite` (`DatabaseSync`). Never add a native driver
  dependency (breaks `bun build --compile`).
- CLI args: `--port`, `--host`, `--data <dir>`, `--webroot <dir>`.
- DB file lives in the `--data` dir. Migrations run idempotently at startup.
- Everything must keep working when compiled to a single binary.

## Frontend rules (web-client & desktop)

- Tailwind CSS **v4** (Vite plugin `@tailwindcss/vite`) — no
  `tailwind.config.js`.
- `vue-i18n`: locales live in `src/i18n/locales/<locale>.ts`; a locale is
  registered by adding one import + one entry in the messages map.
  English is the fallback locale; do not hard-code UI strings.
- Mobile-first: build for narrow screens first, desktop is a progressive
  enhancement (web-client especially).

### Design rules (web-client & desktop)

Binding for every screen — the full rationale lives in ROADMAP.md
("Design rules").

- **Never use emoji in the UI.** Icons come from Lucide
  (`lucide-vue-next`) only — no pasted emoji or decorative glyphs in
  markup, buttons, placeholders or labels.
- Keep **one cohesive style, modelled on Material 3 Expressive**: rounded
  shape scale (cards `rounded-2xl`, controls `rounded-xl`, chips pill),
  tonal surfaces instead of flat white, short expressive motion
  (150–250 ms) on state changes.
- Apply colour **only through semantic theme tokens** (`bg-surface`,
  `text-on-surface`, `bg-primary`, …) defined in the Tailwind v4 `@theme`
  layer — never raw palette classes (`bg-slate-800`, `text-rose-600`), so
  both themes keep working.
- Exactly **two themes: light and dark**; no extra palettes and no
  per-component hard-coded colours.

## Desktop (Tauri) rules

- Tauri **v2**. Rust in `src-tauri/`. Keep Rust minimal, prefer JS.
- The server binary is expected next to the app as a sidecar
  (`bundle.externalBin`) — do not assume a running server during dev;
  handle "server not reachable" states gracefully.

## Git and releases

- Branch `main`, conventional commits
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Commit only when the user asks. Keep the repo history clean;
  no intermediate scaffolding noise.
- Never commit secrets, DB files, or build artifacts (see `.gitignore`).
- Cut a release by tagging: `git tag v<version> && git push --tags`;
  CI builds and publishes automatically (`release.yml`).

## Quality gate (run before finishing any task)

1. `pnpm typecheck` passes for each touched package.
2. `pnpm --filter <pkg> test` passes for touched logic.
3. `pnpm build:server` and `pnpm build:web` succeed if server/web touched.
4. No new dependencies without user confirmation.
5. Update `CHANGELOG.md` (Unreleased section) when user-visible behavior changes.
6. `pnpm check:browser` after touching a screen (`scripts/browser-checks.mjs`).
   It drives a real Firefox over WebDriver BiDi with no dependencies: horizontal
   scroll, elements past the right edge, tap targets under 30px, unlabelled
   buttons and untranslated keys across three roles × two languages × three
   widths, plus one happy path per role. A jsdom test cannot see any of that.
   Note the two BiDi quirks it encodes: the endpoint Firefox prints has no path
   (it is `/session`), and `script.callFunction` arguments are inlined into the
   source rather than passed.
7. `cargo test` after touching `src-tauri` (`HOST=$(rustc -vV | sed -n 's/^host: //p')`
   makes the sidecar test spawn the real server).
8. `pnpm smoke:console` after touching the logger or the console. It runs the
   binary on a pty, sends commands, and then checks the opposite case: a piped
   run must stay JSON, because `systemd`, `journalctl` and CI read it.