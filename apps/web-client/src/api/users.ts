import { apiFetch } from './client'
import type { PublicUser, UserStatus } from './types'

export interface UserListParams {
  role?: 'admin' | 'teacher' | 'student'
  status?: UserStatus
  q?: string
}

function queryString(params: UserListParams): string {
  const search = new URLSearchParams()
  if (params.role) search.set('role', params.role)
  if (params.status) search.set('status', params.status)
  if (params.q) search.set('q', params.q)
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/** Admin only. */
export async function listUsers(params: UserListParams = {}): Promise<PublicUser[]> {
  const result = await apiFetch<{ users: PublicUser[] }>(`/api/users${queryString(params)}`)
  return result.users
}

/** Admin only. */
export async function setUserStatus(id: string, status: UserStatus): Promise<PublicUser> {
  const result = await apiFetch<{ user: PublicUser }>(`/api/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return result.user
}