/**
 * The address a student has to be able to open, and whether they can.
 *
 * Both helpers are pure and take the origin as an argument instead of reading
 * `window`: the join link is the one string in the product that a phone acts on
 * without any way to report back, so its rules are worth testing on their own.
 */

/** Builds the link a student opens, with the join code pre-filled.
 *
 * `base` is an origin such as `http://192.168.1.65:3300`. An empty or absent
 * base falls back to the caller's own origin, which is correct for a browser on
 * the teacher's machine and wrong for every phone - so the caller should pass
 * the server's `publicBaseUrl` when it has one, and say so when it does not. */
export function joinLink(base: string, code: string): string {
  if (!code) return ''
  let origin: string
  try {
    const url = new URL(base)
    origin = url.origin
  } catch {
    // An unusable base must not produce an unusable link: the code still works
    // when a student types it, and this keeps the copy-link button useful.
    return ''
  }
  return `${origin}/?join=${encodeURIComponent(code.trim().toUpperCase())}`
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