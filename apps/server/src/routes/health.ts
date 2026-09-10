import type { FastifyInstance, FastifyPluginAsync } from 'fastify'

export interface HealthDeps {
  version: string
  checkDatabase: () => boolean
}

export const healthRoutes: FastifyPluginAsync<HealthDeps> = async (
  app: FastifyInstance,
  opts: HealthDeps,
) => {
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      version: opts.version,
      database: opts.checkDatabase() ? 'ok' : 'error',
      uptime_ms: process.uptime() * 1000,
      timestamp: new Date().toISOString(),
    }
  })
}