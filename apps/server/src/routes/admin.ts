import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Database } from '../lib/db'
import { checkDatabase, schemaVersion } from '../lib/db'
import { listParticipants, tableCounts } from '../lib/admin'
import { requireRoles } from '../plugins/auth'

export interface AdminDeps {
  database: Database
  version: string
}

/**
 * Admin-only introspection endpoints: aggregated table counts + DB health,
 * and the flat course→student participation list.
 */
export const adminRoutes: FastifyPluginAsync<AdminDeps> = async (
  app: FastifyInstance,
  { database, version }: AdminDeps,
) => {
  app.get(
    '/api/admin/stats',
    { preHandler: requireRoles('admin') },
    async () => {
      return {
        stats: {
          version,
          uptimeMs: process.uptime() * 1000,
          schemaVersion: schemaVersion(database),
          database: checkDatabase(database) ? 'ok' : 'error',
          counts: tableCounts(database),
        },
      }
    },
  )

  app.get(
    '/api/admin/participants',
    { preHandler: requireRoles('admin') },
    async () => {
      const rows = listParticipants(database)
      return {
        participants: rows.map((row) => ({
          courseId: row.course_id,
          courseTitle: row.course_title,
          studentId: row.student_id,
          username: row.username,
          fullName: row.full_name,
          status: row.student_status,
          enrolledAt: row.enrolled_at,
        })),
      }
    },
  )
}