import { randomInt } from 'node:crypto'

/**
 * The one alphabet behind every short code a human reads out loud or types from
 * a QR photo: join codes and class keys. Ambiguous glyphs (0/O, 1/I) stay out,
 * because "which one was it?" costs a lesson.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const CODE_LENGTH = 6

/** A cryptographically random code of the shared alphabet. */
export function randomCode(): string {
  let code = ''
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]
  }
  return code
}

/**
 * What a person actually types: upper case, without the spaces and dashes
 * people add when they copy a code across. Returns an empty string for input
 * that is not a code at all, so callers can treat "not typed" and "not valid"
 * the same way instead of guessing.
 */
export function normalizeCode(raw: string | null | undefined): string {
  const cleaned = (raw ?? '').trim().toUpperCase().replace(/[\s-]/g, '')
  if (cleaned.length !== CODE_LENGTH) return ''
  for (const glyph of cleaned) {
    if (!CODE_ALPHABET.includes(glyph)) return ''
  }
  return cleaned
}