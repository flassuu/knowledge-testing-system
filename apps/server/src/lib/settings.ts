import { networkInterfaces } from 'node:os'
import type { Database } from './db'

/** Key inside `app_meta`. The table is already a key/value store, so the
 *  setting needs no schema migration - only this constant. */
export const PUBLIC_BASE_URL_KEY = 'public_base_url'

/** Upper bound: a base address, not a document. */
const MAX_BASE_URL_LENGTH = 200

export interface ServerSettings {
  /** The address students open, e.g. `http://192.168.1.65:3300`. Null means
   *  "not configured", and clients fall back to the origin they are served from. */
  publicBaseUrl: string | null
  /** Addresses this machine answers on, best first. Suggestions, not truth:
   *  an admin may need a different one (a hostname, a reverse proxy, a second NIC). */
  suggestions: string[]
}

export type BaseUrlCheck =
  | { ok: true; value: string | null }
  | { ok: false; message: string }

/**
 * Validates and normalises a public base address.
 *
 * The rules exist because this string is the only thing a phone will ever be
 * told, and a wrong one cannot be diagnosed from the student's side:
 *
 * - absolute, `http` or `https` (a `tauri://` or `file://` origin is the
 *   teacher's window, not an address a student can open);
 * - no path, query or credentials - the app is served from the root, so
 *   anything after the host is a mistake worth rejecting loudly;
 * - no trailing slash, so joining a path never doubles up;
 * - an empty string means "not configured" rather than "invalid".
 *
 * Pure: no database, no globals, so the rules are testable on their own.
 */
export function normalizeBaseUrl(raw: string | null | undefined): BaseUrlCheck {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '') return { ok: true, value: null }
  if (trimmed.length > MAX_BASE_URL_LENGTH) {
    return { ok: false, message: 'the address is too long' }
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, message: 'the address must start with http:// or https://' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, message: 'only http and https addresses can be opened by a student' }
  }
  if (url.username || url.password) {
    return { ok: false, message: 'the address must not contain a login' }
  }
  if (url.search || url.hash) {
    return { ok: false, message: 'the address must not contain a query or a fragment' }
  }
  // A single "/" is how URL writes "the root", which is what we mean; anything
  // deeper is a path into an app that is only served from the root.
  if (url.pathname !== '' && url.pathname !== '/') {
    return { ok: false, message: 'the address must not contain a path' }
  }
  if (!url.hostname) {
    return { ok: false, message: 'the address has no host name' }
  }

  // Normalises case, a default port and the trailing slash in one step.
  return { ok: true, value: url.origin === 'null' ? trimmed.replace(/\/+$/, '') : url.origin }
}

export function readPublicBaseUrl(database: Database): string | null {
  const row = database.raw
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .get(PUBLIC_BASE_URL_KEY) as { value: string } | undefined
  if (!row) return null
  // A hand-edited database should not be able to inject something invalid into
  // every QR code in the school: an unusable value behaves like "unset".
  const checked = normalizeBaseUrl(row.value)
  return checked.ok ? checked.value : null
}

export function writePublicBaseUrl(database: Database, value: string | null): void {
  database.raw
    .prepare(
      `INSERT INTO app_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(PUBLIC_BASE_URL_KEY, value ?? '')
}

/**
 * IPv4 addresses this machine answers on, as `http://address:port`.
 *
 * Loopback is excluded on purpose: a phone cannot reach it, and offering
 * 127.0.0.1 as a suggestion would be exactly the wrong advice. IPv6 is left out
 * because link-local addresses need a scope suffix (`fe80::1%wlan0`) that no
 * phone camera will type in, and a global IPv6 address is a deployment question
 * this feature should not decide for the admin.
 */
export function lanAddresses(port: number): string[] {
  const found: string[] = []
  for (const addresses of Object.values(networkInterfaces())) {
    for (const entry of addresses ?? []) {
      // Node >= 22 (the supported runtime) reports the family as a string.
      if (entry.family !== 'IPv4' || entry.internal) continue
      const candidate = `http://${entry.address}:${port}`
      if (!found.includes(candidate)) found.push(candidate)
    }
  }
  return found
}