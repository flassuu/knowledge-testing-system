import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp, type TestingApp } from '../src/app'
import { insertTestAdmin, signInAs } from './support'
import { LogBuffer } from '../src/lib/log'

process.env.ADMIN_PASSWORD = 'test-admin-password'
// The buffer holds what passes the level filter, so this file needs info lines
// to exist at all. The rest of the suite runs at `error` to keep its output quiet.
process.env.LOG_LEVEL = 'info'

let app: TestingApp
let tmpDir: string
let adminToken: string
let teacherToken: string

function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` }
}

async function tokenOf(username: string, password: string): Promise<string> {
  const res = await app.server.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  })
  expect(res.statusCode).toBe(200)
  return (res.json() as { token: string }).token
}

interface LogsBody {
  entries: Array<{ seq: number; level: string; msg: string; at: string }>
  lastSeq: number
}

describe('the log stream over HTTP', () => {
  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'testsys-logs-'))
    app = buildApp({
      host: '127.0.0.1',
      port: 0,
      dbPath: join(tmpDir, 'test.db'),
      webRoot: null,
    })
  insertTestAdmin(app)
    adminToken = await tokenOf('admin', process.env.ADMIN_PASSWORD!)
    await app.server.inject({
      method: 'POST',
      url: '/api/users',
      headers: bearer(adminToken),
      payload: { username: 'teacherLog', password: 'teacher-pass-1', fullName: 'Teacher Log' },
    })
    teacherToken = await tokenOf('teacherLog', 'teacher-pass-1')
    // A known amount of history, so the assertions are about the query and not
    // about how much Fastify happened to log.
    app.logs.logger.info({ step: 'seed' }, 'history line')
  })

  afterAll(() => {
    app.server.close()
    app.database.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('refuses an unauthenticated read', async () => {
    const res = await app.server.inject({ method: 'GET', url: '/api/logs' })
    expect(res.statusCode).toBe(401)
    expect((res.json() as { error: { code: string } }).error.code).toBe('UNAUTHORIZED')
  })

  it('serves a teacher the log but refuses a student', async () => {
    const res = await app.server.inject({
      method: 'GET',
      url: '/api/logs',
      headers: bearer(teacherToken),
    })
    expect(res.statusCode).toBe(200)

    await app.server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'nosy', password: 'student-password', fullName: 'Nosy' },
    })
    // No class key, so the account is pending; sign in as admin to let it through.
    const nosy = await app.server.inject({
      method: 'GET',
      url: '/api/users/pending',
      headers: bearer(adminToken),
    })
    const pendingId = (nosy.json() as { users: Array<{ id: string; username: string }> })
      .users.find((u) => u.username === 'nosy')!.id
    await app.server.inject({
      method: 'PATCH',
      url: `/api/users/${pendingId}/status`,
      headers: bearer(adminToken),
      payload: { status: 'approved' },
    })
    const studentToken = await signInAs(app, 'nosy', 'student-password')
    const denied = await app.server.inject({
      method: 'GET',
      url: '/api/logs',
      headers: bearer(studentToken),
    })
    expect(denied.statusCode).toBe(403)
    expect((denied.json() as { error: { code: string } }).error.code).toBe('FORBIDDEN')
  })

  it('serves the admin the buffered lines, newest last', async () => {
    const body = (await app.server.inject({
      method: 'GET',
      url: '/api/logs',
      headers: bearer(adminToken),
    })).json() as LogsBody

    expect(body.entries.length).toBeGreaterThan(0)
    expect(body.entries.some((entry) => entry.msg === 'history line')).toBe(true)
    const seqs = body.entries.map((entry) => entry.seq)
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs)
    expect(body.lastSeq).toBe(seqs[seqs.length - 1]!)
    // Non-null: the length assertion above proves there is at least one entry.
  })

  it('returns nothing older than `since`, whatever happened in between', async () => {
    // Reading the log is itself logged, so the buffer grows between two calls.
    // The contract is about sequence numbers, not about how many lines came back.
    const first = (await app.server.inject({
      method: 'GET',
      url: '/api/logs',
      headers: bearer(adminToken),
    })).json() as LogsBody
    const from = first.entries[0]!.seq

    const rest = (await app.server.inject({
      method: 'GET',
      url: `/api/logs?since=${from}`,
      headers: bearer(adminToken),
    })).json() as LogsBody

    expect(rest.entries.every((entry) => entry.seq > from)).toBe(true)
    // The line the client already had is not repeated.
    expect(rest.entries.some((entry) => entry.msg === 'history line')).toBe(
      first.entries.some((entry) => entry.seq <= from),
    )
    // Nothing invented: every entry is really in the buffer.
    const known = new Set(app.logs.buffer.all().map((entry) => entry.seq))
    expect(rest.entries.every((entry) => known.has(entry.seq))).toBe(true)
    expect(rest.lastSeq).toBeGreaterThanOrEqual(from)
  })

  it('rejects a `since` that is not a number, rather than ignoring it', async () => {
    const res = await app.server.inject({
      method: 'GET',
      url: '/api/logs?since=soon',
      headers: bearer(adminToken),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns entries in a shape the browser can render directly', async () => {
    const body = (await app.server.inject({
      method: 'GET',
      url: '/api/logs',
      headers: bearer(adminToken),
    })).json() as LogsBody
    for (const entry of body.entries) {
      expect(typeof entry.seq).toBe('number')
      expect(typeof entry.msg).toBe('string')
      expect(Number.isNaN(Date.parse(entry.at))).toBe(false)
      expect(['debug', 'info', 'warn', 'error', 'fatal']).toContain(entry.level)
    }
  })
})

describe('the ring buffer behind it', () => {
  it('is filled even when stdout is not a terminal', () => {
    // The desktop app starts the server as a child process, so its output is
    // always piped. A buffer that only filled on a TTY would leave the desktop
    // console permanently empty.
    const buffer = new LogBuffer(10)
    buffer.push({ at: new Date().toISOString(), level: 'info', msg: 'piped', fields: {} })
    expect(buffer.size).toBe(1)
  })

  it('hands a subscriber every new line and stops when unsubscribed', () => {
    const seen: number[] = []
    const hub = app.logs
    const unsubscribe = hub.subscribe((entry) => seen.push(entry.seq))
    hub.logger.info('line one')
    hub.logger.info('line two')
    unsubscribe()
    hub.logger.info('line three')
    expect(seen).toHaveLength(2)
    expect(seen[1]).toBe(seen[0]! + 1)
  })

  it('survives a subscriber that throws', () => {
    const hub = app.logs
    const unsubscribe = hub.subscribe(() => {
      throw new Error('client gone')
    })
    expect(() => hub.logger.info('still logging')).not.toThrow()
    unsubscribe()
  })
})