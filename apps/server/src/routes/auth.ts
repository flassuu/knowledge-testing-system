import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Database } from '../lib/db'
import { nowIso } from '../lib/db'
import { sendError } from '../lib/http'
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
   * Students register themselves; the account starts `pending` until a teacher
   * or admin approves it.
   */
  app.post(
    '/api/auth/register',
    { schema: { body: registerSchema } },
    async (request, reply) => {
      const body = request.body as {
        username: string
        password: string
        fullName: string
      }
      if (findUserByUsername(db, body.username)) {
        return sendError(reply, 409, 'CONFLICT', 'username already taken')
      }
      const now = nowIso()
      db.prepare(
        `INSERT INTO users (id, role, status, username, password_hash, full_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        randomUUID(),
        'student',
        'pending',
        body.username,
        hashPassword(body.password),
        body.fullName,
        now,
        now,
      )
      const user = findUserByUsername(db, body.username) as UserRow
      return reply.code(201).send({ user: toPublicUser(user) })
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