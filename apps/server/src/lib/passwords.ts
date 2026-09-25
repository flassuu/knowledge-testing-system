import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Password hashing via the built-in `node:crypto` scrypt — no native
 * dependencies, so it keeps working inside the `bun build --compile` binary.
 * Stored format: `scrypt:<N>:<salt b64>:<key b64>`.
 */
const KEY_LENGTH = 32

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const key = scryptSync(password, salt, KEY_LENGTH)
  return `scrypt:${salt.toString('base64')}:${key.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = parts[1]
  const key = parts[2]
  if (!salt || !key) return false
  const saltBuffer = Buffer.from(salt, 'base64')
  const expected = Buffer.from(key, 'base64')
  const actual = scryptSync(password, saltBuffer, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}