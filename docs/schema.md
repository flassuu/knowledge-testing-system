# Database schema

Schema of the system at v0.4.0. SQLite via `node:sqlite` (`DatabaseSync`);
ids are server-side UUIDs; timestamps are stored as ISO-8601 UTC strings. The
schema is enforced by idempotent, versioned migrations run at server startup;
`GET /api/admin/stats` reports the applied version as `schemaVersion`.

> Status: **current**, still at version 4. Phases 1–3 added the tables:
> roles and auth, the test/course core, and the live-session runtime.
> **Reporting (Phase 4) added no tables on purpose** — the grade journal and
> per-question difficulty are derived from `participations` and
> `participation_answers`, which already record who answered what and whether
> it was right. Storing an aggregate would only add a second source of truth
> that has to be recomputed every time a session is graded.

## Conventions

- `id` — `TEXT` UUID (server-side generated).
- `created_at` / `updated_at` — `TEXT` ISO-8601 UTC.
- FK deletions are `RESTRICT` unless noted; uniqueness enforced where listed.
- Enums are stored as `TEXT` with a `CHECK` constraint (survives binary
  recompilation without codegen).

## Tables

### users

Accounts for all three roles. The built-in **admin is seeded** on first run
(bootstrap account, see migrations).

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| role | TEXT | `admin \| teacher \| student` |
| status | TEXT | `pending \| approved \| blocked` |
| username | TEXT UNIQUE | login |
| password_hash | TEXT | salted hash (argon2id) |
| full_name | TEXT | display name (ПІБ for teachers) |
| created_at / updated_at | TEXT | ISO-8601 UTC |

- **Admin** is seeded by the system at first startup; cannot be deleted.
- **Teachers** are created by an admin (status `approved` immediately).
- **Students** register themselves → status `pending` until an **administrator**
  approves them (the status endpoint is admin-only). `blocked` revokes access
  and invalidates every token.

### courses

Teacher-created containers of materials and tests (Google Classroom style).

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| owner_id | TEXT FK users.id | creating teacher |
| title | TEXT | |
| description | TEXT | |
| created_at / updated_at | TEXT | |

### course_enrollments

Links students to courses.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| course_id | TEXT FK courses.id | |
| user_id | TEXT FK users.id | student |
| enrolled_at | TEXT | |
| UNIQUE (course_id, user_id) | | no duplicate enrollments |

### materials

Files attached to a course (PDF, images, …), served as static files.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| course_id | TEXT FK courses.id | |
| title | TEXT | |
| file_path | TEXT | relative to data dir |
| mime_type | TEXT | |
| size_bytes | INTEGER | |
| created_at | TEXT | |

### tests

A test is a set of questions; it can be shared directly or via courses.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| owner_id | TEXT FK users.id | creating teacher |
| title | TEXT | |
| description | TEXT | |
| time_limit_sec | INTEGER | nullable — no time limit |
| passing_percent | INTEGER | admin/teacher configurable threshold |
| created_at / updated_at | TEXT | |

### questions

Five supported types, stored uniformly with JSON payloads.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| test_id | TEXT FK tests.id | |
| type | TEXT | `single_choice \| multiple_choice \| true_false \| short_answer \| matching` |
| body | TEXT | question text |
| payload | TEXT JSON | options + correct answer(s), per type |
| points | INTEGER | score for a fully correct answer |
| position | INTEGER | ordering inside the test |
| UNIQUE (test_id, position) | | stable ordering |

Payload shapes (draft):

- `single_choice` / `multiple_choice` — `{ options: [{key, text}], correct: [key] | key }`
- `true_false` — `{ correct: boolean }`
- `short_answer` — `{ accepted: string[] }` (case-insensitive compare)
- `matching` — `{ pairs: [{left, right}], keys: [{key, text}] }`

### app_meta

Key/value bookkeeping for the migrations themselves.

| Column | Type | Notes |
|--------|------|-------|
| key | TEXT PK | e.g. `schema_version` |
| value | TEXT | applied version |

### sessions

Auth tokens. One row per signed-in client; the token is stored hashed.

| Column | Type | Notes |
|--------|------|-------|
| token_hash | TEXT PK | sha256 of the opaque token |
| user_id | TEXT FK users.id | cascades on delete |
| created_at | TEXT | |
| expires_at | TEXT | 12 h after login |

> Name clash worth knowing: the **live** session of a test is `live_sessions`
> below, not this table.

### live_sessions

One live run of a test, started by a teacher and joined by students with a
short code. Created already `active` — there is no draft state.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| test_id | TEXT FK tests.id | cascades |
| owner_id | TEXT FK users.id | teacher who started it |
| join_code | TEXT UNIQUE | 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous 0/O or 1/I) |
| status | TEXT | `active \| paused \| finished` |
| time_limit_sec | INTEGER | snapshot of the test at start |
| passing_percent | INTEGER | snapshot of the test at start |
| created_at / started_at | TEXT | |
| finished_at | TEXT | nullable |

The snapshots are deliberate: editing the test while a session runs changes
nothing for the students already answering.

### participations

One row per student who joined a session, holding their personal question
order and their result.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| session_id | TEXT FK live_sessions.id | cascades |
| user_id | TEXT FK users.id | cascades |
| status | TEXT | `joined \| submitted \| auto_submitted` |
| question_order | TEXT JSON | array of question ids — the per-student shuffle, fixed at join so a reload never reshuffles |
| score | INTEGER | points earned, nullable until submitted |
| max_score | INTEGER | points on offer |
| percent | INTEGER | `round(score / max_score × 100)` |
| passed | INTEGER | 0/1, **NULL when the test has no pass mark** |
| joined_at | TEXT | |
| submitted_at | TEXT | nullable |
| UNIQUE (session_id, user_id) | | one participation per student |

### participation_answers

The submitted paper, one graded row per question. Rewritten on every
submission, so a student who resubmits before the session closes does not
accumulate rows.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| participation_id | TEXT FK participations.id | cascades |
| question_id | TEXT FK questions.id | cascades |
| payload | TEXT JSON | the raw answer, per question type |
| is_correct | INTEGER | 0/1 |
| points_awarded | INTEGER | |
| UNIQUE (participation_id, question_id) | | one answer per question |

## Relationship overview

```
users ─┬─ owns ──▶ courses ──┬─ has ──▶ materials
       │         │            ├─ enrolls ─▶ course_enrollments ─▶ users (student)
       │         │            └─ runs ───▶ course_tests ─────────▶ tests
       ├─ owns ──▶ tests ──▶ questions
       ├─ signs in ─▶ sessions            (auth tokens, hashed)
       └─ runs ────▶ live_sessions ──▶ participations ──▶ participation_answers ──▶ questions
```

## Migration notes

- v1 creates `app_meta`.
- v2 creates `users` (with the built-in admin seed) and `sessions`.
- v3 creates `tests`, `questions`, `courses`, `course_enrollments`,
  `course_tests`, `materials`.
- v4 creates `live_sessions`, `participations`, `participation_answers`.
- Migrations run idempotently at startup, in order; each is wrapped in a
  transaction and versioned in `schema_migrations`.