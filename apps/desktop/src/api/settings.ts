import { apiFetch } from './client'
import type { ServerSettings } from './types'

/** The address students open, plus what this machine answers on. Any role. */
export async function getSettings(): Promise<ServerSettings> {
  return apiFetch<ServerSettings>('/api/settings')
}

/**
 * Admin or teacher. `null` clears the address, and clients fall back to their
 * own origin - which no phone can open, so clearing it is rarely what you want.
 */
export async function updateSettings(
  publicBaseUrl: string | null,
): Promise<ServerSettings> {
  return apiFetch<ServerSettings>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify({ publicBaseUrl }),
  })
}
