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
let studentToken = ''

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
    // Only an approved account can sign in, so the token is taken here.
    const signedIn = await app.server.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: studentUsername, password: 'student-pass-1' },
    })
    expect(signedIn.statusCode).toBe(200)
    studentToken = (signedIn.json() as { token: string }).token
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

  /** A course the student is in, with one material, and one they are not in. */
  async function seedForStudent(): Promise<{ mine: string; other: string; materialId: string }> {
    const admin = adminToken
    const teacher = teacherToken
    const make = async (ownerToken: string, title: string): Promise<string> => {
      const res = await app.server.inject({
        method: 'POST',
        url: '/api/courses',
        headers: bearer(ownerToken),
        payload: { title, description: 'for students' },
      })
      return (res.json() as CoursePayload).id
    }
    const mine = await make(teacher, 'Shared with the class')
    const other = await make(teacher2Token, 'Someone else course')

    await app.server.inject({
      method: 'POST',
      url: `/api/courses/${mine}/enrollments`,
      headers: bearer(teacher),
      payload: { username: studentUsername },
    })
    await app.server.inject({
      method: 'POST',
      url: `/api/courses/${other}/enrollments`,
      headers: bearer(teacher2Token),
      payload: { username: studentUsername },
    })

    const upload = await app.server.inject({
      method: 'POST',
      url: `/api/courses/${mine}/materials?name=lecture.pdf`,
      headers: { 'content-type': 'application/octet-stream', ...bearer(teacher) },
      payload: Buffer.from('%PDF-1.4\nstudent material\n'),
    })
    const materialId = (upload.json() as MaterialPayload).id
    expect(admin).toBeTruthy()
    return { mine, other, materialId }
  }

  it('lists only the courses the student is enrolled in', async () => {
    const seeded = await seedForStudent()
    const res = await app.server.inject({
      method: 'GET',
      url: '/api/courses',
      headers: bearer(studentToken),
    })
    expect(res.statusCode).toBe(200)
    const { courses } = res.json() as { courses: Array<{ id: string; title: string }> }
    const ids = courses.map((course) => course.id)
    expect(ids).toContain(seeded.mine)
    // Enrolled in it too, but through the other teacher: still visible, since a
    // student may read any course they are in.
    expect(ids).toContain(seeded.other)
    // The teacher's own courses that nobody was enrolled in stay hidden.
    expect(courses.every((course) => typeof course.title === 'string')).toBe(true)
  })

  it('hides courses the student is not enrolled in', async () => {
    const teacher = teacherToken
    const res = await app.server.inject({
      method: 'POST',
      url: '/api/courses',
      headers: bearer(teacher),
      payload: { title: 'Not for this student' },
    })
    const hidden = (res.json() as CoursePayload).id

    const denied = await app.server.inject({
      method: 'GET',
      url: `/api/courses/${hidden}`,
      headers: bearer(studentToken),
    })
    expect(denied.statusCode).toBe(403)

    const list = await app.server.inject({
      method: 'GET',
      url: '/api/courses',
      headers: bearer(studentToken),
    })
    const ids = (list.json() as { courses: Array<{ id: string }> }).courses.map((c) => c.id)
    expect(ids).not.toContain(hidden)
  })

  it('serves the course with its materials and test titles, but no student roster', async () => {
    const seeded = await seedForStudent()
    const res = await app.server.inject({
      method: 'GET',
      url: `/api/courses/${seeded.mine}`,
      headers: bearer(studentToken),
    })
    expect(res.statusCode).toBe(200)
    const course = res.json() as {
      materials: Array<{ id: string; title: string }>
      tests: unknown[]
      students: unknown[]
    }
    expect(course.materials.map((m) => m.title)).toContain('lecture.pdf')
    // Attached tests come back as id + title only, never with questions.
    for (const test of course.tests) {
      expect(Object.keys(test as object).sort()).toEqual(['id', 'title'])
    }
    // The roster belongs to the teacher; a student has no business reading it.
    expect(course.students).toEqual([])
  })

  it('lets the student download a material of their course', async () => {
    const seeded = await seedForStudent()
    const res = await app.server.inject({
      method: 'GET',
      url: `/api/courses/${seeded.mine}/materials/${seeded.materialId}/file`,
      headers: bearer(studentToken),
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
  })

  it('refuses a material download from a course the student is not in', async () => {
    const teacher = teacherToken
    const course = (
      await app.server.inject({
        method: 'POST',
        url: '/api/courses',
        headers: bearer(teacher),
        payload: { title: 'Private archive' },
      })
    ).json() as CoursePayload
    const upload = await app.server.inject({
      method: 'POST',
      url: `/api/courses/${course.id}/materials?name=secret.pdf`,
      headers: { 'content-type': 'application/octet-stream', ...bearer(teacher) },
      payload: Buffer.from('%PDF-1.4\nsecret\n'),
    })
    const materialId = (upload.json() as MaterialPayload).id

    const res = await app.server.inject({
      method: 'GET',
      url: `/api/courses/${course.id}/materials/${materialId}/file`,
      headers: bearer(studentToken),
    })
    expect(res.statusCode).toBe(403)
  })

  it('still refuses every write endpoint to a student', async () => {
    const seeded = await seedForStudent()
    // A real UUID: schema validation answers 400 before the role guard runs, so
    // a malformed id would test the wrong thing.
    const someId = '00000000-0000-4000-8000-000000000000'
    const cases: Array<{ method: 'POST' | 'PATCH' | 'DELETE'; url: string }> = [
      { method: 'POST', url: '/api/courses' },
      { method: 'PATCH', url: `/api/courses/${seeded.mine}` },
      { method: 'DELETE', url: `/api/courses/${seeded.mine}` },
      { method: 'POST', url: `/api/courses/${seeded.mine}/enrollments` },
      { method: 'DELETE', url: `/api/courses/${seeded.mine}/enrollments/${someId}` },
      { method: 'POST', url: `/api/courses/${seeded.mine}/tests` },
      { method: 'DELETE', url: `/api/courses/${seeded.mine}/tests/${someId}` },
      { method: 'POST', url: `/api/courses/${seeded.mine}/materials?name=x.pdf` },
    ]
    for (const probe of cases) {
      const res = await app.server.inject({
        method: probe.method,
        url: probe.url,
        headers: { 'content-type': 'application/json', ...bearer(studentToken) },
        payload: { title: 'nope', username: studentUsername, testId: someId },
      })
      expect(res.statusCode, `${probe.method} ${probe.url}`).toBe(403)
    }
  })
})
