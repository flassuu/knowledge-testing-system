import { createUser } from '../src/lib/users'
import type { TestingApp } from '../src/app'

/**
 * Test accounts.
 *
 * First boot seeds a **teacher**, not an admin: one person with a laptop runs a
 * class, and forcing an admin first was ceremony with no purpose. Tests that
 * exercise admin-only endpoints therefore need an admin put in the way an
 * institution would — `insertTestAdmin` is that way, the same `createUser` the
 * console's `admin` command calls.
 *
 * Sync on purpose: the seed happens in `buildApp`, so an admin can be inserted
 * next to it without making every `describe` body async.
 */
export function insertTestAdmin(app: TestingApp, username = 'admin'): void {
  createUser(app.database.raw, {
    role: 'admin',
    status: 'approved',
    username,
    password: process.env.ADMIN_PASSWORD ?? 'test-admin-password',
    fullName: 'Administrator',
  })
}

/** A second teacher, for the ownership rules. */
export function insertTeacher(
  app: TestingApp,
  username: string,
  password: string,
): void {
  createUser(app.database.raw, {
    role: 'teacher',
    status: 'approved',
    username,
    password,
    fullName: 'Second Teacher',
  })
}

export async function signInAs(
  app: TestingApp,
  username: string,
  password: string,
): Promise<string> {
  const res = await app.server.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  })
  if (res.statusCode !== 200) {
    throw new Error(`sign-in failed for ${username}: ${res.statusCode} ${res.body}`)
  }
  return (res.json() as { token: string }).token
}

export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` }
}