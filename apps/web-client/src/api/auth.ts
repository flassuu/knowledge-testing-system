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

export async function register(payload: RegisterPayload): Promise<PublicUser> {
  const result = await apiFetch<{ user: PublicUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return result.user
}

export async function fetchMe(): Promise<PublicUser> {
  const result = await apiFetch<{ user: PublicUser }>('/api/auth/me')
  return result.user
}