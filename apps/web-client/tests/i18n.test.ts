import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
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

describe('i18n keys used in the app', () => {
  const known = new Set(leafKeys(en))

  it('every literal t() call in the sources has a message', () => {
    // A missing key does not fail a build: vue-i18n falls back to printing the
    // key, so the user sees "teacher.tests.passingPercent" where a label should
    // be. That happened, so the sources are walked instead of trusted.
    const problems: string[] = []
    for (const { file, used } of literalKeys()) {
      for (const key of used) {
        if (!known.has(key)) problems.push(`${file}: t('${key}')`)
      }
    }
    assert.deepEqual(problems, [])
  })
})

/** Literal t('…') calls in the app sources, with the file they came from. */
function literalKeys(): Array<{ file: string; used: string[] }> {
  const root = fileURLToPath(new URL('../src/', import.meta.url))
  return sourceFiles(root).map((file) => ({
    file: file.slice(root.length), // root уже заканчивается разделителем
    used: [...readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)].map(
      (match) => match[1] ?? '',
    ),
  }))
}

/** A hand-rolled walk: node:test has no glob, and a dependency is not worth it. */
function sourceFiles(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...sourceFiles(child))
    else if (/\.(vue|ts)$/.test(entry.name)) found.push(child)
  }
  return found
}
