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

## Roles & access

| Endpoint | Admin | Teacher | Student |
|----------|:-----:|:-------:|:-------:|
| `POST /api/auth/register` | + | + | + (student only) |
| `POST /api/auth/login` | + | + | + |
| `POST /api/auth/logout`, `GET /api/auth/me` | + | + | + |
| `GET/POST /api/users`, `PATCH/DELETE /api/users/:id` | + | – | – |

## Roadmap

Phase 2 adds tests & courses CRUD; Phase 3 adds sessions, participation and
the WebSocket hub; Phase 4 adds reporting and PDF/CSV export. Endpoint shapes
will be documented here as they land.