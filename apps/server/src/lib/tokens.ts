import { createHash, randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

/**
 * Opaque bearer sessions stored in SQLite. Only the SHA-256 digest of the
 * token is persisted, so a leaked DB snapshot cannot be replayed directly.
 */
const TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000 // 12 hours

export interface Session {
  token: string
  userId: string
  role: string
  status: string
}

interface SessionRow {
  token_hash: string
  expires_at: string
  user_id: string
  role: string
  status: string
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function createSession(db: DatabaseSync, userId: string): string {
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(
    sha256(token),
    userId,
    new Date(now).toISOString(),
    new Date(now + TOKEN_LIFETIME_MS).toISOString(),
  )
  return token
}

/** Resolves a bearer token to a session, or null when invalid/expired/blocked. */
export function resolveSession(
  db: DatabaseSync,
  token: string | undefined,
): Session | null {
  if (!token) return null
  const row = db
    .prepare(
      `SELECT s.token_hash, s.expires_at, s.user_id, u.role, u.status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(sha256(token)) as SessionRow | undefined
  if (!row || row.status === 'blocked') return null
  if (Date.parse(row.expires_at) < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash)
    return null
  }
  return {
    token,
    userId: row.user_id,
    role: row.role,
    status: row.status,
  }
}

export function deleteSession(db: DatabaseSync, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
}

/** Deletes a session already stored as its SHA-256 digest. */
export function deleteSessionByHash(
  db: DatabaseSync,
  tokenHash: string,
): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
}