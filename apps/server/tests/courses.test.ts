import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildApp, type TestingApp } from '../src/app'

// Deterministic admin bootstrap so the seed warning stays quiet in tests.
process.env.ADMIN_PASSWORD = 'test-admin-password'

interface CoursePayload {
  id: string
  ownerId: string
  title: string
  description: string
  materialsCount: number
  testsCount: number
  studentsCount: number
}

interface MaterialPayload {
  id: string
  courseId: string
  title: string
  mimeType: string
  sizeBytes: number
}

let app: TestingApp
let tmpDir: string
let adminToken: string
let teacherToken: string
let teacher2Token: string
let studentUsername = 'stu-course'

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

describe('courses & materials CRUD', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'testsys-courses-'))
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

  it('boots admin, teachers, and one approved student', async () => {
    const admin = await login('admin', process.env.ADMIN_PASSWORD!)
    adminToken = (admin.json() as { token: string }).token

    for (const [username, fullName] of [
      ['teacherA', 'Teacher A'],
      ['teacherB', 'Teacher B'],
    ] as const) {
      const res = await app.server.inject({
        method: 'POST',
        url: '/api/users',
        headers: bearer(adminToken),
        payload: { username, password: 'teacher-pass-1', fullName },
      })
      expect(res.statusCode).toBe(201)
    }
    const a = await login('teacherA', 'teacher-pass-1')
    const b = await login('teacherB', 'teacher-pass-1')
    teacherToken = (a.json() as { token: string }).token
    teacher2Token = (b.json() as { token: string }).token

    const reg = await app.server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: studentUsername, password: 'student-pass-1', fullName: 'Stu' },
    })
    expect(reg.statusCode).toBe(201)
    const regBody = reg.json() as { user: { id: string } }
    await app.server.inject({
      method: 'PATCH',
      url: `/api/users/${regBody.user.id}/status`,
      headers: bearer(adminToken),
      payload: { status: 'approved' },
    })
  })

  it('creates a course as teacherA', async () => {
    const res = await app.server.inject({
      method: 'POST',
      url: '/api/courses',
      headers: bearer(teacherToken),
      payload: { title: 'Physics 101', description: 'Intro to mechanics' },
    })
    expect(res.statusCode).toBe(201)
    const course = res.json() as CoursePayload
    expect(course.title).toBe('Physics 101')
    expect(course.ownerId).toBeTruthy()
  })

  it('lists only own courses for teachers, all for admin', async () => {
    const teacherList = await app.server.inject({
      method: 'GET',
      url: '/api/courses',
      headers: bearer(teacher2Token),
    })
    expect((teacherList.json() as { courses: CoursePayload[] }).courses).toHaveLength(0)

    const adminList = await app.server.inject({
      method: 'GET',
      url: '/api/courses',
      headers: bearer(adminToken),
    })
    expect((adminList.json() as { courses: CoursePayload[] }).courses).toHaveLength(1)
  })

  it('patches course details', async () => {
    const list = await app.server.inject({
      method: 'GET',
      url: '/api/courses',
      headers: bearer(teacherToken),
    })
    const { courses } = list.json() as { courses: CoursePayload[] }
    const res = await app.server.inject({
      method: 'PATCH',
      url: `/api/courses/${courses[0]!.id}`,
      headers: bearer(teacherToken),
      payload: { title: 'Physics 101 (updated)', description: 'Now with labs' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as CoursePayload
    expect(body.title).toBe('Physics 101 (updated)')
  })

  it('enrolls an approved student and rejects duplicates', async () => {
    const list = await app.server.inject({
      method: 'GET',
      url: '/api/courses',
      headers: bearer(teacherToken),
    })
    const { courses } = list.json() as { courses: CoursePayload[] }
    const url = `/api/courses/${courses[0]!.id}/enrollments`

    const res = await app.server.inject({
      method: 'POST',
      url,
      headers: bearer(teacherToken),
      payload: { username: studentUsername },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as CoursePayload & { students: Array<{ username: string }> }
    expect(body.students).toEqual(expect.arrayContaining([{ id: expect.any(String), username: studentUsername, fullName: 'Stu' }]))

    const dup = await app.server.inject({
      method: 'POST',
      url,
      headers: bearer(teacherToken),
      payload: { username: studentUsername },
    })
    expect(dup.statusCode).toBe(409)

    const missing = await app.server.inject({
      method: 'POST',
      url,
      headers: bearer(teacherToken),
      payload: { username: 'nobody' },
    })
    expect(missing.statusCode).toBe(400)
  })

  it('attaches a test to the course', async () => {
    const testCreate = await app.server.inject({
      method: 'POST',
      url: '/api/tests',
      headers: bearer(teacherToken),
      payload: { title: 'Course exam' },
    })
    const testId = (testCreate.json() as { test: { id: string } }).test.id
    const list = await app.server.inject({
      method: 'GET',
      url: '/api/courses',
      headers: bearer(teacherToken),
    })
    const { courses } = list.json() as { courses: CoursePayload[] }

    const res = await app.server.inject({
      method: 'POST',
      url: `/api/courses/${courses[0]!.id}/tests`,
      headers: bearer(teacherToken),
      payload: { testId },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as CoursePayload & { tests: Array<{ id: string }> }
    expect(body.testsCount).toBe(1)
    expect(body.tests[0]!.id).toBe(testId)

    const detach = await app.server.inject({
      method: 'DELETE',
      url: `/api/courses/${courses[0]!.id}/tests/${testId}`,
      headers: bearer(teacherToken),
    })
    expect(detach.statusCode).toBe(204)
  })

  it('uploads and downloads a material file', async () => {
    const list = await app.server.inject({
      method: 'GET',
      url: '/api/courses',
      headers: bearer(teacherToken),
    })
    const { courses } = list.json() as { courses: CoursePayload[] }
    const courseId = courses[0]!.id
    const bytes = Buffer.from('%PDF-1.4\nfake pdf payload\n')

    const up = await app.server.inject({
      method: 'POST',
      url: `/api/courses/${courseId}/materials?name=notes.pdf`,
      headers: { 'content-type': 'application/octet-stream', ...bearer(teacherToken) },
      payload: bytes,
    })
    expect(up.statusCode).toBe(201)
    const material = up.json() as MaterialPayload
    expect(material.title).toBe('notes.pdf')
    expect(material.mimeType).toBe('application/pdf')
    expect(material.sizeBytes).toBe(bytes.length)

    const dl = await app.server.inject({
      method: 'GET',
      url: `/api/courses/${courseId}/materials/${material.id}/file`,
      headers: bearer(teacherToken),
    })
    expect(dl.statusCode).toBe(200)
    expect(dl.headers['content-type']).toContain('application/pdf')
    expect(dl.rawPayload.equals(bytes)).toBe(true)
  })

  it('isolates courses between teachers and deletes them', async () => {
    const list = await app.server.inject({
      method: 'GET',
      url: '/api/courses',
      headers: bearer(teacherToken),
    })
    const { courses } = list.json() as { courses: CoursePayload[] }

    const forbidden = await app.server.inject({
      method: 'GET',
      url: `/api/courses/${courses[0]!.id}`,
      headers: bearer(teacher2Token),
    })
    expect(forbidden.statusCode).toBe(403)

    const del = await app.server.inject({
      method: 'DELETE',
      url: `/api/courses/${courses[0]!.id}`,
      headers: bearer(teacherToken),
    })
    expect(del.statusCode).toBe(204)

    const after = await app.server.inject({
      method: 'GET',
      url: `/api/courses/${courses[0]!.id}`,
      headers: bearer(teacherToken),
    })
    expect(after.statusCode).toBe(404)
  })
})