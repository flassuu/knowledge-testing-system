import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { ApiError, downloadFile, setToken } from '../src/api/client.ts'

interface FetchCall {
  url: string
  init: RequestInit
}

interface ClickedLink {
  href: string
  download: string
}

let calls: FetchCall[] = []
let clicked: ClickedLink[] = []
let createdUrls: string[] = []
let respond: () => Response

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

describe('downloadFile', () => {
  it('sends the bearer token and saves the body under the given filename', async () => {
    setToken('token-123')

    await downloadFile('/api/sessions/abc/results.csv', 'session-ABC123.csv')

    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.url, '/api/sessions/abc/results.csv')
    const headers = new Headers(calls[0]?.init.headers)
    assert.equal(headers.get('authorization'), 'Bearer token-123')
    assert.deepEqual(clicked, [
      { href: createdUrls[0] ?? '', download: 'session-ABC123.csv' },
    ])
  })

  it('works without a stored token', async () => {
    await downloadFile('/api/sessions/abc/results.csv', 'session-ABC123.csv')

    const headers = new Headers(calls[0]?.init.headers)
    assert.equal(headers.get('authorization'), null)
    assert.equal(clicked.length, 1)
  })

  it('never downloads an error body', async () => {
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