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

interface TestPayload {
  id: string
  ownerId: string
  title: string
  description: string
  timeLimitSec: number | null
  passingPercent: number | null
  questionCount: number
}

interface QuestionPayload {
  id: string
  type: string
  body: string
  payload: Record<string, unknown>
  points: number
  position: number
}

let app: TestingApp
let tmpDir: string
let adminToken: string
let teacherToken: string
let teacher2Token: string

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

const FIVE_TYPES = [
  {
    type: 'single_choice',
    body: 'Pick one',
    points: 2,
    position: 0,
    payload: { options: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }], correct: 'a' },
  },
  {
    type: 'multiple_choice',
    body: 'Pick many',
    points: 3,
    position: 1,
    payload: {
      options: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }, { key: 'c', text: 'C' }],
      correct: ['a', 'c'],
    },
  },
  {
    type: 'true_false',
    body: 'Water is wet',
    points: 1,
    position: 2,
    payload: { correct: true },
  },
  {
    type: 'short_answer',
    body: 'Capital of France?',
    points: 2,
    position: 3,
    payload: { accepted: ['Paris', 'paris'] },
  },
  {
    type: 'matching',
    body: 'Match the pairs',
    points: 4,
    position: 4,
    payload: { pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }] },
  },
]

describe('tests & questions CRUD', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'testsys-tests-'))
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

  it('boots admin and two teachers', async () => {
    const admin = await login('admin', process.env.ADMIN_PASSWORD!)
    adminToken = (admin.json() as { token: string }).token

    for (const [username, fullName] of [
      ['teacher1', 'Teacher One'],
      ['teacher2', 'Teacher Two'],
    ] as const) {
      const res = await app.server.inject({
        method: 'POST',
        url: '/api/users',
        headers: bearer(adminToken),
        payload: { username, password: 'teacher-pass-1', fullName },
      })
      expect(res.statusCode).toBe(201)
    }
    const t1 = await login('teacher1', 'teacher-pass-1')
    const t2 = await login('teacher2', 'teacher-pass-1')
    teacherToken = (t1.json() as { token: string }).token
    teacher2Token = (t2.json() as { token: string }).token
  })

  it('creates a test with all five question types', async () => {
    const res = await app.server.inject({
      method: 'POST',
      url: '/api/tests',
      headers: bearer(teacherToken),
      payload: {
        title: 'Intro quiz',
        description: 'First test',
        timeLimitSec: 600,
        passingPercent: 60,
        questions: FIVE_TYPES,
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { test: TestPayload & { questions: QuestionPayload[] } }
    expect(body.test.title).toBe('Intro quiz')
    expect(body.test.timeLimitSec).toBe(600)
    expect(body.test.passingPercent).toBe(60)
    expect(body.test.questions).toHaveLength(5)
    // Order and payload survive round-trip.
    expect(body.test.questions.map((q) => q.position)).toEqual([0, 1, 2, 3, 4])
    expect(body.test.questions[4]!.payload).toEqual({
      pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }],
    })
  })

  it('rejects an invalid question payload', async () => {
    const res = await app.server.inject({
      method: 'POST',
      url: '/api/tests',
      headers: bearer(teacherToken),
      payload: {
        title: 'Bad test',
        questions: [
          {
            type: 'single_choice',
            body: 'Broken',
            points: 1,
            position: 0,
            payload: { options: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }], correct: 'zz' },
          },
        ],
      },
    })
    expect(res.statusCode).toBe(400)
    expect((res.json() as ErrorBody).error.code).toBe('VALIDATION')
  })

  it('only exposes a teacher to their own tests', async () => {
    const adminList = await app.server.inject({
      method: 'GET',
      url: '/api/tests',
      headers: bearer(adminToken),
    })
    expect(adminList.statusCode).toBe(200)
    const adminBody = adminList.json() as { tests: TestPayload[] }
    expect(adminBody.tests.length).toBe(1)

    const teacher2List = await app.server.inject({
      method: 'GET',
      url: '/api/tests',
      headers: bearer(teacher2Token),
    })
    expect((teacher2List.json() as { tests: TestPayload[] }).tests).toHaveLength(0)
  })

  it('reads a test with questions by id', async () => {
    const list = await app.server.inject({
      method: 'GET',
      url: '/api/tests',
      headers: bearer(teacherToken),
    })
    const { tests } = list.json() as { tests: TestPayload[] }
    const res = await app.server.inject({
      method: 'GET',
      url: `/api/tests/${tests[0]!.id}`,
      headers: bearer(teacherToken),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { test: { questions: QuestionPayload[] } }
    expect(body.test.questions).toHaveLength(5)
  })

  it('replaces questions on update', async () => {
    const list = await app.server.inject({
      method: 'GET',
      url: '/api/tests',
      headers: bearer(teacherToken),
    })
    const { tests } = list.json() as { tests: TestPayload[] }
    const res = await app.server.inject({
      method: 'PUT',
      url: `/api/tests/${tests[0]!.id}`,
      headers: bearer(teacherToken),
      payload: {
        title: 'Intro quiz v2',
        questions: [
          {
            type: 'true_false',
            body: 'Sky is blue',
            points: 1,
            position: 0,
            payload: { correct: true },
          },
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { test: TestPayload & { questions: QuestionPayload[] } }
    expect(body.test.title).toBe('Intro quiz v2')
    expect(body.test.questions).toHaveLength(1)
  })

  it('deletes a test and cascades questions', async () => {
    const list = await app.server.inject({
      method: 'GET',
      url: '/api/tests',
      headers: bearer(teacherToken),
    })
    const { tests } = list.json() as { tests: TestPayload[] }
    const res = await app.server.inject({
      method: 'DELETE',
      url: `/api/tests/${tests[0]!.id}`,
      headers: bearer(teacherToken),
    })
    expect(res.statusCode).toBe(204)
    const after = await app.server.inject({
      method: 'GET',
      url: `/api/tests/${tests[0]!.id}`,
      headers: bearer(teacherToken),
    })
    expect(after.statusCode).toBe(404)
  })

  it('blocks students from the tests API', async () => {
    const reg = await app.server.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'stu-test', password: 'student-pass-1', fullName: 'Stu' },
    })
    expect(reg.statusCode).toBe(201)
    const id = (reg.json() as { user: { id: string } }).user.id
    await app.server.inject({
      method: 'PATCH',
      url: `/api/users/${id}/status`,
      headers: bearer(adminToken),
      payload: { status: 'approved' },
    })
    const studentLogin = await login('stu-test', 'student-pass-1')
    const token = (studentLogin.json() as { token: string }).token
    const res = await app.server.inject({
      method: 'GET',
      url: '/api/tests',
      headers: bearer(token),
    })
    expect(res.statusCode).toBe(403)
  })

  it('forbids editing a test owned by another teacher', async () => {
    // teacher2 owns nothing yet; create one to attempt cross-owner access.
    const create = await app.server.inject({
      method: 'POST',
      url: '/api/tests',
      headers: bearer(teacher2Token),
      payload: { title: 'T2 test' },
    })
    const created = (create.json() as { test: TestPayload }).test
    const res = await app.server.inject({
      method: 'PUT',
      url: `/api/tests/${created.id}`,
      headers: bearer(teacherToken),
      payload: { title: 'Hijacked' },
    })
    expect(res.statusCode).toBe(403)
  })
})