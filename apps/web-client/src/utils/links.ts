/**
 * The addresses a stranger has to be able to open, and whether they can.
 *
 * Three things come out of here: the link that joins a running test, the link
 * that registers with a class, and the check that says whether a phone could
 * open either. All pure, all taking the origin as an argument rather than
 * reading `window`: these are the strings a phone acts on with no way to report
 * back, so their rules are worth testing on their own.
 */

/** Builds the registration link: the app opens on the sign-up form with the key
 *  already filled in, so a student who scans the code has nothing to type. */
export function registrationLink(base: string, key: string): string {
  const origin = httpOrigin(base)
  if (!origin || !key) return ''
  return `${origin}/?class=${encodeURIComponent(key.trim().toUpperCase())}`
}

/** Builds the link a student opens, with the join code pre-filled.
 *
 * `base` is an origin such as `http://192.168.1.65:3300`. An empty or absent
 * base falls back to the caller's own origin, which is correct for a browser on
 * the teacher's machine and wrong for every phone - so the caller should pass
 * the server's `publicBaseUrl` when it has one, and say so when it does not. */
export function joinLink(base: string, code: string): string {
  const origin = httpOrigin(base)
  if (!origin || !code) return ''
  return `${origin}/?join=${encodeURIComponent(code.trim().toUpperCase())}`
}

/**
 * The origin to build a link from, or null when there is none worth building.
 *
 * A non-http scheme has no origin at all - `new URL('tauri://localhost').origin`
 * is the string `"null"`, which would put `null/?join=…` into a QR code. So the
 * scheme is checked, and a link is only ever built from something a browser can
 * actually open.
 *
 * Note the difference from isReachableFromPhone(): `localhost` is a legal origin
 * here. It produces a link that will not work on a phone, and the caller is
 * expected to say so rather than to refuse - the code can still be typed by
 * hand, which is the fallback that works mid-lesson.
 */
function httpOrigin(base: string): string | null {
  let url: URL
  try {
    url = new URL(base)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return url.origin
}

/**
 * True when a phone on the same network cannot open this address.
 *
 * The two ways a teacher's own machine can be its own origin are the whole
 * reason this exists: `localhost` in a browser and `tauri://localhost` in the
 * desktop app. Neither is reachable from a desk across the room, and a QR code
 * pointing at either scans perfectly and then fails, which reads as a broken app.
 */
export function isReachableFromPhone(origin: string): boolean {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === '' || host === '0.0.0.0' || host === '::') return false
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  // The whole 127.0.0.0/8 range is loopback, not just 127.0.0.1.
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return false
  return true
}