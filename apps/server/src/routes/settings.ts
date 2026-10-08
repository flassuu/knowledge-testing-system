import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Database } from '../lib/db'
import { sendError } from '../lib/http'
import {
  lanAddresses,
  normalizeBaseUrl,
  readPublicBaseUrl,
  writePublicBaseUrl,
  type ServerSettings,
} from '../lib/settings'
import { requireRoles } from '../plugins/auth'

export interface SettingsDeps {
  database: Database
  /** The port the server actually bound, so a suggestion is openable as typed. */
  port: number
}

const patchBodySchema = {
  type: 'object',
  required: ['publicBaseUrl'],
  additionalProperties: false,
  properties: {
    // Null clears the setting; an empty string does the same after validation.
    publicBaseUrl: { type: ['string', 'null'], maxLength: 200 },
  },
} as const

export const settingsRoutes: FastifyPluginAsync<SettingsDeps> = async (
  app: FastifyInstance,
  opts: SettingsDeps,
) => {
  /** Suggestions are recomputed per request: an admin may plug in a cable or
   *  join a different network between two visits to the same page. */
  function currentSettings(): ServerSettings {
    return {
      publicBaseUrl: readPublicBaseUrl(opts.database),
      suggestions: lanAddresses(opts.port),
    }
  }

  // Any signed-in role needs to know which address goes into a QR code, so the
  // read is authenticated rather than admin-only.
  app.get(
    '/api/settings',
    { preHandler: requireRoles('admin', 'teacher', 'student') },
    async () => currentSettings(),
  )

  app.patch(
    '/api/settings',
    {
      // The public address is what the teacher's own QR code points at. Keeping
      // it admin-only meant one teacher could not run a lesson on a machine that
      // had no admin on it at all, which is the primary way this product is used.
      preHandler: requireRoles('admin', 'teacher'),
      schema: { body: patchBodySchema },
    },
    async (request, reply) => {
      const body = request.body as { publicBaseUrl: string | null }
      const checked = normalizeBaseUrl(body.publicBaseUrl)
      if (!checked.ok) {
        return sendError(reply, 400, 'VALIDATION', checked.message)
      }
      writePublicBaseUrl(opts.database, checked.value)
      return currentSettings()
    },
  )
}