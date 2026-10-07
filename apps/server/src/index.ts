// `index.ts` is always the entrypoint; this module is never imported by tests.
import { attachConsole } from './lib/console'
import { loadConfig } from './config'
import { shutdown, startServer } from './app'

const config = loadConfig(process.argv.slice(2))

const app = await startServer({
  host: config.host,
  port: config.port,
  dbPath: config.dbPath,
  webRoot: config.webRoot,
})

const { logs } = app

logs.logger.info(
  { url: `http://${config.host}:${config.port}`, db: config.dbPath, webRoot: config.webRoot },
  `listening on http://${config.host}:${config.port}`,
)

let stopping = false
async function stop(reason: string): Promise<void> {
  // Ctrl-C twice should not race two closes of the same database handle.
  if (stopping) return
  stopping = true
  logs.logger.info({ reason }, 'stopping')
  await shutdown(app)
  process.exit(0)
}

const console = await attachConsole(
  {
    db: app.database.raw,
    logs,
    stop: () => stop('console'),
  },
  // `--no-console` for a machine with no one at the keyboard; a pipe turns it off
  // by itself, which is the case a CI run and the desktop app are in.
  { enabled: config.console },
)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console?.close()
    void stop(signal)
  })
}