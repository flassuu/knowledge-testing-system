import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Database } from '../lib/db'
import { nowIso } from '../lib/db'
import { sendError } from '../lib/http'
import { hashPassword } from '../lib/passwords'
import { deleteSessionByHash } from '../lib/tokens'
import {
  findUserByUsername,
  findUserById,
  listUsers,
  toPublicUser,
  type UserRow,
  type UserStatus,
} from '../lib/users'
import { requireRoles } from '../plugins/auth'

export interface UsersDeps {
  database: Database
}

const listQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    role: { type: 'string', enum: ['admin', 'teacher', 'student'] },
    status: { type: 'string', enum: ['pending', 'approved', 'blocked'] },
    q: { type: 'string', maxLength: 64 },
  },
} as const

const createUserSchema = {
  type: 'object',
  required: ['username', 'password', 'fullName'],
  additionalProperties: false,
  properties: {
    username: { type: 'string', minLength: 3, maxLength: 32 },
    password: { type: 'string', minLength: 8, maxLength: 128 },
    fullName: { type: 'string', minLength: 1, maxLength: 100 },
  },
} as const

const statusParamsSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 36, maxLength: 36 },
  },
} as const

const statusBodySchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['pending', 'approved', 'blocked'] },
  },
} as const

export const userRoutes: FastifyPluginAsync<UsersDeps> = async (
  app: FastifyInstance,
  { database }: UsersDeps,
) => {
  const db = database.raw

  /** List users with optional filters; only admins can browse the roster. */
  app.get(
    '/api/users',
    {
      preHandler: requireRoles('admin'),
      schema: { querystring: listQuerySchema },
    },
    async (request) => {
      const query = request.query as {
        role?: 'admin' | 'teacher' | 'student'
        status?: UserStatus
        q?: string
      }
      const users = listUsers(db, {
        role: query.role,
        status: query.status,
        q: query.q,
      }).map(toPublicUser)
      return { users }
    },
  )

  /** Admin creates teachers; they are approved immediately. */
  app.post(
    '/api/users',
    {
      preHandler: requireRoles('admin'),
      schema: { body: createUserSchema },
    },
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
        'teacher',
        'approved',
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

  /** Admins approve/block pending student registrations and revoke access. */
  app.patch(
    '/api/users/:id/status',
    {
      preHandler: requireRoles('admin'),
      schema: { params: statusParamsSchema, body: statusBodySchema },
    },
    async (request, reply) => {
      const params = request.params as { id: string }
      const body = request.body as { status: UserStatus }
      const target = findUserById(db, params.id)
      if (!target) {
        return sendError(reply, 404, 'NOT_FOUND', 'user not found')
      }
      if (target.role === 'admin') {
        return sendError(reply, 400, 'INVALID_OPERATION', 'admin accounts cannot be modified')
      }
      const now = nowIso()
      db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(
        body.status,
        now,
        target.id,
      )
      // Blocking revokes all active sessions immediately.
      if (body.status === 'blocked') {
        const sessions = db
          .prepare('SELECT token_hash FROM sessions WHERE user_id = ?')
          .all(target.id) as Array<{ token_hash: string }>
        for (const session of sessions) {
          deleteSessionByHash(db, session.token_hash)
        }
      }
      const updated = findUserById(db, target.id) as UserRow
      return { user: toPublicUser(updated) }
    },
  )

  /** Admins can remove teachers and students; admin accounts stay immutable. */
  app.delete(
    '/api/users/:id',
    {
      preHandler: requireRoles('admin'),
      schema: { params: statusParamsSchema },
    },
    async (request, reply) => {
      const params = request.params as { id: string }
      const target = findUserById(db, params.id)
      if (!target) {
        return sendError(reply, 404, 'NOT_FOUND', 'user not found')
      }
      if (target.role === 'admin') {
        return sendError(reply, 400, 'INVALID_OPERATION', 'admin accounts cannot be deleted')
      }
      db.prepare('DELETE FROM users WHERE id = ?').run(target.id)
      return reply.code(204).send()
    },
  )
}