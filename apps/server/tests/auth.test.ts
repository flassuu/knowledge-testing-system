import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp, type TestingApp } from '../src/app'

// Deterministic admin bootstrap so the seed warning stays quiet in tests.
process.env.ADMIN_PASSWORD = 'test-admin-password'

interface PublicUser {
  id: string
  role: string
  status: string
  username: string
  fullName: string
}

interface LoginBody {
  token: string
  user: PublicUser
}

interface ErrorBody {
  error: { code: string; message: string }
}

let app: TestingApp
let tmpDir: string

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

describe('accounts & auth (phase 1)', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'testsys-auth-'))
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

  it('seeds the built-in admin account', async () => {
    const res = await login('admin', process.env.ADMIN_PASSWORD!)
    expect(res.statusCode).toBe(200)
    const body = res.json() as LoginBody
    expect(body.user.role).toBe('admin')
    expect(body.user.status).toBe('approved')
    expect(body.token).toBeTruthy()
  })

  it('rejects unknown credentials', async () => {
    const res = await login('admin', 'wrong-password')
    expect(res.statusCode).toBe(401)
    expect((res.json() as ErrorBody).error.code).toBe('INVALID_CREDENTIALS')
  })

  it('registers a student as pending approval', async () => {
    const res = await app.server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'student1', password: 'student-pass-1', fullName: 'Student One' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { user: PublicUser }
    expect(body.user.role).toBe('student')
    expect(body.user.status).toBe('pending')
  })

  it('rejects duplicate usernames and invalid payloads', async () => {
    const duplicate = await app.server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'student1', password: 'student-pass-1', fullName: 'Copy' },
    })
    expect(duplicate.statusCode).toBe(409)
    expect((duplicate.json() as ErrorBody).error.code).toBe('CONFLICT')

    const invalid = await app.server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'a', password: 'short', fullName: 'X' },
    })
    expect(invalid.statusCode).toBe(400)
    expect((invalid.json() as ErrorBody).error.code).toBe('VALIDATION')
  })

  it('blocks login until the student is approved', async () => {
    const res = await login('student1', 'student-pass-1')
    expect(res.statusCode).toBe(403)
    expect((res.json() as ErrorBody).error.code).toBe('PENDING_APPROVAL')
  })

  it('lets the admin create an approved teacher', async () => {
    const admin = await login('admin', process.env.ADMIN_PASSWORD!)
    const { token } = admin.json() as LoginBody

    const res = await app.server.inject({
      method: 'POST',
      url: '/api/users',
      headers: bearer(token),
      payload: { username: 'teacher1', password: 'teacher-pass-1', fullName: 'Teacher One' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { user: PublicUser }
    expect(body.user.role).toBe('teacher')
    expect(body.user.status).toBe('approved')

    const loginRes = await login('teacher1', 'teacher-pass-1')
    expect(loginRes.statusCode).toBe(200)
  })

  it('forbids non-admins from managing the roster', async () => {
    const teacher = await login('teacher1', 'teacher-pass-1')
    const { token } = teacher.json() as LoginBody
    const res = await app.server.inject({
      method: 'GET',
      url: '/api/users',
      headers: bearer(token),
    })
    expect(res.statusCode).toBe(403)
    expect((res.json() as ErrorBody).error.code).toBe('FORBIDDEN')
  })

  it('requires a token for authenticated routes', async () => {
    const res = await app.server.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
    expect((res.json() as ErrorBody).error.code).toBe('UNAUTHORIZED')
  })

  it('lists users with role/status filters and searches', async () => {
    const admin = await login('admin', process.env.ADMIN_PASSWORD!)
    const { token } = admin.json() as LoginBody
    const auth = bearer(token)

    const all = await app.server.inject({
      method: 'GET',
      url: '/api/users',
      headers: auth,
    })
    expect(all.statusCode).toBe(200)
    expect((all.json() as { users: PublicUser[] }).users.length).toBe(3)

    const pending = await app.server.inject({
      method: 'GET',
      url: '/api/users?status=pending',
      headers: auth,
    })
    const pendingUsers = (pending.json() as { users: PublicUser[] }).users
    expect(pendingUsers.length).toBe(1)
    expect(pendingUsers[0]?.username).toBe('student1')

    const search = await app.server.inject({
      method: 'GET',
      url: '/api/users?q=Teacher',
      headers: auth,
    })
    const found = (search.json() as { users: PublicUser[] }).users
    expect(found.length).toBe(1)
    expect(found[0]?.role).toBe('teacher')
  })

  it('lets the admin approve a student, who can then log in', async () => {
    const admin = await login('admin', process.env.ADMIN_PASSWORD!)
    const { token } = admin.json() as LoginBody
    const auth = bearer(token)

    const list = await app.server.inject({
      method: 'GET',
      url: '/api/users?q=student1',
      headers: auth,
    })
    const student = (list.json() as { users: PublicUser[] }).users[0] as PublicUser

    const patch = await app.server.inject({
      method: 'PATCH',
      url: `/api/users/${student.id}/status`,
      headers: auth,
      payload: { status: 'approved' },
    })
    expect(patch.statusCode).toBe(200)
    expect((patch.json() as { user: PublicUser }).user.status).toBe('approved')

    const loginRes = await login('student1', 'student-pass-1')
    expect(loginRes.statusCode).toBe(200)
    const { user } = loginRes.json() as LoginBody
    expect(user.role).toBe('student')

    const me = await app.server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: bearer((loginRes.json() as LoginBody).token),
    })
    expect(me.statusCode).toBe(200)
    expect((me.json() as { user: PublicUser }).user.username).toBe('student1')
  })

  it('revokes sessions on logout and blocks revoke access', async () => {
    const res = await login('student1', 'student-pass-1')
    const { token } = res.json() as LoginBody
    const auth = bearer(token)

    const logout = await app.server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: auth,
    })
    expect(logout.statusCode).toBe(204)

    const me = await app.server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: auth,
    })
    expect(me.statusCode).toBe(401)

    const admin = await login('admin', process.env.ADMIN_PASSWORD!)
    const adminAuth = bearer((admin.json() as LoginBody).token)
    const student = (await app.server.inject({
      method: 'GET',
      url: '/api/users?q=student1',
      headers: adminAuth,
    }).then((r) => (r.json() as { users: PublicUser[] }).users[0])) as PublicUser

    await app.server.inject({
      method: 'PATCH',
      url: `/api/users/${student.id}/status`,
      headers: adminAuth,
      payload: { status: 'blocked' },
    })
    const blockedLogin = await login('student1', 'student-pass-1')
    expect(blockedLogin.statusCode).toBe(403)
    expect((blockedLogin.json() as ErrorBody).error.code).toBe('BLOCKED')
  })

  it('keeps admin accounts immutable', async () => {
    const admin = await login('admin', process.env.ADMIN_PASSWORD!)
    const auth = bearer((admin.json() as LoginBody).token)
    const me = await app.server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: auth,
    })
    const adminUser = (me.json() as { user: PublicUser }).user

    const patch = await app.server.inject({
      method: 'PATCH',
      url: `/api/users/${adminUser.id}/status`,
      headers: auth,
      payload: { status: 'blocked' },
    })
    expect(patch.statusCode).toBe(400)
    expect((patch.json() as ErrorBody).error.code).toBe('INVALID_OPERATION')

    const del = await app.server.inject({
      method: 'DELETE',
      url: `/api/users/${adminUser.id}`,
      headers: auth,
    })
    expect(del.statusCode).toBe(400)
  })
})