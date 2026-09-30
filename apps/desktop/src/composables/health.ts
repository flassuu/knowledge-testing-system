import { reactive } from 'vue'
import { checkHealth } from '../api/client'

export type ServerHealth = 'checking' | 'online' | 'offline'

interface HealthState {
  status: ServerHealth
  timer: number | null
}

const POLL_INTERVAL_MS = 8000

/**
 * App-wide server heartbeat. One polling loop drives both the inline
 * ServerStatus pill and the offline banner, so every surface shows the same
 * state without duplicating timers.
 */
const state = reactive<HealthState>({ status: 'checking', timer: null })

export function getHealthState(): HealthState {
  return state
}

export async function recheckHealth(): Promise<void> {
  state.status = (await checkHealth()) ? 'online' : 'offline'
}

export function startHealthPolling(): void {
  if (state.timer !== null) return
  void recheckHealth()
  state.timer = window.setInterval(() => void recheckHealth(), POLL_INTERVAL_MS)
}

export function stopHealthPolling(): void {
  if (state.timer === null) return
  window.clearInterval(state.timer)
  state.timer = null
}