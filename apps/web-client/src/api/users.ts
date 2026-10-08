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

/**
 * Students waiting for approval. Admin or teacher: the full roster stays
 * admin-only, but a student who registered without a class key has to be let in
 * by somebody, and on a machine with no admin that somebody is the teacher.
 */
export async function listPendingStudents(): Promise<PublicUser[]> {
  const result = await apiFetch<{ users: PublicUser[] }>('/api/users/pending')
  return result.users
}

/** Admin only: creates a teacher account (approved immediately). */
export async function createUser(input: {
  username: string
  password: string
  fullName: string
}): Promise<PublicUser> {
  const result = await apiFetch<{ user: PublicUser }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.user
}

/** Admin only. */
export async function setUserStatus(id: string, status: UserStatus): Promise<PublicUser> {
  const result = await apiFetch<{ user: PublicUser }>(`/api/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return result.user
}