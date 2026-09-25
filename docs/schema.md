# Database schema

Draft schema for the role-based system (v0.1.0 foundation). SQLite via
`node:sqlite` (`DatabaseSync`); ids are server-side UUIDs; timestamps are
stored as ISO-8601 UTC strings. The schema evolves per roadmap phase and is
enforced by idempotent, versioned migrations run at server startup.

> Status: **draft** — refined in Phase 1 (Foundation). The auth/roles and
> course/test core are already decided; session & reporting tables will get
> their full shape in Phase 3.

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
- **Students** register themselves → status `pending` until a teacher or admin
  approves (> `approved`). `blocked` revokes access.

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

### sessions

A live run of a test, driven by a teacher on the admin-connected network.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| test_id | TEXT FK tests.id | |
| owner_id | TEXT FK users.id | running teacher |
| join_code | TEXT UNIQUE | 6 uppercase chars |
| state | TEXT | `created \| active \| paused \| finished` |
| started_at / ended_at | TEXT | nullable |
| created_at | TEXT | |

### participants

One row per student joining a session.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| session_id | TEXT FK sessions.id | |
| user_id | TEXT FK users.id | nullable — guest join by name |
| display_name | TEXT | |
| token | TEXT UNIQUE | per-session participant token |
| questions_order | TEXT JSON | deterministic per-student shuffle |
| score | INTEGER | points earned |
| max_score | INTEGER | points available |
| percent | REAL | score / max_score × 100 |
| finished_at | TEXT | nullable |

### answers

Captured responses, one row per question per participant.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| participant_id | TEXT FK participants.id | |
| question_id | TEXT FK questions.id | |
| response | TEXT JSON | raw answer, per question type |
| is_correct | INTEGER | 0/1 (nullable for partial) |
| points_earned | INTEGER | |
| answered_at | TEXT | |
| UNIQUE (participant_id, question_id) | | one answer per question |

## Relationship overview

```
users ─┬─ owns ──▶ courses ──┬─ has ──▶ materials
       │                    └─ enrolls ─▶ course_enrollments ─▶ users (student)
       ├─ owns ──▶ tests ──▶ questions
       └─ runs ──▶ sessions ──▶ participants ──▶ answers ──▶ questions
```

## Migration notes

- v1 creates `users` (with built-in admin seed), `courses`,
  `course_enrollments`, `materials`, `tests`, `questions`.
- v2 (Phase 3) adds `sessions`, `participants`, `answers`.
- Migrations run idempotently at startup, in order; each is wrapped in a
  transaction and versioned in `schema_migrations`.