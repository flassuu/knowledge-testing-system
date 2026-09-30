import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createI18n } from 'vue-i18n'
import en from '../src/i18n/locales/en.ts'
import uk from '../src/i18n/locales/uk.ts'

const locales = { en, uk } as const

/** Every dot-joined path of a message tree down to its string leaves. */
function leafKeys(messages: unknown, prefix = ''): string[] {
  if (typeof messages === 'string') return [prefix]
  if (typeof messages !== 'object' || messages === null) return []
  return Object.entries(messages).flatMap(([key, value]) =>
    leafKeys(value, prefix ? `${prefix}.${key}` : key),
  )
}

function read(messages: unknown, key: string): string {
  const value = key.split('.').reduce<unknown>(
    (node, part) => (node as Record<string, unknown>)[part],
    messages,
  )
  assert.equal(typeof value, 'string', `${key} must be a string leaf`)
  return value as string
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{\s*([\w.]+)\s*\}/g)].map((match) => match[1])
}

describe('i18n message catalogs', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: locales as never,
  })

  for (const [name, messages] of Object.entries(locales)) {
    it(`${name}: every message compiles and resolves`, () => {
      // vue-i18n compiles lazily, so a malformed message only throws on render.
      for (const key of leafKeys(messages)) {
        assert.doesNotThrow(() => i18n.global.t(key), `${name}: ${key}`)
        assert.notEqual(i18n.global.t(key), key, `${name}: ${key} resolves`)
      }
    })

    it(`${name}: no plural or linked syntax sneaks in`, () => {
      // `@{x}` and `|` are intlify message syntax, not literal text.
      for (const key of leafKeys(messages)) {
        assert.doesNotMatch(read(messages, key), /[@|]/, `${name}: ${key}`)
      }
    })
  }

  it('uk mirrors the en key structure exactly', () => {
    assert.deepEqual(leafKeys(uk).sort(), leafKeys(en).sort())
  })

  it('interpolated placeholders match across locales', () => {
    for (const key of leafKeys(en)) {
      assert.deepEqual(
        placeholders(read(uk, key)).sort(),
        placeholders(read(en, key)).sort(),
        key,
      )
    }
  })
})
