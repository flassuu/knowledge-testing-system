import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { hashPassword } from './passwords'

export interface Database {
  raw: DatabaseSync
  /** Returns true when freshly created. */
  close(): void
}

export function nowIso(): string {
  return new Date().toISOString()
}

const SCHEMA_VERSION = 3

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
function seedAdmin(db: DatabaseSync): void {
  const existing = db
    .prepare('SELECT id FROM users WHERE role = ? LIMIT 1')
    .get('admin')
  if (existing) return

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
    console.warn(
      `[server] seeded default admin account '${username}'/'${password}' — set ADMIN_PASSWORD to override`,
    )
  }
}

export function openDatabase(dbPath: string): Database {
  const raw = new DatabaseSync(dbPath)
  raw.exec('PRAGMA journal_mode = WAL;')
  raw.exec('PRAGMA foreign_keys = ON;')
  migrate(raw)
  seedAdmin(raw)
  return {
    raw,
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