import { apiFetch } from './client'
import type { ParticipationEntry, SystemStats } from './types'

/** Admin only: flat course → student participation list. */
export async function listParticipants(): Promise<ParticipationEntry[]> {
  const result = await apiFetch<{ participants: ParticipationEntry[] }>(
    '/api/admin/participants',
  )
  return result.participants
}

/** Admin only: aggregated DB counts and server health. */
export async function getSystemStats(): Promise<SystemStats> {
  const result = await apiFetch<{ stats: SystemStats }>('/api/admin/stats')
  return result.stats
}