import { reactive } from 'vue'
import { getSettings } from '../api/settings'
import type { ServerSettings } from '../api/types'

interface SettingsState {
  settings: ServerSettings | null
  loaded: boolean
}

/**
 * The server's public address, fetched once per session.
 *
 * Only two places need it: the teacher's Live tab, to build a link a phone can
 * open, and the admin's System tab, to change it. Both are signed in, both are
 * long-lived views, and a cache of one small object is simpler than a store and
 * keeps a failed fetch from turning into a spinner that never ends.
 */
const state = reactive<SettingsState>({ settings: null, loaded: false })

export function getSettingsState(): SettingsState {
  return state
}

export async function loadSettings(): Promise<void> {
  try {
    state.settings = await getSettings()
  } catch {
    // Keep the last known value: an offline blip must not make the teacher's
    // QR flip back to an unreachable localhost address.
    if (!state.settings) state.settings = { publicBaseUrl: null, suggestions: [] }
  } finally {
    state.loaded = true
  }
}

/** Applied after an admin saves, so the rest of the app sees it immediately. */
export function applySettings(settings: ServerSettings): void {
  state.settings = settings
  state.loaded = true
}

/** The address to put in a link: what the admin configured, else our own origin. */
export function effectiveBaseUrl(): string {
  return state.settings?.publicBaseUrl ?? window.location.origin
}