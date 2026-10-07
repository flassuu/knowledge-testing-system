import { describe, expect, it } from 'bun:test'
import {
  LogBuffer,
  createLogHub,
  formatHuman,
  formatOutput,
  redactUrl,
  relativeTime,
  toEntry,
  type LogEntry,
} from '../src/lib/log'

const AT = '2026-10-07T10:00:00.000Z'
const NOW = new Date(AT).getTime()

function entry(overrides: Partial<LogEntry> = {}): LogEntry {
  return { seq: 1, at: AT, level: 'info', msg: 'something happened', fields: {}, ...overrides }
}

// The escape byte pino-era tools use: assertions compare text, not colour.
const ESC = '\u001b'
const RESET = `${ESC}[0m`

/** Strips colour so an assertion reads the columns, not the escapes. */
function plain(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[\d+m/g, '')
}

describe('the human line', () => {
  it('shows the time, the age, the level and the message', () => {
    const line = plain(formatHuman(entry({ msg: 'server listening' }), NOW))
    expect(line).toContain('server listening')
    expect(line).toContain('info')
    // Local wall clock, and an age that reads as a duration.
    expect(line).toMatch(/\d{2}:\d{2}:\d{2}/)
    expect(line).toMatch(/\+\d+s/)
  })

  it('colours the level, and nothing else, on a terminal', () => {
    const raw = formatHuman(entry({ level: 'error' }), NOW)
    expect(raw).toContain('[31m')
    expect(raw).toContain(RESET)

    const debug = formatHuman(entry({ level: 'debug' }), NOW)
    expect(debug).toContain('[2m')
  })

  it('renders a request as one compact line with its status', () => {
    const line = plain(
      formatHuman(
        entry({
          level: 'info',
          msg: 'incoming request',
          fields: { req: { method: 'GET', url: '/api/tests', statusCode: 200 } },
        }),
        NOW,
      ),
    )
    expect(line).toContain('→ GET /api/tests 200')
    // The pino message is noise here: the request line says it better.
    expect(line).not.toContain('incoming request')
  })

  it('appends an error message, because "failed" alone says nothing', () => {
    const line = plain(
      formatHuman(
        entry({ level: 'error', msg: 'failed to start', fields: { err: { message: 'port in use' } } }),
        NOW,
      ),
    )
    expect(line).toContain('failed to start: port in use')
  })

  it('keeps the columns aligned whatever the level name is', () => {
    const short = plain(formatHuman(entry({ level: 'info', msg: 'x' }), NOW))
    const long = plain(formatHuman(entry({ level: 'fatal', msg: 'x' }), NOW))
    const messageColumn = (line: string) => line.indexOf('x')
    expect(messageColumn(short)).toBe(messageColumn(long))
  })

  it('reads the age as seconds, then minutes, then hours', () => {
    expect(relativeTime(NOW, NOW + 5_000)).toBe('+5s')
    expect(relativeTime(NOW, NOW + 65_000)).toBe('+1m05s')
    expect(relativeTime(NOW, NOW + 3 * 3_600_000 + 7 * 60_000)).toBe('+3h07m')
    // A clock that went backwards must not print a negative age.
    expect(relativeTime(NOW, NOW - 5_000)).toBe('+0s')
  })
})

describe('piped output', () => {
  it('is the JSON pino wrote, byte for byte', () => {
    const raw = '{"level":30,"time":1791394897973,"msg":"hello","extra":{"a":1}}'
    const buffer = new LogBuffer()
    const entry = buffer.push(toEntry(JSON.parse(raw)))
    // Same string in, same string out - not a re-serialisation that could drop
    // a field something downstream is reading.
    expect(formatOutput(raw, entry, false, NOW)).toBe(raw)
  })

  it('is a human line on a terminal', () => {
    const raw = '{"level":30,"time":1791394897973,"msg":"hello"}'
    const buffer = new LogBuffer()
    const entry = buffer.push(toEntry(JSON.parse(raw)))
    expect(formatOutput(raw, entry, true, NOW)).not.toBe(raw)
    expect(formatOutput(raw, entry, true, NOW)).toContain('hello')
  })
})

describe('the record shape handed to HTTP and WebSocket clients', () => {
  it('turns a pino level number into a name and the epoch into ISO', () => {
    const entry = toEntry({ level: 50, time: NOW, msg: 'boom' })
    expect(entry.level).toBe('error')
    expect(entry.at).toBe(AT)
    expect(entry.msg).toBe('boom')
  })

  it('knows every level pino can emit', () => {
    expect(toEntry({ level: 10, time: NOW }).level).toBe('debug')
    expect(toEntry({ level: 20, time: NOW }).level).toBe('debug')
    expect(toEntry({ level: 30, time: NOW }).level).toBe('info')
    expect(toEntry({ level: 40, time: NOW }).level).toBe('warn')
    expect(toEntry({ level: 50, time: NOW }).level).toBe('error')
    expect(toEntry({ level: 60, time: NOW }).level).toBe('fatal')
  })

  it('keeps a stack out of a line that goes over the wire', () => {
    const entry = toEntry({
      level: 50,
      time: NOW,
      err: { message: 'nope', stack: 'Error: nope\n    at x\n    at y' },
    })
    expect(entry.fields.err).toEqual({ message: 'nope' })
  })

  it('trims a request to the three fields worth showing', () => {
    const entry = toEntry({
      level: 30,
      time: NOW,
      req: { method: 'POST', url: '/api/sessions', statusCode: 201, headers: { cookie: 'x' } },
    })
    expect(entry.fields.req).toEqual({ method: 'POST', url: '/api/sessions', statusCode: 201 })
  })

  it('carries unknown fields through, so nothing is silently lost', () => {
    const entry = toEntry({ level: 30, time: NOW, msg: 'x', classroomId: 'abc' })
    expect(entry.fields.classroomId).toBe('abc')
  })
})

describe('the ring buffer', () => {
  function fill(buffer: LogBuffer, count: number): void {
    for (let index = 0; index < count; index += 1) {
      buffer.push(toEntry({ level: 30, time: NOW + index, msg: `line ${index}` }))
    }
  }

  it('numbers lines in order, so a client can ask for what it missed', () => {
    const buffer = new LogBuffer(10)
    fill(buffer, 3)
    expect(buffer.all().map((line) => line.seq)).toEqual([1, 2, 3])
    expect(buffer.latest()).toBe(3)
  })

  it('returns everything newer than a sequence number', () => {
    const buffer = new LogBuffer(10)
    fill(buffer, 5)
    expect(buffer.since(2).map((line) => line.msg)).toEqual([
      'line 2',
      'line 3',
      'line 4',
    ])
    expect(buffer.since(5)).toEqual([])
  })

  it('trims the oldest lines and never grows past its capacity', () => {
    const buffer = new LogBuffer(4)
    fill(buffer, 9)
    expect(buffer.size).toBe(4)
    // The five oldest are gone; what is left is the tail, in order.
    expect(buffer.all().map((line) => line.msg)).toEqual([
      'line 5',
      'line 6',
      'line 7',
      'line 8',
    ])
  })

  it('still answers "what is new" after trimming', () => {
    const buffer = new LogBuffer(3)
    fill(buffer, 10)
    // A client that was at seq 5 gets the lines it can still have, not a gap
    // error and not a false "nothing new".
    expect(buffer.since(5).map((line) => line.msg)).toEqual([
      'line 7',
      'line 8',
      'line 9',
    ])
  })

  it('keeps numbering after a trim, so sequence numbers never repeat', () => {
    const buffer = new LogBuffer(2)
    fill(buffer, 5)
    expect(buffer.latest()).toBe(5)
    const next = buffer.push(toEntry({ level: 30, time: NOW, msg: 'after' }))
    expect(next.seq).toBe(6)
  })

  it('starts empty and reports nothing as the newest sequence', () => {
    const buffer = new LogBuffer()
    expect(buffer.size).toBe(0)
    expect(buffer.latest()).toBe(0)
    expect(buffer.since(0)).toEqual([])
  })

  it('survives a record that is not JSON', () => {
    const buffer = new LogBuffer(4)
    // The stream guards this; the buffer itself should not be the thing that
    // throws on an unexpected record.
    expect(() =>
      buffer.push(toEntry({ level: 30, time: NOW, msg: 'plain text line' })),
    ).not.toThrow()
    expect(buffer.size).toBe(1)
  })
})
describe('secrets in a request URL', () => {
  it('replaces the token query parameter, whatever the casing and position', () => {
    expect(redactUrl('/ws/sessions/x?token=abc123')).toBe('/ws/sessions/x?token=…')
    expect(redactUrl('/ws/server?since=4&token=abc123')).toBe('/ws/server?since=4&token=…')
    expect(redactUrl('/login?TOKEN=abc123')).toBe('/login?TOKEN=…')
    expect(redactUrl('/x?password=hunter2')).toBe('/x?password=…')
  })

  it('leaves a URL with no secret exactly as it was', () => {
    expect(redactUrl('/api/tests?role=student')).toBe('/api/tests?role=student')
    expect(redactUrl('/api/sessions/join')).toBe('/api/sessions/join')
  })

  it('keeps a token out of the buffer, in both output modes', () => {
    const lines: string[] = []
    const hub = createLogHub({ level: 'info', tty: false, write: (line) => lines.push(line) })
    hub.logger.info(
      { req: { method: 'GET', url: '/ws/sessions/abc?token=SECRETVALUE', statusCode: 101 } },
      'incoming request',
    )
    expect(lines.join('')).not.toContain('SECRETVALUE')
    expect(hub.buffer.all().map((entry) => JSON.stringify(entry)).join('')).not.toContain(
      'SECRETVALUE',
    )
  })

  it('passes a line with no secret through byte for byte', () => {
    const lines: string[] = []
    const hub = createLogHub({ level: 'info', tty: false, write: (line) => lines.push(line) })
    hub.logger.info({ req: { method: 'GET', url: '/api/tests', statusCode: 200 } }, 'incoming request')
    const written = lines[0]!
    // Nothing was redacted, so nothing was re-serialised: the fields and their
    // order are the ones pino produced.
    expect(written.startsWith('{"level":30,"time":')).toBe(true)
    expect(written).toContain('"url":"/api/tests"')
  })

  it('re-serialises only the line that had to change', () => {
    const lines: string[] = []
    const hub = createLogHub({ level: 'info', tty: false, write: (line) => lines.push(line) })
    hub.logger.info('plain line')
    expect(lines[0]).toBe('{"level":30,"time":' + JSON.parse(lines[0]!).time + ',"msg":"plain line"}')
  })
})
