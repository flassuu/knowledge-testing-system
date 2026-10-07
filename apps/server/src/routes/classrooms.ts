import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import {
  createClassroom,
  deleteClassroom,
  findActiveClassroomByKey,
  findClassroomById,
  getClassroom,
  listClassroomMembers,
  listClassrooms,
  regenerateClassroomKey,
  renameClassroom,
  revokeClassroom,
  setClassroomCourse,
  toClassPreview,
} from '../lib/classrooms'
import { normalizeCode } from '../lib/codes'
import { findCourseRow } from '../lib/courses'
import type { Database } from '../lib/db'
import { sendError } from '../lib/http'
import { requireRoles } from '../plugins/auth'
import type { Session } from '../lib/tokens'

export interface ClassroomDeps {
  database: Database
}

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: { id: { type: 'string', minLength: 36, maxLength: 36 } },
} as const

const createSchema = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 60 },
    courseId: { type: ['string', 'null'], maxLength: 36 },
  },
} as const

const renameSchema = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 60 },
    courseId: { type: ['string', 'null'], maxLength: 36 },
  },
} as const

const previewQuerySchema = {
  type: 'object',
  required: ['key'],
  additionalProperties: false,
  properties: { key: { type: 'string', minLength: 1, maxLength: 16 } },
} as const

/**
 * Ownership. A class belongs to the teacher who made it: an admin may see and
 * manage everything, another teacher may see nothing. There is deliberately no
 * way for one teacher to touch another's class - that is the boundary this
 * whole feature exists to draw.
 */
function mayManage(session: Session, ownerId: string): boolean {
  return session.role === 'admin' || session.userId === ownerId
}

export const classroomRoutes: FastifyPluginAsync<ClassroomDeps> = async (
  app: FastifyInstance,
  { database }: ClassroomDeps,
) => {
  const db: DatabaseSync = database.raw

  /**
   * What a class key leads to, without signing anything up. Public on purpose:
   * the register screen is the one screen nobody is signed in on, and a student
   * deserves to see "Class 9A · Olena M." before typing a password.
   *
   * A wrong key and a revoked key answer the same way, so a key cannot be used
   * to find out which classes existed.
   */
  app.get(
    '/api/classrooms/preview',
    { schema: { querystring: previewQuerySchema } },
    async (request, reply) => {
      const query = request.query as { key: string }
      const key = normalizeCode(query.key)
      const row = key ? findActiveClassroomByKey(db, key) : null
      if (!row) return sendError(reply, 404, 'NOT_FOUND', 'no such class key')
      return { preview: toClassPreview(db, row) }
    },
  )

  app.get(
    '/api/classrooms',
    { preHandler: requireRoles('admin', 'teacher') },
    async (request) => {
      const session = request.session!
      // A teacher sees their own rooms; an admin sees every room in the school.
      const ownerId = session.role === 'admin' ? null : session.userId
      return { classrooms: listClassrooms(db, ownerId) }
    },
  )

  app.post(
    '/api/classrooms',
    { preHandler: requireRoles('admin', 'teacher'), schema: { body: createSchema } },
    async (request, reply) => {
      const session = request.session!
      const body = request.body as { name: string; courseId?: string | null }
      const name = body.name.trim()
      if (name === '') return sendError(reply, 400, 'VALIDATION', 'class name is required')
      const courseId = checkCourse(db, body.courseId ?? null, session)
      if (courseId === undefined) {
        return sendError(reply, 400, 'VALIDATION', 'no such course')
      }
      const classroom = createClassroom(db, { ownerId: session.userId, name, courseId })
      return reply.code(201).send({ classroom })
    },
  )

  app.get(
    '/api/classrooms/:id',
    { preHandler: requireRoles('admin', 'teacher'), schema: { params: idParamsSchema } },
    async (request, reply) => {
      const session = request.session!
      const params = request.params as { id: string }
      const row = findClassroomById(db, params.id)
      if (!row) return sendError(reply, 404, 'NOT_FOUND', 'class not found')
      if (!mayManage(session, row.owner_id)) {
        return sendError(reply, 403, 'FORBIDDEN', 'insufficient role')
      }
      return {
        classroom: getClassroom(db, row.id),
        members: listClassroomMembers(db, row.id),
      }
    },
  )

  app.patch(
    '/api/classrooms/:id',
    { preHandler: requireRoles('admin', 'teacher'), schema: { params: idParamsSchema, body: renameSchema } },
    async (request, reply) => {
      const session = request.session!
      const params = request.params as { id: string }
      const row = findClassroomById(db, params.id)
      if (!row) return sendError(reply, 404, 'NOT_FOUND', 'class not found')
      if (!mayManage(session, row.owner_id)) {
        return sendError(reply, 403, 'FORBIDDEN', 'insufficient role')
      }
      const body = request.body as { name: string; courseId?: string | null }
      const name = body.name.trim()
      if (name === '') return sendError(reply, 400, 'VALIDATION', 'class name is required')
      if (body.courseId !== undefined) {
        const courseId = checkCourse(db, body.courseId, session)
        if (courseId === undefined) {
          return sendError(reply, 400, 'VALIDATION', 'no such course')
        }
        setClassroomCourse(db, row.id, courseId)
      }
      renameClassroom(db, row.id, name)
      return { classroom: getClassroom(db, row.id) }
    },
  )

  app.post(
    '/api/classrooms/:id/revoke',
    { preHandler: requireRoles('admin', 'teacher'), schema: { params: idParamsSchema } },
    async (request, reply) => {
      const session = request.session!
      const params = request.params as { id: string }
      const row = findClassroomById(db, params.id)
      if (!row) return sendError(reply, 404, 'NOT_FOUND', 'class not found')
      if (!mayManage(session, row.owner_id)) {
        return sendError(reply, 403, 'FORBIDDEN', 'insufficient role')
      }
      revokeClassroom(db, row.id)
      return { classroom: getClassroom(db, row.id) }
    },
  )

  /** A new key for a room someone photographed and posted on a wall. */
  app.post(
    '/api/classrooms/:id/key',
    { preHandler: requireRoles('admin', 'teacher'), schema: { params: idParamsSchema } },
    async (request, reply) => {
      const session = request.session!
      const params = request.params as { id: string }
      const row = findClassroomById(db, params.id)
      if (!row) return sendError(reply, 404, 'NOT_FOUND', 'class not found')
      if (!mayManage(session, row.owner_id)) {
        return sendError(reply, 403, 'FORBIDDEN', 'insufficient role')
      }
      const key = regenerateClassroomKey(db, row.id)
      return { key, classroom: getClassroom(db, row.id) }
    },
  )

  app.delete(
    '/api/classrooms/:id',
    { preHandler: requireRoles('admin', 'teacher'), schema: { params: idParamsSchema } },
    async (request, reply) => {
      const session = request.session!
      const params = request.params as { id: string }
      const row = findClassroomById(db, params.id)
      if (!row) return sendError(reply, 404, 'NOT_FOUND', 'class not found')
      if (!mayManage(session, row.owner_id)) {
        return sendError(reply, 403, 'FORBIDDEN', 'insufficient role')
      }
      deleteClassroom(db, row.id)
      return reply.code(204).send()
    },
  )
}

/**
 * Validates an optional course link. `undefined` means "not usable", which the
 * caller turns into a 400; a course the requester cannot attach is rejected the
 * same way as a missing one rather than silently ignored.
 */
function checkCourse(
  db: DatabaseSync,
  courseId: string | null,
  session: Session,
): string | null | undefined {
  if (courseId === null) return null
  const course = findCourseRow(db, courseId)
  if (!course) return undefined
  if (!mayManage(session, course.owner_id)) return undefined
  return course.id
}