import Fastify, {
  type FastifyError,
  type FastifyInstance,
} from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import { openDatabase, checkDatabase, type Database } from './lib/db'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { attachAuth } from './plugins/auth'
import { APP_VERSION } from './version'

export interface AppOptions {
  host: string
  port: number
  dbPath: string
  webRoot: string | null
}

export interface TestingApp {
  server: FastifyInstance
  database: Database
}

/**
 * Builds the Fastify application. Kept as a pure factory so integration
 * tests can also call `inject()` without binding a socket.
 */
export function buildApp(options: AppOptions): TestingApp {
  const database = openDatabase(options.dbPath)

  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  })

  void app.register(cors, { origin: true })

  // WebSocket upgrade support; concrete channels are registered later.
  void app.register(websocket)

  if (options.webRoot) {
    void app.register(fastifyStatic, {
      root: options.webRoot,
      prefix: '/',
    })
  }

  // Resolves `request.session` from the bearer token on every request.
  // Attached at root level so the hook reaches every route context.
  attachAuth(app, database)

  void app.register(healthRoutes, {
    version: APP_VERSION,
    checkDatabase: () => checkDatabase(database),
  })

  // Phase 1: accounts & roles.
  void app.register(authRoutes, { database })
  void app.register(userRoutes, { database })

  // Uniform error envelope; validation failures map to 400 VALIDATION.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply
        .code(400)
        .send({ error: { code: 'VALIDATION', message: error.message } })
    }
    request.log.error(error)
    const status = error.statusCode ?? 500
    const message = status === 500 ? 'internal server error' : error.message
    return reply.code(status).send({ error: { code: status === 500 ? 'INTERNAL' : 'ERROR', message } })
  })

  return { server: app, database }
}

export async function startServer(options: AppOptions): Promise<TestingApp> {
  const { server, database } = buildApp(options)
  await server.listen({ host: options.host, port: options.port })
  return { server, database }
}