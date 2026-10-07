import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Database } from '../lib/db'
import type { LogEntry, LogHub } from '../lib/log'
import { resolveSession } from '../lib/tokens'
import { requireRoles } from '../plugins/auth'

export interface LogsDeps {
  database: Database
  logs: LogHub
}

const listQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    /** Return only lines newer than this sequence number. */
    since: { type: 'integer', minimum: 0 },
  },
} as const

export const logRoutes: FastifyPluginAsync<LogsDeps> = async (
  app: FastifyInstance,
  { database, logs }: LogsDeps,
) => {
  /**
   * The lines the terminal shows, for a client that cannot reach the terminal:
   * the desktop console and the admin Server tab.
   *
   * Admin only, and that is not a formality. A log names who signed in, which
   * accounts exist, which logins failed and what a draft could not reach — on a
   * teacher's machine that is the list a student must not be able to read.
   */
  app.get(
    '/api/logs',
    { preHandler: requireRoles('admin'), schema: { querystring: listQuerySchema } },
    async (request) => {
      const query = (request.query ?? {}) as { since?: number }
      const entries = logs.buffer.since(query.since ?? 0)
      return { entries, lastSeq: logs.buffer.latest() }
    },
  )

  /**
   * The live tail over the same buffer.
   *
   * A client sends `?since=` and gets what it missed, then every new line as it
   * happens: one socket, no gap between the backlog and the stream, and no
   * polling. The sequence number in each line is what makes a reconnect exact.
   */
  app.get('/ws/server', { websocket: true }, (socket, request) => {
    // Browsers cannot set headers on a WebSocket handshake, so the token travels
    // in the query string, the same way the session board does it.
    const query = request.query as { token?: string; since?: string }
    const session = resolveSession(database.raw, query.token ?? '')
    if (!session) {
      socket.send(JSON.stringify({ type: 'error', code: 'UNAUTHORIZED', message: 'authentication required' }))
      socket.close(4401, 'unauthorized')
      return
    }
    if (session.role !== 'admin') {
      socket.send(JSON.stringify({ type: 'error', code: 'FORBIDDEN', message: 'admin only' }))
      socket.close(4403, 'forbidden')
      return
    }

    const since = Number(query.since ?? 0)
    const backlog = Number.isFinite(since) ? logs.buffer.since(since) : logs.buffer.all()
    socket.send(JSON.stringify({ type: 'backlog', entries: backlog, lastSeq: logs.buffer.latest() }))

    const send = (entry: LogEntry) => {
      socket.send(JSON.stringify({ type: 'entry', entry }))
    }
    const unsubscribe = logs.subscribe(send)

    socket.on('close', unsubscribe)
    socket.on('error', unsubscribe)
  })
}