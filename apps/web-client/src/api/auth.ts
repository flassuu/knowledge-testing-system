import { apiFetch, setToken } from './client'
import type { PublicUser } from './types'

export interface LoginResult {
  token: string
  user: PublicUser
}

export interface RegisterPayload {
  username: string
  password: string
  fullName: string
  /** Optional: a key the teacher handed out. It approves the account straight
   *  away; without it the account waits for an admin, as before. */
  classKey?: string
}

/** What a student is told after registering: which class they joined, if any. */
export interface RegisterResult {
  user: PublicUser
  viaClass: { className: string; teacherName: string } | null
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const result = await apiFetch<LoginResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setToken(result.token)
  return result
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<void>('/api/auth/logout', { method: 'POST' })
  } finally {
    setToken(null)
  }
}

export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  return apiFetch<RegisterResult>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchMe(): Promise<PublicUser> {
  const result = await apiFetch<{ user: PublicUser }>('/api/auth/me')
  return result.user
}