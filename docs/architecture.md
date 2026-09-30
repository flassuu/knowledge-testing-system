# Architecture

The Knowledge Testing System is an **offline-first, role-based application** for
running classroom knowledge tests entirely on a local network. A single
application serves an **Administrator**, **Teachers**, and **Students**; the
chosen role unlocks different functionality. No internet connection is
required — all data lives inside the classroom LAN.

## Roles

| Role | Entry points | Capabilities |
|------|--------------|--------------|
| **Administrator** | Desktop app (with embedded console) or headless CLI | Hosts the system: runs the embedded server, manages the database, users and participants, sees all data. The central point every other client connects to. |
| **Teacher** | Desktop app and/or web app on `localhost` | Creates and edits tests, shares them with students, builds courses (like Google Classroom) with materials, reviews statistics, grade journals and per-session reports. May prepare tests offline and sync them later. |
| **Student** | Web app on a phone/PC (PWA) or desktop app | Takes tests, views own statistics, and reads materials from assigned courses. (Forums — a future idea, out of scope for v1.) |

One client, many roles — the frontend is a single codebase whose features are
gated by the logged-in role.

## Topology

```
┌────────────────────────────────────────────┐
│ Admin machine — hosts the whole system      │
│  Tauri admin client (console + admin panel) │
│               │ spawns & owns               │
│               ▼                             │
│  Embedded server (single binary)            │
│   REST API · WS hub · static web client     │
└──────────────────────┬─────────────────────┘
                       │ HTTP/WS on LAN 0.0.0.0:3300
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Teacher          Student        Students
   (desktop /   (desktop / web  (phones via Wi-Fi,
    web on        on localhost)    mobile-first PWA)
    localhost)
```

The server lives on the admin machine (embedded as a sidecar). Teachers and
students connect to it over the LAN. Web clients are served by the server
itself as static files.

## Application layering

### `apps/server` — embedded server & system core

- **Framework:** Fastify (v5); plugins `@fastify/cors`, `@fastify/static`,
  `@fastify/websocket`.
- **Storage:** SQLite via built-in `node:sqlite` (`DatabaseSync`) — zero native
  deps, so it compiles to a single standalone binary with `bun build --compile`.
  DB file: `<data-dir>/app.db`.
- **Migrations:** idempotent, versioned, run at startup.
- **CLI:** `--host`, `--port`, `--data <dir>`, `--webroot <dir>` — the admin
  can run it headless (pure console) or from the admin client.
- **Packaging:** one binary (`testing-server(.exe)`); no Node.js on targets.

### `apps/web-client` — the shared frontend (all roles)

- Vite + Vue 3 + TypeScript + Tailwind CSS v4, mobile-first, PWA.
- **One codebase, role-gated UI**: at first launch the user picks a role,
  signs in, and the UI adapts (admin panel / teacher workbench / student view).
- i18n (`vue-i18n`): base **en**, **uk** included; one-place locale registration.
- Produces static files served by the server; also used inside the desktop app.

### `apps/desktop` — desktop shell (Tauri 2)

- Provides the same frontend in a native window for admin & teacher workflows
  (and for students who prefer a desktop app).
- In production the server is spawned as a sidecar **only in the Admin client**;
  teacher/student clients treat it as a remote endpoint.
- Minimal Rust — logic lives in TypeScript.

## Access & accounts

- The **admin account is seeded into the system** (built-in bootstrap account).
- **Teachers are created by the admin.**
- **Students register themselves** and must be **approved by a teacher or admin**
  before they can join sessions.
- Authentication: login + password; server issues role-scoped bearer tokens.
- Passwords are hashed; security hardening is deferred but the data model
  already covers roles, statuses (pending/approved/blocked) and moderation.

## Offline mode

Almost everything requires the running server. When the server is unreachable:

- Anyone can **read previously cached content**: course materials, descriptions,
  statistics (PWA cache + local storage).
- **Teachers may author and edit tests offline** (local drafts) and sync them
  to the server once it is reachable again.

## Courses & materials

- Teacher creates a **course** and attaches **files** (PDF, images, …) and
  **tests** to it; students assigned to the course see the materials.
- A test can be shared directly or through a course.

## Data model (see [schema](./schema.md))

`users` (roles, approval status) · `sessions` (auth tokens) · `courses` ·
`materials` · `tests` · `questions` (5 types: single choice, multiple choice,
true/false, short answer, matching) · `live_sessions` · `participations` ·
`participation_answers`.

## Testing flow (live sessions)

1. Teacher picks a test and starts a **session** on the Live tab. The server
   issues a 6-character join code (no ambiguous `0/O` or `1/I` glyphs, so it
   can be read out loud) and snapshots the time limit and pass mark.
2. Students sign in, type the code — or open the teacher's `?join=CODE` link,
   which fills it in — and a `participations` row is created.
3. The paper is served in a **per-student shuffle** fixed at join, so a reload
   never reorders it, and with **every answer key stripped**. A test can still
   be edited meanwhile: the session works from its snapshots.
4. The countdown is corrected for the round trip to the server, so a device
   with a drifting clock still sees the real deadline. At zero the client
   submits, and every server entry point that grades or closes a session also
   sweeps expired participations — a forgotten session costs nobody their
   attempt.
5. Scoring is server-side: points per question and a percent of the maximum.
   Missing or malformed answers score zero.
6. The teacher's **live board** streams over **WebSocket**: status changes for
   everyone in the session, the participant list for the teacher. The client
   falls back to polling where a socket cannot be opened.
7. *Planned (Phase 4):* the teacher exports a report — PDF (printable) + CSV —
   stamped per session.

## Communication

| Flow | Channel |
|------|---------|
| Everyone ↔ Server (CRUD, join, submit, results) | REST `/api/*`, bearer token (the student's own account token) |
| Server → Teacher (live board: joins, submissions, status) | WebSocket `/ws/sessions/:id` |
| Server → Student (pause, finish, time) | same WebSocket, status only |
| Fallback when a socket cannot be opened | REST polling (cheap, LAN scale) |

## Security model (LAN trust)

- Offline classroom: role-scoped bearer tokens for all three roles; an
  administrator approves student registrations; CORS open to the LAN.
- A student can only read or submit **their own** participation: results and
  the live channel check the participation belongs to the caller.
- The live channel authenticates from the query string (browsers cannot set
  headers on a WebSocket handshake) and closes with a code when the token, the
  session or the ownership check fails.
- No TLS in v1 (out of scope); deeper security review is deferred — see Access
  & accounts.

## Cross-platform packaging

- **Server:** `bun build --compile` → native binary per platform.
- **Desktop:** `tauri build` → `.deb` / `.AppImage` (Linux), `.msi` / `.nsis`
  (Windows); CI builds both, releases on `v*` tags.
- **Web client:** static files served by the server binary.

See: [Database schema](./schema.md), [API reference](./api.md).