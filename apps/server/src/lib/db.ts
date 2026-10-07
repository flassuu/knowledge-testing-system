import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { hashPassword } from './passwords'

export interface Database {
  /** Set when an empty database was seeded with the default admin account. */
  seededAdminWarning: string | null
  raw: DatabaseSync
  close(): void
}

export function nowIso(): string {
  return new Date().toISOString()
}

export const SCHEMA_VERSION = 5

const MIGRATIONS: Array<{ version: number; up: string }> = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS app_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        role          TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
        status        TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'blocked')),
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name     TEXT NOT NULL DEFAULT '',
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    `,
  },
  {
    version: 3,
    up: `
      CREATE TABLE IF NOT EXISTS tests (
        id              TEXT PRIMARY KEY,
        owner_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title           TEXT NOT NULL,
        description     TEXT NOT NULL DEFAULT '',
        time_limit_sec  INTEGER,
        passing_percent INTEGER,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tests_owner ON tests(owner_id);

      CREATE TABLE IF NOT EXISTS questions (
        id       TEXT PRIMARY KEY,
        test_id  TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        type     TEXT NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'matching')),
        body     TEXT NOT NULL,
        payload  TEXT NOT NULL,
        points   INTEGER NOT NULL DEFAULT 1,
        position INTEGER NOT NULL,
        UNIQUE (test_id, position)
      );
      CREATE INDEX IF NOT EXISTS idx_questions_test ON questions(test_id);

      CREATE TABLE IF NOT EXISTS courses (
        id          TEXT PRIMARY KEY,
        owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_courses_owner ON courses(owner_id);

      CREATE TABLE IF NOT EXISTS course_enrollments (
        id          TEXT PRIMARY KEY,
        course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        enrolled_at TEXT NOT NULL,
        UNIQUE (course_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS course_tests (
        id        TEXT PRIMARY KEY,
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        test_id   TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        added_at  TEXT NOT NULL,
        UNIQUE (course_id, test_id)
      );

      CREATE TABLE IF NOT EXISTS materials (
        id         TEXT PRIMARY KEY,
        course_id  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        file_path  TEXT NOT NULL,
        mime_type  TEXT NOT NULL DEFAULT 'application/octet-stream',
        size_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_materials_course ON materials(course_id);
    `,
  },
  {
    version: 4,
    up: `
      -- A live session is one run of a test that students join with a short code.
      CREATE TABLE IF NOT EXISTS live_sessions (
        id               TEXT PRIMARY KEY,
        test_id          TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        owner_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        join_code        TEXT NOT NULL UNIQUE,
        status           TEXT NOT NULL CHECK (status IN ('active', 'paused', 'finished')),
        -- Snapshots of the test settings, so editing the test mid-run is harmless.
        time_limit_sec   INTEGER,
        passing_percent  INTEGER,
        created_at       TEXT NOT NULL,
        started_at       TEXT NOT NULL,
        finished_at      TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_live_sessions_owner ON live_sessions(owner_id);
      CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);

      CREATE TABLE IF NOT EXISTS participations (
        id             TEXT PRIMARY KEY,
        session_id     TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
        user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status         TEXT NOT NULL CHECK (status IN ('joined', 'submitted', 'auto_submitted')),
        -- JSON array of question ids: the per-student order stays stable on reload.
        question_order TEXT NOT NULL,
        score          INTEGER,
        max_score      INTEGER,
        percent        INTEGER,
        passed         INTEGER,
        joined_at      TEXT NOT NULL,
        submitted_at   TEXT,
        UNIQUE (session_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_participations_session ON participations(session_id);
      CREATE INDEX IF NOT EXISTS idx_participations_user ON participations(user_id);

      CREATE TABLE IF NOT EXISTS participation_answers (
        id               TEXT PRIMARY KEY,
        participation_id TEXT NOT NULL REFERENCES participations(id) ON DELETE CASCADE,
        question_id      TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        payload          TEXT NOT NULL,
        is_correct       INTEGER NOT NULL,
        points_awarded   INTEGER NOT NULL,
        UNIQUE (participation_id, question_id)
      );
      CREATE INDEX IF NOT EXISTS idx_answers_participation ON participation_answers(participation_id);
    `,
  },
  {
    version: 5,
    up: `
      -- A classroom is a teacher's own group: a key a student can register with,
      -- so a teacher alone can get their class in without an admin in the room.
      CREATE TABLE IF NOT EXISTS classrooms (
        id         TEXT PRIMARY KEY,
        owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        -- Same alphabet as join codes: read aloud, no 0/O or 1/I.
        key        TEXT NOT NULL UNIQUE,
        status     TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
        -- Optional: everyone who arrives through this class joins the course too.
        course_id  TEXT REFERENCES courses(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_classrooms_owner ON classrooms(owner_id);

      -- Who came in through which class. A join table rather than a column on
      -- users: one student can pass through several classes over a school year.
      CREATE TABLE IF NOT EXISTS classroom_members (
        id           TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
        user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at    TEXT NOT NULL,
        UNIQUE (classroom_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_classroom_members_class ON classroom_members(classroom_id);
    `,
  },
]

function migrate(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);',
  )
  const row = db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .get('schema_version') as { value: string } | undefined
  const current = row ? Number(row.value) : 0

  for (const migration of MIGRATIONS) {
    if (migration.version > current) {
      db.exec('BEGIN')
      try {
        db.exec(migration.up)
        db.prepare(
          'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        ).run('schema_version', String(migration.version))
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    }
  }
}

/**
 * Seeds the built-in admin account on first boot. Credentials can be
 * overridden via ADMIN_USERNAME / ADMIN_PASSWORD; the defaults are meant for
 * LAN demos only and warn loudly when left as-is.
 */
/**
 * Seeds the built-in admin on an empty database.
 *
 * Returns what it did instead of printing it: a line written with `console` never
 * reaches the log stream, so on the desktop it would arrive as plain text with no
 * level and be shown as an error. The caller logs it properly.
 */
export function seedAdmin(db: DatabaseSync): string | null {
  const existing = db
    .prepare('SELECT id FROM users WHERE role = ? LIMIT 1')
    .get('admin')
  if (existing) return null

  const username = process.env.ADMIN_USERNAME ?? 'admin'
  const password = process.env.ADMIN_PASSWORD ?? 'admin'
  const now = nowIso()
  db.prepare(
    `INSERT INTO users (id, role, status, username, password_hash, full_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    'admin',
    'approved',
    username,
    hashPassword(password),
    'System Administrator',
    now,
    now,
  )
  if (!process.env.ADMIN_PASSWORD) {
    return `seeded default admin account '${username}'/'${password}' — set ADMIN_PASSWORD to override`
  }
  return null
}

export function openDatabase(dbPath: string): Database {
  const raw = new DatabaseSync(dbPath)
  raw.exec('PRAGMA journal_mode = WAL;')
  raw.exec('PRAGMA foreign_keys = ON;')
  migrate(raw)
  const seeded = seedAdmin(raw)
  return {
    raw,
    /** A warning the caller should log; null when there is nothing to say. */
    seededAdminWarning: seeded,
    close() {
      raw.close()
    },
  }
}

export function checkDatabase(db: Database): boolean {
  return schemaVersion(db) === SCHEMA_VERSION
}

export function schemaVersion(db: Database): number {
  try {
    const row = db.raw
      .prepare('SELECT value FROM app_meta WHERE key = ?')
      .get('schema_version') as { value: string } | undefined
    return row ? Number(row.value) : 0
  } catch {
    return 0
  }
}