import { apiFetch } from './client'
import type { LogEntry } from './types'

/**
 * Admin only: the server's log buffer - the same lines the terminal console shows.
 *
 * `since` makes a reconnect exact: the client sends the sequence number of the
 * last line it holds and gets everything after it, so a client that was closed
 * for a minute comes back with that minute - not with a gap, and not with the
 * whole buffer a second time.
 */
export async function listLogs(since?: number): Promise<LogEntry[]> {
  const query = since === undefined ? '' : `?since=${since}`
  const result = await apiFetch<{ entries: LogEntry[]; lastSeq: number }>(`/api/logs${query}`)
  return result.entries
}
