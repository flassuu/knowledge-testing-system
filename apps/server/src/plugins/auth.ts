import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify'
import type { Database } from '../lib/db'
import { sendError } from '../lib/http'
import { resolveSession, type Session } from '../lib/tokens'
import type { UserRole } from '../lib/users'

declare module 'fastify' {
  interface FastifyRequest {
    session: Session | null
  }
}

function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined
  const match = /^Bearer (.+)$/.exec(header)
  return match?.[1] ?? undefined
}

/**
 * Attaches session resolution to the root app instance, so `request.session`
 * is populated in every route context (Fastify hooks do not cross plugin
 * encapsulation boundaries by default).
 */
export function attachAuth(app: FastifyInstance, database: Database): void {
  app.decorateRequest('session', null)
  app.addHook('onRequest', async (request) => {
    request.session = resolveSession(
      database.raw,
      bearerToken(request.headers.authorization),
    )
  })
}

/** Pre-handler guard for routes that need a logged-in user of one of the roles. */
export function requireRoles(...allowed: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.session
    if (!session) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'authentication required')
    }
    if (!allowed.includes(session.role as UserRole)) {
      return sendError(reply, 403, 'FORBIDDEN', 'insufficient role')
    }
  }
}