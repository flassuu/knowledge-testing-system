import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isReachableFromPhone, joinLink } from '../src/utils/joinLink.ts'

describe('join link', () => {
  it('puts the join code in the query of the configured address', () => {
    assert.equal(
      joinLink('http://192.168.1.65:3300', 'ABC123'),
      'http://192.168.1.65:3300/?join=ABC123',
    )
  })

  it('prefers the configured address over the caller origin', () => {
    // The whole point of the setting: the teacher's window may be served from
    // tauri://localhost or 127.0.0.1, and neither belongs in a QR code.
    const link = joinLink('http://10.0.0.7:3300', 'ABC123')
    assert.ok(link.startsWith('http://10.0.0.7:3300/'))
    assert.ok(!link.includes('localhost'))
    assert.ok(!link.includes('127.0.0.1'))
  })

  it('accepts an address with a trailing slash without doubling it up', () => {
    assert.equal(
      joinLink('http://192.168.1.65:3300/', 'ABC123'),
      'http://192.168.1.65:3300/?join=ABC123',
    )
  })

  it('accepts https', () => {
    assert.equal(
      joinLink('https://tests.example.org', 'ABC123'),
      'https://tests.example.org/?join=ABC123',
    )
  })

  it('normalises the code the way the server prints it', () => {
    assert.equal(joinLink('http://10.0.0.7:3300', ' abc123 '), 'http://10.0.0.7:3300/?join=ABC123')
  })

  it('returns nothing without a session code', () => {
    assert.equal(joinLink('http://10.0.0.7:3300', ''), '')
  })

  it('returns nothing for an address that cannot be parsed, so the caller can hide the QR', () => {
    assert.equal(joinLink('not a url', 'ABC123'), '')
    assert.equal(joinLink('', 'ABC123'), '')
  })

  it('keeps a code with characters that would break a query string', () => {
    assert.equal(
      joinLink('http://10.0.0.7:3300', 'A B&C'),
      'http://10.0.0.7:3300/?join=A%20B%26C',
    )
  })
})

describe('whether a phone can reach the address', () => {
  it('accepts a LAN address', () => {
    assert.equal(isReachableFromPhone('http://192.168.1.65:3300'), true)
    assert.equal(isReachableFromPhone('http://10.0.0.7'), true)
    assert.equal(isReachableFromPhone('https://tests.example.org'), true)
  })

  it('rejects loopback in every form a machine can answer on', () => {
    // A browser on the teacher's machine.
    assert.equal(isReachableFromPhone('http://localhost:3300'), false)
    assert.equal(isReachableFromPhone('http://127.0.0.1:3300'), false)
    // The rest of the 127.0.0.0/8 range is loopback as well.
    assert.equal(isReachableFromPhone('http://127.1.2.3:3300'), false)
    // The desktop app's own origin.
    assert.equal(isReachableFromPhone('tauri://localhost'), false)
  })

  it('rejects the unspecified address, which is a bind address, not a place to go', () => {
    assert.equal(isReachableFromPhone('http://0.0.0.0:3300'), false)
    assert.equal(isReachableFromPhone('http://[::]:3300'), false)
  })

  it('rejects anything that is not an http(s) address', () => {
    assert.equal(isReachableFromPhone('file:///srv/app'), false)
    assert.equal(isReachableFromPhone('ftp://192.168.1.65'), false)
    assert.equal(isReachableFromPhone('192.168.1.65:3300'), false)
    assert.equal(isReachableFromPhone(''), false)
  })

  it('is not fooled by a host that merely looks local', () => {
    // A school machine may be reachable by name on the local DNS.
    assert.equal(isReachableFromPhone('http://server.local:3300'), true)
    assert.equal(isReachableFromPhone('http://localhost.example.org:3300'), true)
  })
})