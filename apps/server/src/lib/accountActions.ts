import type { DatabaseSync } from 'node:sqlite'
import { nowIso } from './db'
import { hashPassword } from './passwords'
import { deleteSessionByHash } from './tokens'
import {
  findUserById,
  findUserByUsername,
  toPublicUser,
  type UserRole,
  type UserRow,
  type UserStatus,
} from './users'

/**
 * Account state changes, in one place.
 *
 * `PATCH /api/users/:id/status` and the server console's `approve` and `block`
 * must not be two implementations of the same rule: one of them would eventually
 * forget that blocking also revokes live sessions, and a revoked session is the
 * whole point of blocking. So the rule lives here and both callers use it.
 */
export type StatusChange =
  | { ok: true; user: UserRow }
  | { ok: false; reason: 'not_found' | 'is_admin' }

export function setUserStatus(
  db: DatabaseSync,
  userId: string,
  status: UserStatus,
): StatusChange {
  const target = findUserById(db, userId)
  if (!target) return { ok: false, reason: 'not_found' }
  // Admins are immutable on purpose: an admin who blocks or demotes the last
  // admin has locked everyone out of the only screen that can undo it.
  if (target.role === 'admin') return { ok: false, reason: 'is_admin' }

  db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(
    status,
    nowIso(),
    target.id,
  )

  // Blocking revokes every active session immediately, not at token expiry.
  if (status === 'blocked') {
    const sessions = db
      .prepare('SELECT token_hash FROM sessions WHERE user_id = ?')
      .all(target.id) as Array<{ token_hash: string }>
    for (const session of sessions) {
      deleteSessionByHash(db, session.token_hash)
    }
  }

  const updated = findUserById(db, target.id)
  return updated ? { ok: true, user: updated } : { ok: false, reason: 'not_found' }
}

/** Convenience for the two callers that start from a username. */
export function setUserStatusByUsername(
  db: DatabaseSync,
  username: string,
  status: UserStatus,
): StatusChange {
  const user = findUserByUsername(db, username)
  if (!user) return { ok: false, reason: 'not_found' }
  return setUserStatus(db, user.id, status)
}

/** Sets a password directly, for a teacher locked out of their own account. */
export function setPasswordByUsername(
  db: DatabaseSync,
  username: string,
  password: string,
): boolean {
  const user = findUserByUsername(db, username)
  if (!user) return false
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    hashPassword(password),
    nowIso(),
    user.id,
  )
  // A password change ends every session that used the old one.
  const sessions = db
    .prepare('SELECT token_hash FROM sessions WHERE user_id = ?')
    .all(user.id) as Array<{ token_hash: string }>
  for (const session of sessions) {
    deleteSessionByHash(db, session.token_hash)
  }
  return true
}

/** Used by the console's `users` listing; the admin UI has its own filters. */
export function describeUser(row: UserRow): string {
  const publicUser = toPublicUser(row)
  return `${publicUser.username}  ${publicUser.role.padEnd(8)} ${row.status.padEnd(8)} ${publicUser.fullName}`
}

export type { UserRole, UserStatus }