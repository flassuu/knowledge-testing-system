import { apiFetch } from './client'
import type { ServerSettings } from './types'

/** The address students open, plus what this machine answers on. Any role. */
export async function getSettings(): Promise<ServerSettings> {
  return apiFetch<ServerSettings>('/api/settings')
}

/** Admin only. `null` clears the address, and clients fall back to their origin. */
export async function updateSettings(
  publicBaseUrl: string | null,
): Promise<ServerSettings> {
  return apiFetch<ServerSettings>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify({ publicBaseUrl }),
  })
}
