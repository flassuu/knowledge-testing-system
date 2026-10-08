# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

## [0.5.0] — 2026-10-08

Phase 5 «Deployment», the three ways the system is actually used, made to work
end to end: a desktop that carries its own server, a school machine serving the
room, and a class that gets in without an admin present.

### 5.1 — reachability: the address students can actually open

The join link was built from `window.location.href`, which is `tauri://localhost`
in the desktop app and `http://localhost:3300` in a browser on the teacher's
machine. A phone can open neither, so the QR code was decorative.

- **A public address for the school**: `GET /api/settings` for any signed-in
  role, `PATCH /api/settings` for admins, stored in `app_meta` under
  `public_base_url` (no migration — the key/value table was already there). The
  value is validated and normalised: absolute, `http`/`https`, no path, no query,
  no credentials, no trailing slash.
- **Address suggestions**: the server reports the IPv4 addresses it answers on,
  each with the port it actually bound. Loopback is excluded on purpose — offering
  `127.0.0.1` as a suggestion would be exactly the wrong advice.
- **Admin → System & DB → Public address**: the current value, the suggestions as
  one-tap chips, a field for anything else, and a warning while typing an address
  a phone cannot open.
- **The teacher's Live tab prints the address that is in the QR code**, and when
  that address is `localhost`, `127.0.0.1`, `0.0.0.0` or `tauri://localhost` it
  says plainly that a phone cannot open it and that the code can still be typed.
- **The join link comes from the server's address**, not from the window the
  teacher happens to be looking at. `joinLink()` moved out of the Live tab into a
  pure function with the reachability check next to it, both unit tested.

### 5.2 — a classroom with a key

A teacher alone in a room could not get anybody in: a self-registered student is
`pending`, only an admin can approve, and the teacher cannot manage users. The
answer is a scoped key, not more power.

- **`classrooms` and `classroom_members`** (migration v5): a teacher's class, its
  six-character key from the same alphabet as a join code, and who arrived
  through it. The key approves one thing — a student account — and nothing else:
  the role is hard-coded in the handler, so no key, however it was obtained,
  produces anything but a student.
- **Teacher API**: create, list own, rename, revoke, issue a new key, delete.
  Another teacher's class answers `403` for every one of them; a student is
  refused. A wrong key and a revoked key both answer `404` with the same message,
  so a key cannot be used to discover which classes existed.
- **`GET /api/classrooms/preview?key=`** is public: the sign-up form says
  "Class 9A · Olena M." before a student types a password, and nothing is created.
- **`POST /api/auth/register` takes an optional `classKey`.** Valid → approved
  immediately, the classroom records the student, and a class linked to a course
  enrols them there too. Wrong → `400` and *nothing is created*, so the name
  stays free and the student can fix the code. No key → unchanged (`pending`).
- **Teacher → Classes**: the key large enough to read from a desk, a QR that
  opens the sign-up form with the key filled in, the students who came in, and
  rename / new key / revoke / delete. A class with students can be revoked by
  deleting it — deliberately, since revoking must not look like removing people.
- **Sign-up screen**: an optional class-code field, with the class named as you
  type, and two different success messages: "you can sign in now" through a key,
  "waiting for approval" without one.
- `utils/joinLink.ts` is now `utils/links.ts` and also builds the registration
  link. Both builders refuse a scheme with no origin — `new URL('tauri://localhost').origin`
  is the string `"null"`, which would have put `null/?join=…` into a QR code.

### 5.3 — the server console

The server wrote pino JSON and could not be talked to; the desktop had no log
view at all. Now there is one log stream with three readers, and a console that
acts through the same functions the API calls.

- **Human lines on a terminal, JSON in a pipe** — wall clock, relative age,
  colour-coded level, aligned columns, and a request as `→ GET /api/tests 200`.
  A pipe gets the JSON pino wrote, byte for byte, so `systemd`, `journalctl` and
  CI keep parsing what they parsed before.
- **One line per request, with the duration.** pino logged every request twice
  ("incoming request", "request completed") and never said how long it took; the
  pair is replaced by one line whose level follows the outcome — `error` for 5xx,
  `warn` for 4xx, `info` otherwise.
- **`token=` never reaches a log line.** Browsers cannot set headers on a
  WebSocket handshake, so the token travels in the query string and Fastify logs
  the whole URL. That was already true on stdout, but now the same line is
  rendered in a browser tab, where it would be read, copied into a bug report or
  photographed — and it is valid for twelve hours.
- **A ring buffer of the last 500 lines**, with `GET /api/logs?since=` and
  `WS /ws/server` serving it. Both admin-only: a log names who signed in, which
  accounts exist and what failed. One socket carries both halves — the backlog
  the client missed, then each new line — so a reconnect is exact.
- **Interactive console** when there is a terminal: `help`, `status`, `sessions`,
  `users`, `students [pending]`, `approve`, `block`, `password`, `level`, `clear`,
  `stop`. Off with `--no-console`, and off by itself when stdin is a pipe — which
  is what the desktop app and every CI run are. `approve` and `block` call the
  same `setUserStatus` the HTTP route calls, so blocking revokes live sessions in
  both places or in neither.
- **Admin → Server tab**: the live tail with level filters and counts, pause and
  clear, the server status, and the students waiting for approval — the same
  calls the Users tab makes, next to the log where the question "why is nobody
  getting in?" gets answered. Restarting is not offered on purpose: an HTTP
  request that killed the process serving it would be a strange thing to send.
- `pino` is now a declared dependency of the server. It already was one —
  Fastify's logger *is* pino — but the app now constructs the instance itself to
  own the stream; no new package was downloaded.

### 5.4 — the desktop app as a host

The bundle now carries the server and starts it, so a teacher needs nothing else
running and nothing installed but the app.

- **The server is a Tauri sidecar.** `src-tauri/src/host.rs` spawns it with
  `std::process`, pipes its output into Tauri events, and reports an exit nobody
  asked for with its code. No new Rust dependency. The module knows nothing about
  Tauri — it is handed two closures and a resource directory, which is what lets
  its tests spawn a real server and check the banner arrives through the pipe.
- **A Server screen** reachable without signing in, because starting the server is
  the one thing a teacher may need *before* they can: stopped or running with a
  pid, start / stop / restart, open in browser, the live output with level filters,
  copy and clear.
- **Host settings** — port, data folder, student client folder (`--webroot`),
  server binary path, seed admin password — saved next to the app and applied on
  the next start. The first run shows defaults and a Start button; nothing starts
  silently.
- **A missing binary is a message, not a crash**: the Start button is disabled and
  the screen lists every path it looked in, with the command that produces one. A
  development build without a bundled server is a normal state.
- **The API base is a variable now.** `VITE_API_TARGET` was a build-time constant,
  which meant moving to another port needed a rebuild — impossible for a teacher
  in a computer room. It follows the setting.
- **`POST /api/auth/password`** (any role, requires the current password): the
  seed variable is read once, when a data folder has no admin yet, so changing an
  existing admin password had no API at all. Every session ends, including the one
  that made the change, and a new token comes back.
- **The public address is visible and editable here too** — the address a phone
  opens is the server's setting, so the desktop screen shows it, offers the
  addresses the server answers on, and lets an admin change it.
- **Open in browser uses the LAN address**, not `localhost`: showing a student
  their own teacher's loopback is how a lesson fails to start.
- **The seed warning goes through the log.** It was written with `console`, which
  bypassed the log stream, so the desktop showed it as an untyped error line.
- `scripts/desktop-sidecar.sh` (`pnpm desktop:sidecar`) places the binary where
  Tauri looks for it; CI runs it before every `tauri build`, on Linux and Windows.

**Also on the server**: the startup banner and the seed warning now carry a level
(`warn`), so they are warnings everywhere rather than untyped text.

### 5.5 — making it verifiable

Two checks that run without a human looking at a screen, and one that already
paid for itself.

- **`scripts/browser-checks.mjs`** (`pnpm check:browser`) drives a real Firefox
  over WebDriver BiDi **with no dependencies of its own** — a WebSocket and some
  JSON, because a check that needs a package install will not be run by the
  person who needs it. It creates the accounts, test, session and class it needs,
  deletes them afterwards, and reports per screen and width: horizontal scroll,
  elements past the right edge, touch targets under 30px, unnamed controls and
  untranslated keys — across three roles × two languages × three widths, then one
  happy path per role (the QR address and its warning, the class key, the admin
  console, a student who signed in with a class key). Screenshots of a failure
  come out of the same run.
- **`scripts/console-smoke.sh`** (`pnpm smoke:console`) runs the binary under a
  pty, sends `status` and `approve nobody`, and checks the output is
  human-formatted — then runs it again with the output piped and checks every
  line is still JSON. Wired into the release workflow's server job.

**Fixed by the smoke test, on the day it was written:** Fastify 5 prints a
deprecation notice for the top-level `disableRequestLogging` option, as plain
text, into stdout — which broke the promise that a piped run is machine-readable
for `systemd`, `journalctl` and CI. It now uses `logController`, which is the
supported form.

### Renamed — the project is **LANtern**

The name settled here; everything that carries it followed, because a project
whose own artefacts are called something else is harder to talk about than it
needs to be.

| Was | Now |
|---|---|
| `knowledge-testing-system` (repository) | `lantern` |
| `@testing-system/*` (workspace scope) | `@lantern/*` |
| `testing-system-teacher` (Rust crate) | `lantern-teacher` |
| `testing-server` (server binary, sidecar) | `lantern-server` |
| `testing-server_<version>_linux-x64` (asset) | `lantern-server_<version>_linux-x64` |
| `web-client_<version>.tar.gz` (asset) | `lantern-web_<version>.tar.gz` |
| `com.testingsystem.teacher` (app identifier) | `com.lantern.teacher` |

The display name stays **LANtern**; only paths, packages and file names are
lowercase. GitHub redirects the old repository URL, so existing clones and
badges keep working.

**Two consequences worth knowing:** the desktop app's identifier changed, so
Linux and macOS look for its settings in a new folder — the first run of 0.5.0
shows defaults again, and the port and data folder have to be re-entered if they
were changed from the defaults. And the desktop bundle name follows
`productName`, so the downloaded app is still `LANtern_0.5.0_*`.

**Not renamed:** the exchange format identifier `knowledge-testing.test` inside
exported and imported files. It is a data contract rather than a name — changing
it would make every file a teacher exported in 0.4.x unimportable.

### Verification at this release

220 server tests, 62 client tests, 9 Rust tests (including one that starts the
real server binary and one that captures the exit code of a failing one), 7 of the
server tests covering the password endpoint, typecheck across all three packages,
both builds, `cargo test`, `pnpm smoke:console` and `pnpm check:browser` — all
green.

**Migrations:** schema version 5 (Phase 5.2 adds `classrooms` and
`classroom_members`). `public_base_url` needed no migration — `app_meta` was
already a key/value table. An existing database upgrades on first start with no
action.

## [0.4.2] — 2026-10-07

The interface pass. Sizes that do not depend on the language, motion that comes
from the Material 3 Expressive tokens instead of ad-hoc transitions, a language
menu with flags, shorter text — and the name.

### Added
- **`AppDialog`**: one dialog shell for every dialog, with the scrim fading and
  the panel arriving on the emphasized spring. Bottom-sheet on a phone, centred
  card above that.
- **`TabStrip`**: tabs of equal width with icons and a sliding indicator, so the
  tab bar is the same size in every language. The admin's pending counter moved
  into it as a badge.
- **Language menu with flags**: one fixed-size control that opens a proper menu
  (arrow keys, Escape, click outside) with a drawn flag per language. The flags
  are SVG, not emoji — AGENTS.md bans emoji, and emoji flags render differently
  everywhere anyway.
- **Motion tokens** (`theme.css`): durations 90–400ms, the M3 standard,
  decelerate and accelerate easings, and the emphasized spring sampled into
  `linear()` so it keeps its overshoot. Toasts arrive on it, cards lift on it,
  buttons press into themselves, and skeletons breathe row by row instead of
  blinking together. `prefers-reduced-motion` collapses all of it.
- **`BrandMark`** and a brand folder: the LANtern mark, the app icon, the lockup,
  and a generated set of assets — favicon (SVG + ICO), Apple touch icon, PWA
  sizes, a maskable icon, and the five Tauri icon files including a hand-written
  `.icns`. `docs/brand/README.md` says which format goes where and how to
  re-export after new artwork.

### Changed
- **The project is LANtern** — a lantern on a LAN. In the UI, the window title,
  the desktop product name, the page title, the README and the description
  packets; the import error now says "not a LANtern test file". The npm scope
  (`@testing-system/*`) and the repository name stay: they are not user-facing.
- **Buttons have a fixed box.** M3 keeps a label to one line and never lets it
  wrap or truncate; the heights (36/40/48px) and the icon squares come from
  tokens, and the label is `nowrap`. The Ukrainian login screen used to scroll
  sideways because "Адміністратор" became a grid column's minimum width — the
  role labels are short now, the grid cells have `min-w-0`, and the document is
  exactly as wide as the screen.
- **Header controls keep their size**: the status pill is one short word with no
  wrap, the tagline hides on narrow screens, and theme, language and sign-out
  are all fixed boxes.

### Fixed
- **Escape closes the language menu** even when focus has left it.
- **The question editor no longer scrolls sideways on a phone.** A `<select>` is
  as wide as its widest option, so "Коротка відповідь" pushed the row past a
  320px screen; the select can shrink now (`min-w-0`), and nothing is lost
  because the type is already named in the card header.
- **The admin filter row wraps** instead of overflowing between 640 and 768px.
- **`AppButton` no longer forces `position: relative`**, which silently beat the
  `absolute` a caller passed in — that is why the password eye button had ended
  up below its field.

## [0.4.1] — 2026-10-07

The tails of the earlier phases: share and duplicate tests, keep authoring when
the server is not there, and one component each for the card and the text field.

### Added
- **Duplicate a test** (`POST /api/tests/:id/duplicate`). The copy belongs to the
  caller and its questions get new ids, so editing it cannot reach the original
  — which is the point at the start of a term.
- **Share a test as a file** (`GET /api/tests/:id/export`, `POST
  /api/tests/import`). The export carries no ids, no owner and no timestamps,
  and does carry the answer keys: a colleague has to be able to run it.
  Positions are renumbered on the way in, so a hand-edited file still imports,
  and every question is validated with the editor's own rules.
- **Authoring that survives an absent server.** A save that cannot reach the
  server becomes a local draft, listed above the tests with Open / Upload /
  Discard. Drafts upload themselves the moment the server answers again; one
  that is rejected keeps its place for the next attempt, a second draft of the
  same test replaces the first, and an abandoned empty form is not kept.
- **One `AppCard` and one `AppInput`** (44 and 15 call sites), after `AppButton`
  in 0.4.0. Text links, table sort headers, clickable rows and tab strips stay
  raw elements on purpose: they do not look like buttons, so they should not
  behave like one.
- **A test that every `t()` in the sources has a message.** A missing key does
  not fail a build — vue-i18n prints the key — so the i18n test now walks the
  sources. It caught one: the pass-mark field in the editor asked for
  `teacher.tests.passingPercent`, which exists in neither locale, so the UI
  showed the raw key where a label should be.

### Fixed
- **A request with no body no longer claims it carries JSON.** The client set
  `content-type: application/json` on every non-GET call, and Fastify answers
  those with "body cannot be empty". Every mutation without a payload was
  failing: delete a test, pause / resume / finish a session, approve or block a
  user. Found by clicking the buttons in a real browser rather than by reading
  the code; the rule now has two tests of its own.

## [0.4.0] — 2026-10-06

Reporting: the numbers a teacher acts on, and the ways to get them out of the
building. And the consistency pass the UI needed before a release — one button
component, and touch targets a thumb can actually hit.

### Added
- **Grade journal per test** (`GET /api/tests/:id/results`, teacher only). One
  row per student across every session that test was run in: attempts, best,
  last and average percent, plus the class figures. The class average and the
  pass rate are judged on each student's *last* attempt, so someone who improved
  since the first try is not counted as a fail, and the pass rate stays unknown
  (`null`) for a test without a pass mark instead of reading as 0 percent.
- **Per-question difficulty**, in the same response: for every question, how many
  students answered and how many got it right, across all attempts. The journal
  screen opens from a test row and leads with the questions under 50 percent,
  because that list is what says what to reteach.
- **CSV export per session** (`GET /api/sessions/:id/results.csv`): a header
  block with the test and the session, then one row per participant. Fields are
  escaped, the file carries a UTF-8 BOM so spreadsheets do not mangle non-ASCII
  names, and a session nobody joined exports the header rather than dividing by
  zero.
- **Printable report.** The journal screen prints through the browser's own
  dialog: the app chrome is dropped, the theme collapses to ink on white, and
  the difficulty bars keep their fill (`print-color-adjust`). No PDF library.
- **Student side, completed**: the courses the student is enrolled in with their
  materials, the result of every finished attempt on the home screen, and a QR
  code for the join link on the teacher's board (rendered by `uqr`, the one
  dependency added).
- **Desktop About dialog** with the app version (read from `tauri.conf.json`,
  the file the bundles are actually built from) and the server address the app
  talks to. Reachable from the header, with the usual focus trap and Escape.
- **The desktop window remembers its size and position.** Tauri only does that
  when the config asks it to, which would also pin the size across monitors with
  different scaling, so the geometry is stored locally, restored on start and
  written back (debounced) whenever the window is moved or resized.

### Changed
- **One `AppButton`** for the whole system: 66 buttons across both apps used to
  carry 24 near-identical copies of `rounded-lg … px-3 py-1.5 text-xs`. The
  component holds the variants and enforces the height floor. Text links, table
  sort headers, clickable cards and tab strips are deliberately left as plain
  buttons — they do not look like buttons, so they should not act like one.
- **The client API layer has one request path.** `apiFetch` and the new
  `downloadFile(path, filename)` share a `request()` helper, so the bearer
  token, the content-type default and the error envelope are handled in one
  place instead of twice. The export is fetched with the token and saved through
  a blob URL, never a plain link: the API authenticates with a header, not a
  cookie, so an `<a href>` would have been rejected.
- **Desktop window title** is `Knowledge Testing`; it no longer carries a
  person's name.

### Fixed
- **Touch targets.** The status chip, the locale buttons and the join-code field
  were 24–28px and the primary actions 28px — below what a thumb needs on a
  phone. They are 36–48px now, the table sort headers are 32px, and the header
  wraps instead of scrolling sideways at 320px. Found by measuring every
  interactive box in a real browser, at 320, 390, 768px and on the desktop at
  800×560 and 1080×720.
- **Dialog focus.** A template `ref` on a component resolves to the instance,
  not to its element, so the dialogs that pass their close button as the initial
  focus target silently failed to move focus into the panel.
- **`/api/sessions/current`** no longer hands a student a session they only
  opened. It returns participations in status `joined`, so a finished attempt no
  longer hides the "you already took this" state.
- **Double course fetch on the student home**: the dashboard and the course card
  both loaded the same list on mount.

## [0.3.0] — 2026-09-30

The classroom loop, end to end: a teacher starts a live session, students
join from their phones with a code, answer against a countdown, and get a
graded result. Schema moves to version 4.

### Added
- **Phase 3: the student side, end to end.** The student home was three
  placeholder cards; it is now a working flow:
  - *Join* — the six-character code the teacher reads out. The input upper-cases
    and drops anything that is not a letter or digit, and the server normalises
    case and stray spaces, so a code pasted from a slide just works.
  - *The paper* — questions in a per-student order that stays stable across
    reloads, with every answer key stripped from the payload. All five types
    render as real inputs: radio, checkboxes, true/false, free text, matching.
  - *The clock* — corrected for the round trip to the server, so a device with
    a drifting clock still sees the real deadline. It turns amber in the last
    minute and submits the paper itself at zero.
  - *Submit* — with a confirmation that states how many questions are answered.
  - *Result* — percentage, score, pass mark and a per-question breakdown with
    the correct answers, marked green or red.
- **Phase 3: live session API and schema.** `live_sessions`, `participations`
  and `participation_answers` (schema v4). Teachers start a run of their own
  test, pause/resume/finish it, read the participant board and review the paper
  with the answer key. Students join by code, re-read the paper and the clock,
  submit, and read their graded result. The time limit and pass mark are
  snapshotted per session, so editing a test mid-run changes nothing.
- **Scoring engine** (`lib/scoring.ts`) as pure functions over all five
  question types: option keys for choices (set equality — duplicates never
  collapse into a match), booleans, trimmed case-insensitive text against the
  accepted list, and full pair mapping. Unanswered or malformed input scores
  zero. 32 unit tests.
- **Timeout handling in two places.** The client clock submits at zero, and
  every server entry point that grades or closes a session also sweeps expired
  participations — so a teacher who forgets to end a session costs nobody their
  attempt: the paper is auto-submitted with zero and the session closes.
- **20 server integration tests** over the whole cycle, including that no
  answer key ever reaches a student, that shuffles are stable, and that a
  second submission is rejected.
- **Phase 3: the teacher side.** The teacher dashboard opens on a **Live** tab:
  start a session from any of your tests, read the join code at a size you can
  hold up to the room (with a copy button), and control the run with pause,
  resume and finish — finishing asks for confirmation and says how many students
  have not submitted yet. The participant board refreshes every four seconds and
  shows each student's name, a "working" marker while they are still in the
  paper, and their percentage with a pass badge once they submit; finished
  results sort to the top. It polls for now; the WebSocket hub replaces that.
- **WebSocket hub.** `GET /ws/sessions/:id` streams one session live: teachers
  receive the participant board, students receive status changes, and both get
  the current state on connect. Joins, submissions, pause, resume, finish and
  the timeout sweep all push an update. An invalid token, an unknown session, a
  student who never joined and a teacher who does not own the session are
  rejected with a close code. The client reconnects with a backoff and silently
  falls back to polling when a socket cannot be opened, so the board works
  either way.
- **Join link for phones.** The teacher copies a `?join=CODE` link next to the
  code; opened on a phone it lands on the join card with the code filled in and
  the button ready, and the parameter is cleared once the student is in.
- **`GET /api/sessions`** returns the teacher's own sessions newest first with
  joined and submitted counts. An admin sees every teacher's, a student gets 403.
- **README:** a "Testing from a phone" section — the server already binds
  `0.0.0.0:3300`, so a device on the same network can open
  `http://<lan-address>:3300` once the web client is built.
- **Client-side session logic** (`student/sessionLogic.ts`) — what counts as
  answered, the answer payload per type, the server-corrected clock and its
  formatting — under 20 new `node:test` cases.

### Changed
- The teacher dashboard opens on a **Live** tab (sessions) ahead of tests
  and courses.
- **Every release now ships a headless distribution** alongside the desktop
  bundles: the standalone server binary
  (`testing-server_<version>_linux-x64`) and the built web client
  (`web-client_<version>.tar.gz`). The release workflow builds them, smoke-tests
  the binary (version check, database check and a request to the web root) and
  only uploads if that passes. README documents the CLI flags and how to run
  the system without Tauri.
- `GET /api/admin/stats` now reports `schemaVersion: 4`.


### Fixed
- **"Not passed" on a perfect score.** A test with no pass mark sends
  `passed: null` from the server, and the result screen read that as a failure.
  It now shows a neutral "Completed" panel, and only reveals passed or failed
  when the test actually defines a mark.
- **The result screen's back button** returned to the paper of a session that
  could no longer be submitted. It lands on the student home, with a second
  button to join another test.
- **The sign-in header floated in the middle of a phone screen**, because the
  whole column was vertically centred. The header is pinned to the top now and
  only the card centres.
- **Switching roles on the sign-in screen jumped the layout**, since only the
  student role had the "Create account" line. The slot is always rendered at a
  fixed height and fills with a short note for the other roles.
- **Theme switching flickered**, restyling every element at once. It now
  cross-fades through the View Transition API, falls back to muting transitions
  for a single frame elsewhere, and drops the fade under `prefers-reduced-motion`.

## [0.2.0] — 2026-09-30

The teacher workbench and a finished-looking UI: authoring for all five
question types, the course builder, a real admin dashboard — plus the
UI/UX polish that turns the first release into a product you can hand to
a class.

### Added
- **UI/UX polish batch 1 (v0.1.1)**: a styled, dependency-free confirm dialog
  (`useConfirm()` + `<ConfirmDialog/>`, Esc/backdrop to cancel, focus moved to
  Cancel) now guards every destructive action in web-client and desktop —
  delete test, delete course, remove student, detach test, block user (was
  the native `window.confirm`, or none at all). i18n: new keys in en/uk.
- **Sign-in UX**: "show password" toggle on the login screen; the last
  successful username **and role** are remembered between sessions (only
  persisted on success, so typos never overwrite them).
- **UI/UX polish batch 2 (v0.1.1)**: global toast notifications
  (`useToast()` + `<ToastHost/>`, dependency-free) for test/course/student/
  material and user-management actions, replacing silent saves and one-off
  alerts; an app-wide **offline banner** plus a "server is back online"
  toast, both driven by a single shared health poll (`useServerHealth`
  powers the ServerStatus pill too). Reachability probe `checkHealth()` in
  the API layer keeps the desktop app pointing at `VITE_API_TARGET`.
- i18n: `server.offlineBanner`, `server.backOnline`, toast strings for
  tests/courses/admin actions, `common.dismiss` — en and uk.
- **UI/UX polish batch 4 (v0.1.1): admin tables + bulk approve.** The Users
  and Participants tabs render as sortable tables on wide screens (columns:
  name, role, status / course, student, enrolled, status) and keep the card
  layout on narrow ones. Column headers are buttons with `aria-sort`, sorting
  is client-side via a shared `useTableSort()` composable, and a result count
  sits above the table.
- **Bulk approval**: pending accounts get row checkboxes plus
  "select all pending", and one click approves the selection sequentially
  (with a toast). A confirm dialog still guards blocking.
- **UI/UX polish batch 5 (v0.1.1): test editor ergonomics.** Every question
  row now carries a numbered badge and icon controls to move it up/down,
  duplicate it or delete it. `+` glyph buttons were replaced with Lucide
  icons.
- **Live test preview** (`TestPreviewDialog`): before saving, a teacher can
  open a student-like rendering of the test — title, description, question
  count, total points, time limit and pass mark as chips, and each question
  type rendered read-only with the correct answers highlighted. The preview
  reuses `buildQuestions()`, so an incomplete question surfaces its
  validation message instead of a broken preview. Escape, a click on the
  scrim or the close button dismiss it.
- i18n: `teacher.editor.duplicateQuestion/moveUp/moveDown`,
  `teacher.tests.preview/previewTitle/previewUntitled/totalPoints`,
  `common.close` — en and uk.
- **UI/UX polish batch 6 (v0.1.1): loading and empty states.** Two shared,
  dependency-free components replace the ad-hoc "Loading…" / "No items yet"
  lines: `<EmptyState/>` (Lucide icon in a tonal circle, title, hint and an
  optional call-to-action) and `<SkeletonList/>` (card and table variants built
  on `animate-pulse` plus theme tokens, announced via `role="status"`).
  Every list now uses them — my tests, my courses, course details, users,
  participants, system stats — and the boot screen shows a skeleton instead of
  text. Empty tests/courses carry a real call-to-action ("New test" / "New
  course"), and an empty user list offers "Clear filters" whenever a search or
  filter is active.
- Remaining `+` glyph buttons and the inline empty hints on the course page
  were replaced with Lucide icons to follow the no-glyph rule.
- i18n: `admin.emptyTitle/emptyHint/clearFilters`,
  `admin.participants.emptyTitle/emptyHint`,
  `teacher.tests.emptyTitle/emptyHint`,
  `teacher.courses.emptyTitle/emptyHint` — en and uk (the old single-line
  `empty` keys are gone).
- **UI/UX polish batch 7 (v0.1.1): course page.** Attaching a test is now a
  searchable list (`TestPicker`) instead of a bare `<select>`: every row shows
  the title, the question count and the time limit, and a click attaches
  directly — no extra submit step. Materials carry a `MaterialBadge` with a
  Lucide icon and a short label (PDF, Doc, Sheet, Slides, Image, Archive,
  Video, Audio, Text, File), derived from the stored MIME type with a filename
  extension fallback (`utils/fileType.ts`).
- i18n: `common.fileType.*`, `teacher.courses.attachSearch/attachNoMatch/allTestsAttached`
  — en and uk.
- **UI/UX polish batch 8 (v0.1.1): accessibility and i18n hygiene.**
  - *Focus rings fixed*: every input carried Tailwind's `outline-none`, whose
    utility layer beats the global `:focus-visible` rule in `theme.css`, so
    keyboard focus was invisible app-wide. The utility is gone, focus now
    changes the border to `primary` and shows the 2 px ring.
  - *Labelled controls*: `aria-label` on the two icon-only editor buttons
    (remove option / remove pair) and on all 14 controls that only had a
    placeholder (admin search and filters, teacher-creation form, question
    body/type/option/pair inputs, enroll field, test search).
  - *Dialogs are keyboard-safe*: a shared `useDialogFocus` composable keeps Tab
    inside the confirm and test-preview panels, closes on Escape and restores
    focus to the opener.
  - *Contrast*: all 15 background/text token pairs used in markup reach at
    least 4.5:1 in the light and the dark theme.
  - *i18n*: the server-status tooltip moved into the locales, `<html lang>`
    now follows the active locale and the choice stays persisted;
    `aria-pressed` marks the active language button.
  - i18n: `server.recheckHint`, `admin.roleFilter/statusFilter`,
    `admin.participants.courseFilter`,
    `teacher.editor.typeLabel/optionLabel/removeOption/removePair` — en and uk.
- **Fixed:** toast accents used raw palette colours (`border-l-emerald-500`,
  `border-l-rose-500`, `border-l-slate-500`), which broke the dark theme and
  the "semantic tokens only" rule — now `border-l-success/error/outline`.
- **Fixed:** the "+" glyph buttons in the question editor became Lucide icons.
- **Fixed: black screen for brand-new teacher accounts.** A teacher with no
  tests and no courses mounts `<EmptyState/>`, and its `withDefaults()` used a
  Lucide icon as the default for the `actionIcon` prop. Vue treats a function
  default as a factory and calls it — `Plus(props, undefined)` — while Lucide
  icons are functional components that destructure their second argument, so
  every mount threw `TypeError: Cannot destructure property 'slots'` and unmounted
  the whole app (dark theme: a black screen). The fallback moved into the
  template (`actionIcon ?? Plus`) and the reason is documented in the component.
- **Fixed: throwing i18n messages in the admin dashboard.** `admin.blockConfirm`
  and `admin.bulk.selectUser` used `@{username}`, which vue-i18n reads as
  *linked-message* syntax rather than a placeholder; compiling them threw
  `SyntaxError` while rendering the users table. They are plain `{username}`
  placeholders now (en and uk).
- **Added:** `pnpm --filter @testing-system/web-client test` — six `node:test`
  checks that compile and resolve every message in both locales, reject
  accidental plural/linked syntax (`|`, `@{`), assert that `uk` mirrors the `en`
  key structure, and that interpolated placeholders match across locales. This
  is what catches the class of bug above at build time.
- **Fixed: pending student registrations were hard to find.** The queue was just
  rows inside the admin users table, and the "Participants" tab (course
  enrollments) looked like the place to look, so a fresh registration appeared to
  have vanished. The admin dashboard now shows a callout — "N student accounts
  are waiting for approval" — with a **Review pending** button that opens the
  users tab pre-filtered to `pending`, plus a count badge on the Users tab. The
  badge and callout refresh after every approve, block or teacher creation and
  disappear when the queue is empty.
- **Fixed:** the registration and pending screens promised approval "by a
  teacher or administrator", but only an administrator can approve (the status
  endpoint is admin-only) and the teacher dashboard has no approval queue. Both
  locales now say administrator.
- All emoji and decorative glyphs replaced by Lucide icons
  (`@lucide/vue`): role picker, show/hide password, student phase cards,
  material rows, back arrow, question/pair removal, matching pairs swap,
  toast dismissal, theme switcher. **New dependency: `@lucide/vue`**
  (the deprecated `lucide-vue-next` package is not used).

### Changed
- **UI/UX polish batch 3 (v0.1.1): light + dark themes.** The whole UI now
  runs on a semantic Material 3 Expressive token layer defined once in
  `theme.css` (`@theme inline`, `:root` / `.dark`): surfaces, on-surface text,
  outlines plus primary/secondary/error/success/warning and their containers,
  and a scrim. Every raw palette class was migrated to the tokens, so both
  themes work everywhere.
- Dark mode is class-based (`<html class="dark">`) with a **theme switcher**
  in every header (Sun/Moon icon). The choice is persisted; on first run the
  OS preference wins. An inline boot script applies the theme before first
  paint (no light flash), and `theme-color` meta tags follow the OS scheme.
- Accessibility defaults: a global `:focus-visible` ring and a
  `prefers-reduced-motion` guard that neutralises transitions/animations.
- **New design rule** (ROADMAP "Design rules" + AGENTS.md): no emoji in the
  UI — icons come from Lucide only; one cohesive M3 Expressive style; colour
  only through semantic theme tokens; exactly two themes (light and dark).

### Fixed
- **Black screen for brand-new teacher accounts.** A teacher with no tests
  and no courses mounts the empty state, whose `withDefaults()` used a
  Lucide icon as a prop default. Vue treats a function default as a factory
  and calls it, while Lucide icons are functional components that
  destructure their second argument — every mount threw and unmounted the
  app. The fallback moved into the template, with a comment explaining why
  it must stay out of `withDefaults`.
- **Throwing i18n messages in the admin dashboard.** `admin.blockConfirm` and
  `admin.bulk.selectUser` used `@{username}`, which vue-i18n reads as
  *linked-message* syntax rather than a placeholder, so compiling them threw
  `SyntaxError` while rendering the users table.
- **Focus rings were invisible app-wide.** Every input carried Tailwind's
  `outline-none`, whose utility layer beats the global `:focus-visible` rule.

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

[0.4.2]: https://github.com/flassuu/knowledge-testing-system/releases/tag/v0.4.2
[0.4.1]: https://github.com/flassuu/knowledge-testing-system/releases/tag/v0.4.1
[0.4.0]: https://github.com/flassuu/knowledge-testing-system/releases/tag/v0.4.0
[0.3.0]: https://github.com/flassuu/knowledge-testing-system/releases/tag/v0.3.0
[0.2.0]: https://github.com/flassuu/knowledge-testing-system/releases/tag/v0.2.0
[0.1.0]: https://github.com/flassuu/knowledge-testing-system/releases/tag/v0.1.0
[0.0.1]: https://github.com/flassuu/knowledge-testing-system/releases/tag/v0.0.1
