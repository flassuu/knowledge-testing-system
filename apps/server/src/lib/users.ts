import type { DatabaseSync } from 'node:sqlite'

export type UserRole = 'admin' | 'teacher' | 'student'
export type UserStatus = 'pending' | 'approved' | 'blocked'

export interface UserRow {
  id: string
  role: UserRole
  status: UserStatus
  username: string
  password_hash: string
  full_name: string
  created_at: string
  updated_at: string
}

/** User shape safe to return over the API (never carries the password hash). */
export interface PublicUser {
  id: string
  role: UserRole
  status: UserStatus
  username: string
  fullName: string
  createdAt: string
  updatedAt: string
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    username: row.username,
    fullName: row.full_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function findUserByUsername(
  db: DatabaseSync,
  username: string,
): UserRow | null {
  const row = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username) as UserRow | undefined
  return row ?? null
}

export function findUserById(db: DatabaseSync, id: string): UserRow | null {
  const row = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(id) as UserRow | undefined
  return row ?? null
}

export function listUsers(
  db: DatabaseSync,
  filters: { role?: UserRole; status?: UserStatus; q?: string },
): UserRow[] {
  const where: string[] = []
  const params: string[] = []
  if (filters.role) {
    where.push('role = ?')
    params.push(filters.role)
  }
  if (filters.status) {
    where.push('status = ?')
    params.push(filters.status)
  }
  if (filters.q) {
    where.push('(username LIKE ? OR full_name LIKE ?)')
    const like = `%${filters.q}%`
    params.push(like, like)
  }
  const sql = `SELECT * FROM users${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at ASC`
  return db.prepare(sql).all(...params) as unknown as UserRow[]
}