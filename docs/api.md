# API Reference

Conventions: REST + JSON, errors as `{ "error": { "code", "message" } }`
(validation failures → `400 VALIDATION`), realtime over WebSocket at `/ws`.
Auth uses `Authorization: Bearer <token>`; tokens are opaque, DB-backed
sessions valid for 12 hours.

CORS is enabled (`@fastify/cors`, origin reflected) so browser-based clients
on other origins — including the Tauri desktop webview (`tauri://localhost`),
which is a different origin from `http://localhost:3300` — can call the API
directly. The desktop app therefore always targets the local Node server at
its API base (`VITE_API_TARGET` at build time, default `http://localhost:3300`);
the Vite dev proxy is only a convenience for `pnpm dev:web` / `dev:desktop`.

## Health

### `GET /api/health`

Probe used by clients to confirm the local server is up. Public.

```json
{
  "status": "ok",
  "version": "0.4.0",
  "database": "ok",
  "uptime_ms": 1234,
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Authentication (`/api/auth`)

### `POST /api/auth/register`

Student self-registration. The account is created with status `pending` until
a teacher or admin approves it. Public.

Request body:

```json
{ "username": "student1", "password": "secret-pass-1", "fullName": "Student One" }
```

- `201` → `{ "user": {...} }` (status `pending`)
- `409 CONFLICT` — username already taken
- `400 VALIDATION` — missing/invalid fields

### `POST /api/auth/login`

Verifies credentials and issues a role-scoped bearer token. Public.

Request body:

```json
{ "username": "admin", "password": "admin" }
```

- `200` → `{ "token": "<opaque>", "user": {...} }`
- `401 INVALID_CREDENTIALS` — bad username/password
- `403 PENDING_APPROVAL` / `403 BLOCKED` — account not usable

### `POST /api/auth/logout`

Revokes the current session. Requires a valid token. → `204`.

### `GET /api/auth/me`

Returns the logged-in user. Requires a valid token.

```json
{ "user": { "id": "…", "role": "student", "status": "approved", "username": "student1", "fullName": "Student One", "createdAt": "…", "updatedAt": "…" } }
```

## User management (`/api/users`, admin only)

Users are returned without password material: `{ id, role, status, username, fullName, createdAt, updatedAt }`.

### `GET /api/users`

List users. Query: `role` (`admin|teacher|student`), `status`
(`pending|approved|blocked`), `q` (substring on username/fullName).

```json
{ "users": [ { "user": {...} } ] }
```

### `POST /api/users`

Admin creates a teacher (approved immediately). Request body like
`register`; role is always `teacher`.

- `201` → `{ "user": {...} }`
- `409 CONFLICT` — username already taken

### `PATCH /api/users/:id/status`

Admin approves/blocked a student or teacher. Body:
`{ "status": "pending" | "approved" | "blocked" }`. Blocking revokes all
active sessions for that user. Admin accounts are immutable.

- `200` → `{ "user": {...} }`
- `400 INVALID_OPERATION` — target is an admin account
- `404 NOT_FOUND` — no such user

### `DELETE /api/users/:id`

Admin removes a teacher or student (sessions cascade). Admin accounts are
immutable. → `204`.

## Tests (`/api/tests`, admin & teacher)

A test belongs to its creator; admins see everything, teachers only their own.
Questions carry a per-type `payload`:

| Type | Payload |
|------|---------|
| `single_choice` | `{ "options": [{ "key", "text" }], "correct": "key" }` |
| `multiple_choice` | `{ "options": [{ "key", "text" }], "correct": ["key", ...] }` |
| `true_false` | `{ "correct": boolean }` |
| `short_answer` | `{ "accepted": ["Paris", ...] }` |
| `matching` | `{ "pairs": [{ "left", "right" }, ...] }` |

### `GET /api/tests`

List own tests (admin: all). → `{ "tests": [{ id, ownerId, title, description, timeLimitSec, passingPercent, questionCount, createdAt, updatedAt }] }`

### `POST /api/tests`

Create a test. Body:

```json
{
  "title": "Intro quiz",
  "description": "First test",
  "timeLimitSec": 600,
  "passingPercent": 60,
  "questions": [{ "type": "single_choice", "body": "…", "points": 2, "position": 0, "payload": { "options": [{ "key": "a", "text": "A" }, { "key": "b", "text": "B" }], "correct": "a" } }]
}
```

- `201` → full test with questions
- `400 VALIDATION` — any question payload is invalid

### `GET /api/tests/:id`

- `200` → `{ "test": { ...test, "questions": [...] } }`
- `403` — not the owner (non-admin) · `404`

### `PUT /api/tests/:id`

Replaces title/limits and **all** questions (positions must stay 0-based
sequential). Same body and errors as `POST`.

### `DELETE /api/tests/:id`

Removes the test; questions cascade. → `204`.

### `GET /api/tests/:id/results`

Grade journal for one test, aggregated over **every** session it was run in.
Attempts still in progress are ignored. Both class figures are judged on each
student's last attempt, so a student who improved since the first try is not
counted as a fail; `passRate` is `null` when the test has no pass mark rather
than reading as 0 percent.

```json
{
  "test": { "id": "…", "title": "Photosynthesis", "passingPercent": 50 },
  "students": 2, "submissions": 3, "averagePercent": 50, "passRate": 67,
  "journal": [{ "userId": "…", "username": "ana", "fullName": "Ana K.",
                "attempts": 2, "bestPercent": 100, "lastPercent": 25,
                "lastPassed": false, "averagePercent": 63, "lastSubmittedAt": "…" }],
  "questions": [{ "questionId": "…", "body": "…", "type": "true_false", "points": 1,
                  "answers": 24, "correct": 7, "percent": 29 }]
}
```

`questions` lists every question of the test, including ones nobody has answered
yet (`answers: 0`). → `403` for a student or another teacher · `404`.

## Courses (`/api/courses`, admin & teacher)

A course groups materials (files) and tests, and enrolls students.

### `GET /api/courses`

Own courses (admin: all), each with `materialsCount`, `testsCount`,
`studentsCount`. → `{ "courses": [...] }`

### `POST /api/courses` / `PATCH /api/courses/:id`

Body: `{ "title": "Physics 101", "description": "…" }`. `POST` → `201`.
`GET /api/courses/:id` returns the full course with `materials`, `tests`
(`{ id, title }`), and `students` (`{ id, username, fullName }`).

### `DELETE /api/courses/:id`

Removes the course and its enrollments/links/materials. → `204`.

### Enrollments

- `POST /api/courses/:id/enrollments` with `{ "username": "student1" }` →
  `201` (student must exist with status `approved`); `409 CONFLICT` if already
  enrolled; `400 INVALID_OPERATION` otherwise.
- `DELETE /api/courses/:id/enrollments/:userId` → `204`.

### Attach / detach tests

- `POST /api/courses/:id/tests` with `{ "testId": "…" }` → `201`;
  `409 CONFLICT` when already attached.
- `DELETE /api/courses/:id/tests/:testId` → `204`.

### Materials

- `POST /api/courses/:id/materials?name=notes.pdf` — raw body
  (`Content-Type: application/octet-stream`, no multipart). → `201`
  `{ id, courseId, title, mimeType, sizeBytes, createdAt }`. 100 MiB cap;
  MIME detected from the extension (pdf, images, office, zip, …).
- `GET /api/courses/:id/materials/:materialId/file` — streams the file back
  with its MIME type and `Content-Disposition: attachment`.

## Admin insights (`/api/admin`, admin only)

### `GET /api/admin/stats`

Aggregated DB health and table counts — the admin "System & DB" screen.

```json
{
  "stats": {
    "version": "0.4.0",
    "uptimeMs": 1234,
    "schemaVersion": 4,
    "database": "ok",
    "counts": {
      "users": 5, "admins": 1, "teachers": 1, "students": 3,
      "pendingUsers": 1, "approvedUsers": 4, "blockedUsers": 0,
      "tests": 2, "questions": 7, "courses": 2,
      "enrollments": 4, "materials": 2
    }
  }
}
```

### `GET /api/admin/participants`

Flat course → student participation list (the admin "Participants" screen).

```json
{
  "participants": [
    { "courseId": "…", "courseTitle": "Physics 101", "studentId": "…",
      "username": "student1", "fullName": "Student One",
      "status": "approved", "enrolledAt": "2026-01-01T00:00:00.000Z" }
  ]
}
```

Ordered by course title, then enrollment date.

## Live sessions (`/api/sessions`)

A **session** is one live run of a test. A teacher starts it, students join
with a six-character code, answer, and the server grades and stores the paper.

A session snapshots the test's time limit and pass mark at start, so editing
the test mid-run changes nothing for the students already answering. It is
created already `active`; `PATCH` moves it to `paused` or `finished`.

Every entry point that grades or closes a session also sweeps expired
participations: once the time limit has passed, anyone still working is
auto-submitted with zero and the session closes. A teacher who forgets to end
a session therefore costs nobody their attempt.

### Answer payload

Answers are keyed by **question id**, so the shuffled order never matters. One
flat shape per question type:

| Type | Body |
|------|------|
| `single_choice` | `{ "key": "a" }` — the chosen option key |
| `multiple_choice` | `{ "keys": ["a", "c"] }` |
| `true_false` | `{ "boolean": true }` |
| `short_answer` | `{ "text": "oxygen" }` |
| `matching` | `{ "pairs": [{ "left": "Cat", "right": "Animal" }] }` |

Unanswered or malformed answers score zero. Short answers are compared trimmed,
whitespace-collapsed and case-insensitively against the accepted list;
multiple choice is an exact set match, and duplicate keys never collapse into a
match.

### `GET /api/sessions`

Admin & teacher. The teacher's own sessions, newest first; an admin sees every
teacher's.

```json
{ "sessions": [ { "id": "…", "joinCode": "JV8Z9B", "status": "active",
                  "timeLimitSec": 600, "passingPercent": 50,
                  "title": "Mixed quiz", "questionCount": 5,
                  "joinedCount": 2, "submittedCount": 1 } ] }
```

### `POST /api/sessions`

Admin & teacher. Body `{ "testId": "…" }` → `201` with the new session.

- `400 VALIDATION` — the test has no questions yet
- `403 FORBIDDEN` — the test belongs to another teacher

### `GET /api/sessions/:id/participants`

Admin & teacher (owner). The live board: the session plus one row per student.

```json
{ "session": { "id": "…", "status": "active", "…": "…" },
  "participants": [ { "userId": "…", "username": "student1",
                      "fullName": "Student One", "status": "submitted",
                      "score": 6, "percent": 75, "passed": true,
                      "joinedAt": "…", "submittedAt": "…" } ] }
```

`passed` is `null` when the test has no pass mark. `status` is `joined` while
the student is still working, then `submitted` or `auto_submitted`.

### `PATCH /api/sessions/:id`

Admin & teacher (owner). Body `{ "status": "paused" | "active" | "finished" }`
→ `200` with the session. `409 CONFLICT` once it is finished.

### `GET /api/sessions/:id/review`

Admin & teacher (owner). The paper **with** the answer key, for the teacher's
own review screen. Students never receive this payload.

### `POST /api/sessions/join`

Student only. Body `{ "code": "JV8Z9B" }` → `201`. Case and stray spaces are
normalised, so a code read out in class or pasted from a slide works.

```json
{ "participation": { "id": "…", "status": "joined", "questionOrder": ["…"] },
  "session": { "id": "…", "status": "active", "timeLimitSec": 600,
               "passingPercent": 50, "startedAt": "…", "serverNow": "…" },
  "questions": [ { "id": "…", "type": "single_choice", "body": "Capital?",
                   "points": 2, "position": 0,
                   "payload": { "options": [{ "key": "a", "text": "Kyiv" }] } } ] }
```

`serverNow` lets the client correct its clock for the round trip. The payload
carries **no answer key**: `correct` is stripped from choices, `accepted` from
short answers. Re-joining returns the same participation and the same order.

- `404 NOT_FOUND` — no session with that code
- `409 CONFLICT` — the session is finished or paused

### `GET /api/sessions/current`

Student only. The session **still in progress** with the same shape as `join`,
so a reload lands back on the same paper. Only a participation with status
`joined` counts: a finished attempt is history, not something to resume, and the
student home shows it in the results list instead. `404 NOT_FOUND` when nothing
is running.

### `POST /api/sessions/:id/submit`

Student only. Body `{ "answers": { "<questionId>": … } }`.

```json
{ "participation": { "status": "submitted", "…": "…" },
  "result": { "score": 6, "maxScore": 8, "percent": 75, "passed": true } }
```

- `403 FORBIDDEN` — the student never joined
- `409 CONFLICT` — already submitted, or the session is over

### `GET /api/sessions/:id/result`

Student only, their own participation. `409 CONFLICT` before submitting.
Returns the graded paper, each question with `isCorrect`, `pointsAwarded` and
**the answer key**, so the student can learn from the result.

### `GET /api/student/results`

Student only. The student's own finished attempts (status `joined` excluded),
newest first, capped at 50 — the results list on the student home.

```json
{ "results": [{ "participationId": "…", "sessionId": "…", "joinCode": "ABC123",
                "testId": "…", "testTitle": "Photosynthesis", "questionCount": 2,
                "status": "submitted", "score": 4, "maxScore": 4,
                "percent": 100, "passed": true, "submittedAt": "…" }] }
```

`passed` is `null` for a test without a pass mark, which the client shows as a
neutral "Completed" rather than a failure.

### `GET /api/sessions/:id/results.csv`

Admin & teacher (owner). The session as a spreadsheet: `text/csv; charset=utf-8`
with a `content-disposition` filename, a header block (test, join code, status,
start/finish, pass mark), a blank line, then one row per participant with
score, percent, pass and submission time. Fields containing a comma or a quote
are quoted, and the file starts with a UTF-8 BOM so spreadsheet apps read
non-ASCII names correctly.

Because the API authenticates with an `Authorization` header rather than a
cookie, a plain `<a href>` to this endpoint is rejected — the client fetches it
with the token and saves it as a blob.

→ `403` for another teacher's session · `404`

## Reporting

Two endpoints cover what a teacher needs after a run, and they answer different
questions:

| Question | Endpoint |
|----------|----------|
| How did the class do, and which question needs reteaching? | `GET /api/tests/:id/results` — the journal plus per-question difficulty, across every session of that test |
| Give me the sheet for this session | `GET /api/sessions/:id/results.csv` — one row per participant |

Both are teacher-or-admin, scoped to what the caller owns. The journal is what
the app's report screen renders; the CSV is meant to leave the app.

## Realtime (`/ws`)

### `GET /ws/sessions/:id`

A WebSocket carrying the session live. Browsers cannot set headers on a
WebSocket handshake, so the token travels in the query string:
`/ws/sessions/<id>?token=<token>`.

| Message | Sent to | Meaning |
|---------|---------|---------|
| `{ "type": "status", "status": "active", "serverNow": "…" }` | everyone in the session | state on connect and on every change |
| `{ "type": "participants", "participants": [ … ] }` | teachers only | the board, on connect and after every join, submit, pause, resume, finish and timeout sweep |
| `{ "type": "error", "code": "…", "message": "…" }` | the offender | then the socket closes |

Rejections close with a code rather than connecting silently: `4401`
unauthenticated, `4403` not your session (a student who never joined, or a
teacher who does not own it), `4404` unknown session.

## Roles & access

| Endpoint | Admin | Teacher | Student |
|----------|:-----:|:-------:|:-------:|
| `POST /api/auth/register` | + | + | + (student only) |
| `POST /api/auth/login` | + | + | + |
| `POST /api/auth/logout`, `GET /api/auth/me` | + | + | + |
| `GET/POST /api/users`, `PATCH/DELETE /api/users/:id` | + | – | – |
| `/api/tests`, `/api/tests/:id`, `/api/courses*` | + | + (own) | – |
| `GET /api/tests/:id/results` | + | + (own) | – |
| `GET/POST /api/sessions`, `PATCH /api/sessions/:id`, `…/participants`, `…/review`, `…/results.csv` | + | + (own) | – |
| `POST /api/sessions/join`, `GET /api/sessions/current`, `/:id/submit`, `/:id/result`, `/api/student/results` | – | – | + |
| `GET /ws/sessions/:id` | + (board) | + (board) | + (status only) |
| `/api/admin/stats`, `/api/admin/participants` | + | – | – |
