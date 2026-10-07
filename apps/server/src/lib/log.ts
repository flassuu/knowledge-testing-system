import { Writable } from 'node:stream'
import pino from 'pino'

/**
 * One log stream with three destinations.
 *
 * The server writes to stdout, to an in-memory buffer that `GET /api/logs` and
 * `WS /ws/server` read, and to whatever the desktop shows. All three come from
 * this module, because three formatters is how a log ends up telling three
 * different stories.
 *
 * When stdout is a terminal the line is written for a person — wall clock,
 * relative time, a coloured level, aligned columns. When it is a pipe it is
 * written as the JSON that came in, untouched, so `systemd`, `journalctl` and CI
 * keep parsing what they parsed before.
 */

export type LogLevelName = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export const LOG_LEVELS: LogLevelName[] = ['debug', 'info', 'warn', 'error', 'fatal']

export function isLogLevel(value: string): value is LogLevelName {
  return (LOG_LEVELS as string[]).includes(value)
}

/** A log line as the HTTP and WebSocket surfaces see it. */
export interface LogEntry {
  /** Monotonic per process, so a client can ask for "everything after 41". */
  seq: number
  at: string
  level: LogLevelName
  msg: string
  /** Everything else on the record, with stacks and response bodies trimmed. */
  fields: Record<string, unknown>
}

const LEVEL_NAMES: Record<number, LogLevelName> = {
  10: 'debug',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
}

interface PinoRecord {
  level: number
  time: number
  msg?: string
  [key: string]: unknown
}

/**
 * The last `capacity` lines.
 *
 * A classroom session produces a request every few seconds, so the useful window
 * is minutes, not hours: 500 lines is roughly an afternoon, and a client that
 * asks for more than that gets what is there rather than a gap in the middle.
 */
export class LogBuffer {
  #entries: LogEntry[] = []
  #seq = 0

  constructor(private readonly capacity = 500) {}

  /** Assigns the sequence number, stores the entry and returns the stored copy. */
  push(entry: Omit<LogEntry, 'seq'>): LogEntry {
    this.#seq += 1
    const stored: LogEntry = { ...entry, seq: this.#seq }
    this.#entries.push(stored)
    if (this.#entries.length > this.capacity) {
      this.#entries.splice(0, this.#entries.length - this.capacity)
    }
    return stored
  }

  /** Entries newer than `seq`, oldest first. An unknown seq yields everything. */
  since(seq: number): LogEntry[] {
    return this.#entries.filter((entry) => entry.seq > seq)
  }

  /** Everything still held, oldest first. */
  all(): LogEntry[] {
    return [...this.#entries]
  }

  /** The newest sequence number, or 0 when nothing has been logged yet. */
  latest(): number {
    return this.#seq
  }

  clear(): void {
    this.#entries = []
  }

  get size(): number {
    return this.#entries.length
  }
}

/**
 * `?token=…` never reaches a log line.
 *
 * Browsers cannot set headers on a WebSocket handshake, so the session token
 * travels in the query string — and Fastify logs the whole URL. That was already
 * true for the JSON on stdout, but before this release nothing showed those lines
 * to a person; now the same line is rendered in a browser tab, where it would be
 * read, copied into a bug report, or photographed. The token is valid for twelve
 * hours, so it is redacted at the source and never reaches any surface.
 */
export function redactUrl(url: string): string {
  return url.replace(/([?&](?:token|access_token|password)=)[^&]*/gi, '$1…')
}

const COLOURS = {
  reset: '[0m',
  dim: '[2m',
  red: '[31m',
  yellow: '[33m',
  cyan: '[36m',
}

function colourFor(level: LogLevelName): string {
  switch (level) {
    case 'error':
    case 'fatal':
      return COLOURS.red
    case 'warn':
      return COLOURS.yellow
    case 'debug':
      return COLOURS.dim
    default:
      return COLOURS.cyan
  }
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length)
}

function two(value: number): string {
  return String(value).padStart(2, '0')
}

/** Local wall clock, because a teacher reading a console thinks in local time. */
function clockTime(at: string): string {
  const date = new Date(at)
  return `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
}

/** `+12s`, `+4m03s`, `+2h07m` — how long ago, when that is worth reading. */
export function relativeTime(from: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - from) / 1000))
  if (seconds < 60) return `+${seconds}s`
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return `+${minutes}m${two(seconds % 60)}s`
  }
  const hours = Math.floor(seconds / 3600)
  return `+${hours}h${two(Math.floor((seconds % 3600) / 60))}m`
}

/**
 * The line a person reads.
 *
 * A request is not a message, it is a shape: `→ GET /api/tests 200` fits on one
 * line and tells a teacher whether their board is talking to the server. Anything
 * else is the message, with an error's own message appended when the record
 * carries one — "failed" on its own is not information.
 */
export function formatHuman(entry: LogEntry, now: number): string {
  const age = relativeTime(new Date(entry.at).getTime(), now)
  const stamp = `${COLOURS.dim}${clockTime(entry.at)}  ${pad(age, 6)}${COLOURS.reset}  `
  const level = `${colourFor(entry.level)}${pad(entry.level, 5)}${COLOURS.reset}  `
  const body = describe(entry)
  const text = entry.level === 'debug' ? `${COLOURS.dim}${body}${COLOURS.reset}` : body
  return stamp + level + text
}

function describe(entry: LogEntry): string {
  const request = entry.fields.req as
    | { method?: string; url?: string; statusCode?: number }
    | undefined
  if (request) {
    const status = request.statusCode ?? 0
    const arrow = `${COLOURS.dim}\u2192${COLOURS.reset}`
    const line = `${arrow} ${request.method || '?'} ${request.url || '?'}`
    return status > 0
      ? `${line} ${status >= 500 ? COLOURS.red : COLOURS.dim}${status}${COLOURS.reset}`
      : line
  }
  const error = entry.fields.err as { message?: string } | undefined
  const suffix = error?.message ? `: ${error.message}` : ''
  return `${entry.msg}${suffix}`
}

/**
 * One line of output: a human line on a terminal, the original JSON in a pipe.
 *
 * The piped branch returns the line exactly as pino wrote it — not a
 * re-serialisation of the record we parsed, which could silently drop a field
 * that `journalctl` or a CI log scraper is reading. That is the whole reason
 * this is one function with a branch instead of two formatters.
 */
export function formatOutput(raw: string, entry: LogEntry, tty: boolean, now: number): string {
  return tty ? formatHuman(entry, now) : raw
}

/** The wire shape of a pino record: level name, ISO time, trimmed fields. */
export function toEntry(record: PinoRecord): Omit<LogEntry, 'seq'> {
  const { level, time, msg, ...rest } = record
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    // A stack is twenty lines in a browser panel, and the response object holds
    // every header. The message is what a reader needs.
    if (key === 'err' && value && typeof value === 'object') {
      const error = value as { message?: unknown }
      fields.err = { message: String(error.message ?? '') }
      continue
    }
    if (key === 'req' && value && typeof value === 'object') {
      const request = value as { method?: string; url?: string; statusCode?: number }
      fields.req = {
        method: String(request.method ?? ''),
        url: String(request.url ?? ''),
        statusCode: Number(request.statusCode ?? 0),
      }
      continue
    }
    fields[key] = value
  }
  return {
    at: new Date(time).toISOString(),
    level: LEVEL_NAMES[level] ?? 'info',
    msg: String(msg ?? ''),
    fields,
  }
}

export interface LogHub {
  logger: pino.Logger
  buffer: LogBuffer
  /** Live tail: returns an unsubscribe function. */
  subscribe(listener: (entry: LogEntry) => void): () => void
}

export interface LogHubOptions {
  level?: string
  /** Whether stdout is a terminal. Decides the human lines over JSON. */
  tty: boolean
  capacity?: number
  /** Where the human or JSON lines go; stdout in the server. */
  write?: (line: string) => void
}

export function createLogHub(options: LogHubOptions): LogHub {
  const buffer = new LogBuffer(options.capacity ?? 500)
  const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`))
  const listeners = new Set<(entry: LogEntry) => void>()

  const stream = new Writable({
    write(chunk, _encoding, done) {
      let line = chunk.toString().trim()
      const raw = line
      if (raw === '') {
        done()
        return
      }
      let record: PinoRecord
      try {
        record = JSON.parse(raw) as PinoRecord
      } catch {
        // Not JSON: it came from somewhere that writes directly. Pass it along
        // rather than losing it.
        write(raw)
        done()
        return
      }
      const now = Date.now()
      const request = record.req as { url?: string } | undefined
      if (request && typeof request.url === 'string') {
        const safeUrl = redactUrl(request.url)
        if (safeUrl !== request.url) {
          record = { ...record, req: { ...request, url: safeUrl } }
          // Re-serialised only because something was removed; every other line
          // is passed through byte for byte.
          line = JSON.stringify(record)
        }
      }
      // The buffer is filled whether or not stdout is a terminal: the desktop
      // app starts the server as a child process, so its log is always piped,
      // and that is the surface where the live tail matters most.
      const entry = buffer.push(toEntry(record))
      write(formatOutput(line, entry, options.tty, now))
      for (const listener of listeners) {
        try {
          listener(entry)
        } catch {
          // A broken subscriber must not take the logger down with it.
        }
      }
      done()
    },
  })

  const level = options.level ?? 'info'
  const logger = pino({ level: isLogLevel(level) ? level : 'info', base: undefined }, stream)

  return {
    logger,
    buffer,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}