import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { ApiError, apiFetch, downloadFile, setToken } from '../src/api/client.ts'

interface FetchCall {
  url: string
  init: RequestInit
}

let calls: FetchCall[] = []
let clicked: Array<{ href: string; download: string }> = []
let createdUrls: string[] = []
let respond: () => Response

function headerOf(call: FetchCall | undefined, name: string): string | null {
  return new Headers(call?.init.headers).get(name)
}

/** Minimal browser surface: localStorage, fetch, createObjectURL and a link. */
function stubBrowser(): void {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage

  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    return respond()
  }) as typeof fetch

  globalThis.document = {
    createElement: () => ({
      href: '',
      download: '',
      click() {
        clicked.push({ href: this.href, download: this.download })
      },
    }),
  } as unknown as Document

  globalThis.URL.createObjectURL = () => {
    const url = `blob:mock/${createdUrls.length}`
    createdUrls.push(url)
    return url
  }
  globalThis.URL.revokeObjectURL = () => {}
}

beforeEach(() => {
  calls = []
  clicked = []
  createdUrls = []
  respond = () => new Response('a,b\n1,2\n', { status: 200 })
  stubBrowser()
})

afterEach(() => {
  setToken(null)
})

describe('request headers', () => {
  it('claims a JSON body only when there is one', async () => {
    setToken('token-123')

    // A mutation with no payload. Sending content-type here made Fastify answer
    // "body cannot be empty", which broke delete, duplicate, pause/finish and
    // every other bodyless call.
    respond = () => new Response('{}', { status: 200 })
    await apiFetch('/api/tests/a/duplicate', { method: 'POST' })
    assert.equal(calls.length, 1)
    assert.equal(headerOf(calls[0], 'content-type'), null)
    assert.equal(headerOf(calls[0], 'authorization'), 'Bearer token-123')

    await apiFetch('/api/tests', { method: 'POST', body: JSON.stringify({ title: 'x' }) })
    assert.equal(headerOf(calls[1], 'content-type'), 'application/json')

    await apiFetch('/api/tests')
    assert.equal(headerOf(calls[2], 'content-type'), null)
  })

  it('leaves a caller-provided content-type alone', async () => {
    respond = () => new Response('{}', { status: 200 })
    await apiFetch('/api/courses/a/materials?name=notes.pdf', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: new Uint8Array([1, 2, 3]),
    })
    assert.equal(headerOf(calls[0], 'content-type'), 'application/octet-stream')
  })
})

describe('downloadFile', () => {
  it('sends the bearer token and saves the body under the given filename', async () => {
    setToken('token-123')

    await downloadFile('/api/sessions/abc/results.csv', 'session-ABC123.csv')

    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.url, '/api/sessions/abc/results.csv')
    assert.equal(headerOf(calls[0], 'authorization'), 'Bearer token-123')
    assert.deepEqual(clicked, [{ href: createdUrls[0] ?? '', download: 'session-ABC123.csv' }])
  })

  it('works without a stored token', async () => {
    await downloadFile('/api/tests/a/export', 'a.json')

    assert.equal(headerOf(calls[0], 'authorization'), null)
    assert.equal(clicked.length, 1)
  })

  it('never writes an error body to disk', async () => {
    respond = () =>
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'nope' } }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })

    await assert.rejects(
      downloadFile('/api/sessions/abc/results.csv', 'x.csv'),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 403 &&
        error.code === 'FORBIDDEN' &&
        error.message === 'nope',
    )
    assert.equal(clicked.length, 0)
  })

  it('reports an unreachable server as a network error', async () => {
    respond = () => {
      throw new TypeError('fetch failed')
    }

    const error = await downloadFile('/api/sessions/abc/results.csv', 'x.csv').catch(
      (thrown: unknown) => thrown,
    )
    assert.ok(error instanceof ApiError)
    assert.equal(error.isNetwork, true)
  })
})