# The three deployment scenarios

The system was imagined around three ways of being used. This is what each one
needs, what works today, and how to check that it works. The plan that closes
the gaps is [Phase 5 of the roadmap](../ROADMAP.md#phase-5--deployment-v050-next).

| Scenario | Where the server runs | Who is in the room | Today |
|---|---|---|---|
| **A — school server** | A machine in the school, started by hand or as a service | admin, teacher, students | **Works**, if the teacher opens the web client on the LAN address |
| **B — teacher desktop** | Inside the desktop app, which starts and owns the server | teacher (+ admin when needed) | Client only: the app never starts a server |
| **C — classroom, no admin** | On the teacher's own machine | teacher and students only | Blocked: a student cannot be approved without an admin |

---

## Scenario A — the server on a school machine

This is the one to use today. Everything below works on the current release.

### 1. Build once

```bash
pnpm install
pnpm build:web                 # → apps/web-client/dist, served by the server
pnpm build:server              # → apps/server/dist/testing-server
```

Or take both from the release page: `testing-server_<version>_linux-x64` and
`web-client_<version>.tar.gz` (unpack the second — the server expects it at
`--webroot`).

### 2. Start it

```bash
ADMIN_PASSWORD='choose-a-real-one' \
  ./apps/server/dist/testing-server \
    --port 3300 \
    --data ./data \
    --webroot apps/web-client/dist
```

Expected on screen:

```
{"level":30,...,"msg":"Server listening at http://192.168.1.65:3300"}
[server] listening on http://0.0.0.0:3300 (db: /…/data/app.db)
```

`0.0.0.0` means every interface, which is what lets phones in. If the port is
taken the process exits — pick another one, and remember to use it everywhere
below.

### 3. Find the address students can open

```bash
ip -4 route get 1.1.1.1 | rg -o 'src [0-9.]+'     # e.g. src 192.168.1.65
```

Write it down. From this point on, **use `http://192.168.1.65:3300`, never
`localhost`** — anything the teacher's browser builds from its own origin would
say `localhost`, and a phone cannot open that.

### 4. Create the accounts

1. Open `http://192.168.1.65:3300` → sign in as **admin** with the password you
   set. Pick the admin role on the sign-in screen.
2. **Users → New teacher** → create the teacher account (this is the only way:
   teachers cannot be created by anyone else).
3. Sign out, sign in as the teacher (pick the teacher role).
4. Sign out again, and on the sign-in screen choose **Create account** → register
   one student (in the real flow each student registers their own account on
   their phone).

### 5. Approve the student

1. Sign back in as admin → **Users** → the student row shows `pending`.
2. **Approve** (or select several rows and use the bulk button).
3. The student can now sign in. Until this happens the API answers
   `403 PENDING_APPROVAL` — that is the wall scenario C removes.

### 6. The teacher prepares the test

As the teacher: **Tests → New test**, add questions (all five types are
available), then **Live → Start a session → choose the test**. The board shows:

- a six-character code (no ambiguous `0/O`, `1/I` — it gets read out loud);
- **Copy join link** — this is the URL to test;
- **Show QR code** — the QR encodes the same link.

Check the link before going further: it must start with `http://192.168.1.65:3300`.
If it says `localhost`, the teacher is on the wrong address — see the
troubleshooting table.

### 7. A student takes the test

1. The phone joins the same network (same Wi-Fi, not mobile data).
2. Scan the QR, or open the copied link, or open the address and type the code.
   A student who is not signed in lands on the sign-in screen first; the code
   stays in the address and **prefills itself** once they are in.
3. The paper arrives with the question types the test uses, a confirmation
   before submitting, and — only if the test sets a time limit — a countdown
   corrected against the server's clock.
4. The result shows the score, the pass mark and the correct answers.
5. The teacher's board updates without a refresh; the journal (**Tests →
   Results**) fills in as students finish.

### 8. How to know it worked

- `curl http://192.168.1.65:3300/api/health` → `{"status":"ok","database":"ok",…}`
  from the admin machine, and the same from the phone's browser.
- The student's result screen shows a percentage, and the teacher's board shows
  the same student as `submitted`.
- The journal shows the student with their last percent, and a second test run
  adds a row rather than replacing it.
- **Tests → Results → Print** produces the report for the folder; **Export CSV**
  on the board produces a spreadsheet.

---

## Scenario B — the teacher desktop app

### Today

The desktop app is a **client**. It talks to a server at
`http://localhost:3300` (`VITE_API_TARGET` at build time) and never starts one:
`src-tauri/src/lib.rs` has no sidecar, no process management, no log view and no
settings. Scenario A's server can be running on the same machine, and then the
desktop app works against it — that is the honest current state.

### What Phase 5.4 adds

- the server binary bundled as a Tauri sidecar and started by the app;
- a console view with the server's output, filterable, plus start/stop/restart;
- settings for data dir, port, admin password and public address;
- the API base following those settings, so the port can change without a rebuild;
- "open in browser" with the LAN address, for showing the QR on a projector.

### How to test it once it exists

1. `pnpm build:server`, then `NO_STRIP=true pnpm --filter @testing-system/desktop tauri build`.
2. Run the bundle with a **fresh** data dir: the first launch must show the
   defaults and a Start button, and log the exact path it looked for the binary.
3. Start → the console fills with `[server] listening on http://0.0.0.0:<port>`.
4. Open the browser link → the same server, from a phone on the LAN.
5. Stop → the process is gone (check `ss -ltnp | grep <port>`).
6. Change the port, restart, and confirm the app still talks to the server.
7. A dev build without a bundled binary must show a readable message, not a
   crash.

---

## Scenario C — a classroom with no admin

### Today, the workaround

The teacher signs in as the admin account, approves the students once, and signs
back in as a teacher. It works, but it means the teacher holds admin rights and
has to approve by hand — which is the exact thing that breaks when a student
registers five minutes before the lesson.

### What Phase 5.2 adds

A **classroom with a key**:

1. The teacher creates a class in their workbench; the app shows a six-character
   key and a QR of the registration link (`?class=KEY`).
2. A student scans it, registers, and is **approved immediately** — the key is
   the approval, scoped to that class and revocable.
3. Optionally the classroom is linked to a course, and everyone who arrives
   through the key is enrolled in it.
4. The teacher sees who came in through the key, and can revoke or regenerate it.

### How to test it

- Register with a valid key → the account is usable right away, no admin involved.
- Register with a wrong or revoked key → a clear error, and the account is still
  `pending` (nothing about the old flow changes).
- Revoke a key → the next registration with it is refused; existing students keep
  working.
- A teacher cannot see, revoke or delete another teacher's class, and a class key
  never grants teacher or admin rights anywhere.
- Automated: `apps/server/tests/classrooms.test.ts` (key generation, approve /
  reject / revoke, ownership, auto-enrolment) and a browser check of the register
  screen with and without a key.

---

## How to develop and verify all of this

**Order of work** — each package ends with something you can try by hand:

| Package | Ends with | Verify by |
|---|---|---|
| 5.1 Reachability | a QR that a phone opens | type an address into settings, read the QR with a phone |
| 5.2 Classroom key | a student in without an admin | register with the key on a second device |
| 5.3 Console | logs you can read, and commands that act | `--no-console` off, type `help`, then `status` |
| 5.4 Desktop host | the server inside the app | build the bundle, start it, open it from a phone |
| 5.5 Verifiability | the runbooks above | re-run this document top to bottom |

**Automated checks** (no browser needed):

```bash
pnpm typecheck                 # all three packages
cd apps/server && bun test     # server unit + integration
pnpm --filter @testing-system/web-client test
```

**Browser checks**: drive the built client with headless Firefox over WebDriver
BiDi (the harness used while building this). It reports, per screen and width:
horizontal scroll, touch targets under 30px, unnamed controls, untranslated
keys — plus one happy path per role. Screenshots come out of the same run, so a
visual pass is two minutes rather than a manual click-through.

**Manual pass before calling a package done** — run the relevant scenario above
end to end on a real phone, not on the same machine.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| QR scans but the page will not open | the link says `localhost` or `tauri://` | open the teacher UI on the LAN address; Phase 5.1 makes this impossible to get wrong |
| Phone cannot reach the server at all | firewall, or a different network | allow TCP 3300; both devices on the same Wi-Fi |
| `403 PENDING_APPROVAL` | the student is not approved yet | admin → Users → Approve, or use a class key (Phase 5.2) |
| `403 FORBIDDEN` on an action | the signed-in role is not the one the action needs | teachers cannot manage users; only admins can |
| The board does not update | the WebSocket could not be opened | it falls back to polling every 4s; check for a proxy in between |
| The countdown looks wrong on a phone | device clock drift | the deadline is corrected against the server on join |
| Server exits at start, `EADDRINUSE` | the port is taken | another port, in the command and in the join link |