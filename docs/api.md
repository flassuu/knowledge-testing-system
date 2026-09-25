# API Reference

Conventions: REST + JSON, errors as `{ "error": { "code", "message" } }`
(validation failures → `400 VALIDATION`), realtime over WebSocket at `/ws`.
Auth uses `Authorization: Bearer <token>`; tokens are opaque, DB-backed
sessions valid for 12 hours.

## Health

### `GET /api/health`

Probe used by clients to confirm the local server is up. Public.

```json
{
  "status": "ok",
  "version": "0.0.1",
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

## Roles & access

| Endpoint | Admin | Teacher | Student |
|----------|:-----:|:-------:|:-------:|
| `POST /api/auth/register` | + | + | + (student only) |
| `POST /api/auth/login` | + | + | + |
| `POST /api/auth/logout`, `GET /api/auth/me` | + | + | + |
| `GET/POST /api/users`, `PATCH/DELETE /api/users/:id` | + | – | – |
| `/api/tests`, `/api/tests/:id`, `/api/courses*` | + | + (own) | – |

## Roadmap

Phase 3 adds live sessions (join code, participants, answers) and the
WebSocket hub; Phase 4 adds reporting and PDF/CSV export. Endpoint shapes
will be documented here as they land.