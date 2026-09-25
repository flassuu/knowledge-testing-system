import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp, type TestingApp } from '../src/app'

// Deterministic admin bootstrap so the seed warning stays quiet in tests.
process.env.ADMIN_PASSWORD = 'test-admin-password'

interface ErrorBody {
  error: { code: string; message: string }
}

interface StatsBody {
  stats: {
    version: string
    schemaVersion: number
    database: string
    counts: Record<string, number>
  }
}

interface Participant {
  courseId: string
  courseTitle: string
  username: string
  fullName: string
  status: string
  enrolledAt: string
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

describe('admin insights (stats & participants)', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'testsys-admin-'))
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

  it('seeds data: teacher, course, student, enrollment, test', async () => {
    const admin = await login('admin', process.env.ADMIN_PASSWORD!)
    adminToken = (admin.json() as { token: string }).token

    await app.server.inject({
      method: 'POST',
      url: '/api/users',
      headers: bearer(adminToken),
      payload: { username: 'teacherX', password: 'teacher-pass-1', fullName: 'Teacher X' },
    })
    const teacherLogin = await login('teacherX', 'teacher-pass-1')
    teacherToken = (teacherLogin.json() as { token: string }).token

    const reg = await app.server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'stuX', password: 'student-pass-1', fullName: 'Student X' },
    })
    const studentId = (reg.json() as { user: { id: string } }).user.id
    await app.server.inject({
      method: 'PATCH',
      url: `/api/users/${studentId}/status`,
      headers: bearer(adminToken),
      payload: { status: 'approved' },
    })

    const course = await app.server.inject({
      method: 'POST',
      url: '/api/courses',
      headers: bearer(teacherToken),
      payload: { title: 'Algebra' },
    })
    const courseId = (course.json() as { id: string }).id
    await app.server.inject({
      method: 'POST',
      url: `/api/courses/${courseId}/enrollments`,
      headers: bearer(teacherToken),
      payload: { username: 'stuX' },
    })
    await app.server.inject({
      method: 'POST',
      url: '/api/tests',
      headers: bearer(teacherToken),
      payload: {
        title: 'Algebra quiz',
        questions: [
          {
            type: 'true_false',
            body: '1 + 1 = 2',
            points: 1,
            position: 0,
            payload: { correct: true },
          },
        ],
      },
    })
  })

  it('exposes aggregated stats for the admin', async () => {
    const res = await app.server.inject({
      method: 'GET',
      url: '/api/admin/stats',
      headers: bearer(adminToken),
    })
    expect(res.statusCode).toBe(200)
    const { stats } = res.json() as StatsBody
    expect(stats.database).toBe('ok')
    expect(stats.schemaVersion).toBe(3)
    expect(stats.counts).toMatchObject({
      admins: 1,
      teachers: 1,
      students: 1,
      courses: 1,
      enrollments: 1,
      tests: 1,
      questions: 1,
    })
  })

  it('lists course participants with student details', async () => {
    const res = await app.server.inject({
      method: 'GET',
      url: '/api/admin/participants',
      headers: bearer(adminToken),
    })
    expect(res.statusCode).toBe(200)
    const { participants } = res.json() as { participants: Participant[] }
    expect(participants).toHaveLength(1)
    expect(participants[0]!).toMatchObject({
      courseTitle: 'Algebra',
      username: 'stuX',
      fullName: 'Student X',
      status: 'approved',
    })
  })

  it('keeps the admin endpoints admin-only', async () => {
    for (const url of ['/api/admin/stats', '/api/admin/participants']) {
      const teacher = await app.server.inject({
        method: 'GET',
        url,
        headers: bearer(teacherToken),
      })
      expect(teacher.statusCode).toBe(403)
    }
  })

  it('rejects an expired-role request with a clear envelope', async () => {
    const res = await app.server.inject({
      method: 'GET',
      url: '/api/admin/stats',
    })
    expect(res.statusCode).toBe(401)
    expect((res.json() as ErrorBody).error.code).toBe('UNAUTHORIZED')
  })
})