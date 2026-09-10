// `index.ts` is always the entrypoint; this module is never imported by tests.
import { loadConfig } from './config'
import { startServer } from './app'

const config = loadConfig(process.argv.slice(2))

await startServer({
  host: config.host,
  port: config.port,
  dbPath: config.dbPath,
  webRoot: config.webRoot,
})

console.log(
  `[server] listening on http://${config.host}:${config.port} (db: ${config.dbPath})`,
)