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

const SCHEMA_VERSION = 2

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
  try {
    const row = db.raw
      .prepare('SELECT value FROM app_meta WHERE key = ?')
      .get('schema_version') as { value: string } | undefined
    return Boolean(row && Number(row.value) === SCHEMA_VERSION)
  } catch {
    return false
  }
}