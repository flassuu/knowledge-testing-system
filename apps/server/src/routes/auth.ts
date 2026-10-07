import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Database } from '../lib/db'
import { nowIso } from '../lib/db'
import { sendError } from '../lib/http'
import {
  addClassroomMember,
  findActiveClassroomByKey,
  toClassPreview,
  type ClassroomRow,
} from '../lib/classrooms'
import { normalizeCode } from '../lib/codes'
import { enrollStudent, findCourseRow, isEnrolled } from '../lib/courses'
import { hashPassword, verifyPassword } from '../lib/passwords'
import { createSession, deleteSession } from '../lib/tokens'
import {
  findUserByUsername,
  findUserById,
  toPublicUser,
  type UserRow,
} from '../lib/users'
import { requireRoles } from '../plugins/auth'

export interface AuthDeps {
  database: Database
}

const registerSchema = {
  type: 'object',
  required: ['username', 'password', 'fullName'],
  additionalProperties: false,
  properties: {
    username: { type: 'string', minLength: 3, maxLength: 32 },
    password: { type: 'string', minLength: 8, maxLength: 128 },
    fullName: { type: 'string', minLength: 1, maxLength: 100 },
    // Optional: a key a teacher handed out. It approves the account, and it
    // never grants anything but a student role.
    classKey: { type: 'string', maxLength: 16 },
  },
} as const

const loginSchema = {
  type: 'object',
  required: ['username', 'password'],
  additionalProperties: false,
  properties: {
    username: { type: 'string', minLength: 1, maxLength: 32 },
    password: { type: 'string', minLength: 1, maxLength: 128 },
  },
} as const

export const authRoutes: FastifyPluginAsync<AuthDeps> = async (
  app: FastifyInstance,
  { database }: AuthDeps,
) => {
  const db = database.raw

  /**
   * Students register themselves.
   *
   * Without a key the account starts `pending` and waits for an admin, exactly
   * as before. With a key that a teacher handed out it starts `approved` and the
   * classroom is recorded - that is the whole point of a class key: the teacher
   * is alone in the room, so nobody else can press "Approve".
   *
   * A key only ever approves a *student*. The role is hard-coded below, so no
   * key, however it was obtained, can produce anything but a student account.
   */
  app.post(
    '/api/auth/register',
    { schema: { body: registerSchema } },
    async (request, reply) => {
      const body = request.body as {
        username: string
        password: string
        fullName: string
        classKey?: string
      }
      if (findUserByUsername(db, body.username)) {
        return sendError(reply, 409, 'CONFLICT', 'username already taken')
      }

      // A key that was typed but is not usable is an error the student can fix,
      // so nothing is created: no half-registered account to explain later.
      const typedKey = (body.classKey ?? '').trim()
      let classroom: ClassroomRow | null = null
      if (typedKey !== '') {
        const key = normalizeCode(typedKey)
        classroom = key ? findActiveClassroomByKey(db, key) : null
        if (!classroom) {
          return sendError(reply, 400, 'INVALID_CLASS_KEY', 'no such class key')
        }
      }

      const now = nowIso()
      const userId = randomUUID()
      db.prepare(
        `INSERT INTO users (id, role, status, username, password_hash, full_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        userId,
        'student',
        classroom ? 'approved' : 'pending',
        body.username,
        hashPassword(body.password),
        body.fullName,
        now,
        now,
      )

      let viaClass: { className: string; teacherName: string } | null = null
      if (classroom) {
        addClassroomMember(db, classroom.id, userId)
        // A class can be tied to a course: arriving at the class is then enough
        // to be on the course roll as well.
        if (classroom.course_id) {
          const course = findCourseRow(db, classroom.course_id)
          if (course && !isEnrolled(db, course.id, userId)) {
            enrollStudent(db, course.id, userId)
          }
        }
        viaClass = toClassPreview(db, classroom)
      }

      const user = findUserByUsername(db, body.username) as UserRow
      return reply.code(201).send({ user: toPublicUser(user), viaClass })
    },
  )

  app.post(
    '/api/auth/login',
    { schema: { body: loginSchema } },
    async (request, reply) => {
      const body = request.body as { username: string; password: string }
      const user = findUserByUsername(db, body.username)
      if (!user || !verifyPassword(body.password, user.password_hash)) {
        return sendError(reply, 401, 'INVALID_CREDENTIALS', 'invalid username or password')
      }
      if (user.status === 'pending') {
        return sendError(reply, 403, 'PENDING_APPROVAL', 'account awaits approval')
      }
      if (user.status === 'blocked') {
        return sendError(reply, 403, 'BLOCKED', 'account is blocked')
      }
      const token = createSession(db, user.id)
      return { token, user: toPublicUser(user) }
    },
  )

  app.post(
    '/api/auth/logout',
    { preHandler: requireRoles('admin', 'teacher', 'student') },
    async (request, reply) => {
      const session = request.session
      if (session) deleteSession(db, session.token)
      return reply.code(204).send()
    },
  )

  app.get(
    '/api/auth/me',
    { preHandler: requireRoles('admin', 'teacher', 'student') },
    async (request, reply) => {
      const session = request.session
      if (!session) {
        return sendError(reply, 401, 'UNAUTHORIZED', 'authentication required')
      }
      const user = findUserById(db, session.userId)
      if (!user) {
        return sendError(reply, 404, 'NOT_FOUND', 'user not found')
      }
      return { user: toPublicUser(user) }
    },
  )
}