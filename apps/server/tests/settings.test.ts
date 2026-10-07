import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp, type TestingApp } from '../src/app'
import { lanAddresses, normalizeBaseUrl } from '../src/lib/settings'

// Deterministic admin bootstrap so the seed warning stays quiet in tests.
process.env.ADMIN_PASSWORD = 'test-admin-password'

interface ErrorBody {
  error: { code: string; message: string }
}

interface SettingsBody {
  publicBaseUrl: string | null
  suggestions: string[]
}

let app: TestingApp
let tmpDir: string
let adminToken: string
let teacherToken: string

async function login(username: string, password: string) {
  return app.server.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  })
}

function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` }
}

/** The rules a base address has to satisfy, independent of any HTTP. */
describe('public base address validation', () => {
  it('keeps a plain address as typed', () => {
    expect(normalizeBaseUrl('http://192.168.1.65:3300')).toEqual({
      ok: true,
      value: 'http://192.168.1.65:3300',
    })
  })

  it('accepts https and a host name, not just an IP', () => {
    expect(normalizeBaseUrl('https://tests.example.org')).toEqual({
      ok: true,
      value: 'https://tests.example.org',
    })
  })

  it('drops the trailing slash and a default port, so joins never double up', () => {
    expect(normalizeBaseUrl('http://192.168.1.65/')).toEqual({
      ok: true,
      value: 'http://192.168.1.65',
    })
    expect(normalizeBaseUrl('http://192.168.1.65:80')).toEqual({
      ok: true,
      value: 'http://192.168.1.65',
    })
  })

  it('keeps a non-default port, because that is the school setup', () => {
    expect(normalizeBaseUrl('http://192.168.1.65:3300/')).toEqual({
      ok: true,
      value: 'http://192.168.1.65:3300',
    })
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeBaseUrl('  http://10.0.0.7:3300  ')).toEqual({
      ok: true,
      value: 'http://10.0.0.7:3300',
    })
  })

  it('treats an empty value as "not configured" rather than invalid', () => {
    expect(normalizeBaseUrl('')).toEqual({ ok: true, value: null })
    expect(normalizeBaseUrl('   ')).toEqual({ ok: true, value: null })
    expect(normalizeBaseUrl(null)).toEqual({ ok: true, value: null })
  })

  it('rejects a relative value: there is nothing to open', () => {
    expect(normalizeBaseUrl('192.168.1.65:3300').ok).toBe(false)
    expect(normalizeBaseUrl('/api').ok).toBe(false)
  })

  it('rejects schemes a phone cannot open', () => {
    expect(normalizeBaseUrl('tauri://localhost').ok).toBe(false)
    expect(normalizeBaseUrl('file:///srv/app').ok).toBe(false)
    expect(normalizeBaseUrl('ftp://192.168.1.65').ok).toBe(false)
  })

  it('rejects a path, a query or a fragment', () => {
    expect(normalizeBaseUrl('http://192.168.1.65/app').ok).toBe(false)
    expect(normalizeBaseUrl('http://192.168.1.65?a=1').ok).toBe(false)
    expect(normalizeBaseUrl('http://192.168.1.65#top').ok).toBe(false)
  })

  it('rejects credentials in the address', () => {
    expect(normalizeBaseUrl('http://user:pass@192.168.1.65').ok).toBe(false)
  })

  it('rejects a value that is too long to be an address', () => {
    expect(normalizeBaseUrl(`http://${'a'.repeat(300)}.example.org`).ok).toBe(false)
  })

  it('every rejection carries a message a human can act on', () => {
    const bad = normalizeBaseUrl('http://192.168.1.65/app')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.message.length).toBeGreaterThan(10)
  })
})

describe('LAN address suggestions', () => {
  it('offers real IPv4 addresses with the served port, never loopback', () => {
    const found = lanAddresses(3300)
    for (const address of found) {
      expect(address).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:3300$/)
      expect(address).not.toContain('127.0.0.1')
    }
  })
})

describe('GET /api/settings and PATCH /api/settings', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'testsys-settings-'))
  app = buildApp({
    host: '127.0.0.1',
    port: 0,
    dbPath: join(tmpDir, 'test.db'),
    webRoot: null,
  })

  afterAll(() => {
    app.server.close()
    app.database.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('requires authentication', async () => {
    const res = await app.server.inject({ method: 'GET', url: '/api/settings' })
    expect(res.statusCode).toBe(401)
    expect((res.json() as ErrorBody).error.code).toBe('UNAUTHORIZED')
  })

  it('starts unset, and every signed-in role may read it', async () => {
    const admin = await login('admin', process.env.ADMIN_PASSWORD!)
    adminToken = (admin.json() as { token: string }).token
    await app.server.inject({
      method: 'POST',
      url: '/api/users',
      headers: bearer(adminToken),
      payload: { username: 'teacherS', password: 'teacher-pass-1', fullName: 'Teacher S' },
    })
    const teacher = await login('teacherS', 'teacher-pass-1')
    teacherToken = (teacher.json() as { token: string }).token

    const reg = await app.server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'stuS', password: 'student-pass-1', fullName: 'Student S' },
    })
    const studentId = (reg.json() as { user: { id: string } }).user.id
    await app.server.inject({
      method: 'PATCH',
      url: `/api/users/${studentId}/status`,
      headers: bearer(adminToken),
      payload: { status: 'approved' },
    })
    const student = await login('stuS', 'student-pass-1')

    for (const token of [adminToken, teacherToken, (student.json() as { token: string }).token]) {
      const res = await app.server.inject({
        method: 'GET',
        url: '/api/settings',
        headers: bearer(token),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as SettingsBody
      expect(body.publicBaseUrl).toBeNull()
      expect(Array.isArray(body.suggestions)).toBe(true)
    }
  })

  it('refuses the change for anyone who is not an admin', async () => {
    const res = await app.server.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: bearer(teacherToken),
      payload: { publicBaseUrl: 'http://192.168.1.65:3300' },
    })
    expect(res.statusCode).toBe(403)
    expect((res.json() as ErrorBody).error.code).toBe('FORBIDDEN')
  })

  it('refuses an unsigned request', async () => {
    const res = await app.server.inject({
      method: 'PATCH',
      url: '/api/settings',
      payload: { publicBaseUrl: 'http://192.168.1.65:3300' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('stores a valid address and returns the normalised form', async () => {
    const res = await app.server.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: bearer(adminToken),
      payload: { publicBaseUrl: '  http://192.168.1.65:3300/  ' },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as SettingsBody).publicBaseUrl).toBe('http://192.168.1.65:3300')

    const read = await app.server.inject({
      method: 'GET',
      url: '/api/settings',
      headers: bearer(teacherToken),
    })
    expect((read.json() as SettingsBody).publicBaseUrl).toBe('http://192.168.1.65:3300')
  })

  it('rejects an address that no student could open, and keeps the old one', async () => {
    const res = await app.server.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: bearer(adminToken),
      payload: { publicBaseUrl: 'tauri://localhost' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json() as ErrorBody
    expect(body.error.code).toBe('VALIDATION')
    expect(body.error.message.length).toBeGreaterThan(10)

    const read = await app.server.inject({
      method: 'GET',
      url: '/api/settings',
      headers: bearer(adminToken),
    })
    expect((read.json() as SettingsBody).publicBaseUrl).toBe('http://192.168.1.65:3300')
  })

  it('clears the setting with null', async () => {
    const res = await app.server.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: bearer(adminToken),
      payload: { publicBaseUrl: null },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as SettingsBody).publicBaseUrl).toBeNull()
  })

  it('ignores an unknown field and still applies the known one', async () => {
    // Fastify's default AJV strips extra properties rather than rejecting the
    // request, so `additionalProperties: false` is documentation, not a 400.
    const res = await app.server.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: bearer(adminToken),
      payload: { publicBaseUrl: 'http://10.0.0.7', port: 9999 },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as SettingsBody).publicBaseUrl).toBe('http://10.0.0.7')
  })
})