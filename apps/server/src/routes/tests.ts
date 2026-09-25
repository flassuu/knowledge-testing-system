import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Database } from '../lib/db'
import { sendError } from '../lib/http'
import {
  createTest,
  deleteTest,
  findTestRow,
  listQuestions,
  listTestRows,
  updateTest,
  validateQuestion,
  type Question,
  type QuestionInput,
  type TestWithQuestions,
} from '../lib/tests'
import { requireRoles } from '../plugins/auth'
import type { Session } from '../lib/tokens'

export interface TestsDeps {
  database: Database
}

const questionSchema = {
  type: 'object',
  required: ['type', 'body', 'points', 'position', 'payload'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      enum: ['single_choice', 'multiple_choice', 'true_false', 'short_answer', 'matching'],
    },
    body: { type: 'string', minLength: 1, maxLength: 5000 },
    points: { type: 'integer', minimum: 1, maximum: 1000 },
    position: { type: 'integer', minimum: 0 },
    payload: { type: 'object' },
  },
} as const

const testBodySchema = {
  type: 'object',
  required: ['title'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 2000 },
    timeLimitSec: { type: ['integer', 'null'], minimum: 1 },
    passingPercent: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
    questions: { type: 'array', maxItems: 200, items: questionSchema },
  },
} as const

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: { id: { type: 'string', minLength: 36, maxLength: 36 } },
} as const

interface TestInput {
  title: string
  description?: string
  timeLimitSec?: number | null
  passingPercent?: number | null
  questions?: QuestionInput[]
}

/** True when the session may view/modify a test owned by `ownerId`. */
function canAccess(session: Session, ownerId: string): boolean {
  return session.role === 'admin' || session.userId === ownerId
}

/** Returns the validated questions, or null when any of them is invalid. */
function parseQuestions(questions: QuestionInput[] | undefined): QuestionInput[] | null {
  if (!questions) return []
  for (const question of questions) {
    if (validateQuestion(question)) return null
  }
  return questions
}

function fullTest(
  row: { id: string; owner_id: string; title: string; description: string; time_limit_sec: number | null; passing_percent: number | null; created_at: string; updated_at: string },
  questions: Question[],
): TestWithQuestions {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    timeLimitSec: row.time_limit_sec,
    passingPercent: row.passing_percent,
    questions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const testRoutes: FastifyPluginAsync<TestsDeps> = async (
  app: FastifyInstance,
  { database }: TestsDeps,
) => {
  const db = database.raw

  app.get(
    '/api/tests',
    { preHandler: requireRoles('admin', 'teacher') },
    async (request) => {
      const session = request.session!
      const tests = listTestRows(db, session.userId, session.role === 'admin').map(
        ({ test }) => test,
      )
      return { tests }
    },
  )

  app.post(
    '/api/tests',
    {
      preHandler: requireRoles('admin', 'teacher'),
      schema: { body: testBodySchema },
    },
    async (request, reply) => {
      const session = request.session!
      const body = request.body as TestInput
      const questions = parseQuestions(body.questions)
      if (!questions) {
        return sendError(reply, 400, 'VALIDATION', 'one or more questions are invalid')
      }
      const created = createTest(
        db,
        session.userId,
        {
          title: body.title,
          description: body.description ?? '',
          timeLimitSec: body.timeLimitSec,
          passingPercent: body.passingPercent,
        },
        questions,
      )
      return reply.code(201).send({
        test: fullTest(created, listQuestions(db, created.id)),
      })
    },
  )

  app.get(
    '/api/tests/:id',
    {
      preHandler: requireRoles('admin', 'teacher'),
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const session = request.session!
      const params = request.params as { id: string }
      const test = findTestRow(db, params.id)
      if (!test) return sendError(reply, 404, 'NOT_FOUND', 'test not found')
      if (!canAccess(session, test.owner_id)) {
        return sendError(reply, 403, 'FORBIDDEN', 'insufficient role')
      }
      return { test: fullTest(test, listQuestions(db, test.id)) }
    },
  )

  app.put(
    '/api/tests/:id',
    {
      preHandler: requireRoles('admin', 'teacher'),
      schema: { params: idParamsSchema, body: testBodySchema },
    },
    async (request, reply) => {
      const session = request.session!
      const params = request.params as { id: string }
      const body = request.body as TestInput
      const test = findTestRow(db, params.id)
      if (!test) return sendError(reply, 404, 'NOT_FOUND', 'test not found')
      if (!canAccess(session, test.owner_id)) {
        return sendError(reply, 403, 'FORBIDDEN', 'insufficient role')
      }
      const questions = parseQuestions(body.questions)
      if (!questions) {
        return sendError(reply, 400, 'VALIDATION', 'one or more questions are invalid')
      }
      const updated = updateTest(
        db,
        test,
        {
          title: body.title,
          description: body.description ?? '',
          timeLimitSec: body.timeLimitSec,
          passingPercent: body.passingPercent,
        },
        questions,
      )
      return { test: fullTest(updated, listQuestions(db, updated.id)) }
    },
  )

  app.delete(
    '/api/tests/:id',
    {
      preHandler: requireRoles('admin', 'teacher'),
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const session = request.session!
      const params = request.params as { id: string }
      const test = findTestRow(db, params.id)
      if (!test) return sendError(reply, 404, 'NOT_FOUND', 'test not found')
      if (!canAccess(session, test.owner_id)) {
        return sendError(reply, 403, 'FORBIDDEN', 'insufficient role')
      }
      deleteTest(db, test.id)
      return reply.code(204).send()
    },
  )
}