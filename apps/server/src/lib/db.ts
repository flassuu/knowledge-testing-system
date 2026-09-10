import { DatabaseSync } from 'node:sqlite'

export interface Database {
  raw: DatabaseSync
  /** Returns true when freshly created. */
  close(): void
}

const SCHEMA_VERSION = 1

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

export function openDatabase(dbPath: string): Database {
  const raw = new DatabaseSync(dbPath)
  raw.exec('PRAGMA journal_mode = WAL;')
  raw.exec('PRAGMA foreign_keys = ON;')
  migrate(raw)
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