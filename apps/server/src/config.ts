import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import { dirname } from 'node:path'

export interface ServerConfig {
  host: string
  port: number
  dataDir: string
  webRoot: string | null
  dbPath: string
}

function arg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}

function asWebRoot(value: string | undefined): string | null {
  if (!value) return null
  return existsSync(value) ? value : null
}

/**
 * Base directory for locating the production student-client build.
 *
 * - Running from source (`bun src/index.ts`): `import.meta.dir` is the `src`
 *   folder and is used directly.
 * - Compiled binary (`bun build --compile`): `import.meta.dir` points at the
 *   virtual `/$bunfs/root`, so we resolve against the real executable instead.
 */
function baseDir(): string {
  if (!import.meta.dir.startsWith('/$bunfs')) return import.meta.dir
  return dirname(realpathSync(process.execPath))
}

/**
 * Resolves the production student-client build depending on the layout.
 */
function resolveWebRoot(baseDirValue: string): string {
  // From a repo checkout the build always lives one level up, two levels in:
  //   apps/server/src  -> ../../web-client/dist   (source run)
  //   apps/server/dist -> ../../web-client/dist   (compiled binary)
  const candidates = [
    `${baseDirValue}/../../web-client/dist`,
    // When the binary ships bundled beside its web client:
    `${baseDirValue}/../web-client/dist`,
    `${baseDirValue}/dist`,
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return ''
}

export function loadConfig(argv: string[]): ServerConfig {
  const baseDirValue = baseDir()
  const dataDir = arg(argv, '--data') ?? './data'
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

  const explicitWebRoot = asWebRoot(arg(argv, '--webroot'))
  const autoWebRoot = resolveWebRoot(baseDirValue)

  return {
    host: arg(argv, '--host') ?? '0.0.0.0',
    port: Number(arg(argv, '--port') ?? process.env.PORT ?? 3300),
    dataDir,
    webRoot: explicitWebRoot ?? (autoWebRoot || null),
    dbPath: `${dataDir}/app.db`,
  }
}