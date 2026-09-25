const TOKEN_KEY = 'auth.token'

const NETWORK_ERROR_CODE = 'NETWORK'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  get isNetwork(): boolean {
    return this.code === NETWORK_ERROR_CODE
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export interface ErrorEnvelope {
  error?: { code?: string; message?: string }
}

/**
 * Thin fetch wrapper: attaches the bearer token, parses the server's uniform
 * error envelope, and maps transport failures to a `NETWORK` ApiError so the
 * UI can distinguish "server is offline" from real API errors.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.method && init.method !== 'GET' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, NETWORK_ERROR_CODE, 'server unreachable')
  }

  if (!res.ok) {
    let code = 'ERROR'
    let message = res.statusText
    try {
      const body = (await res.json()) as ErrorEnvelope
      code = body.error?.code ?? code
      message = body.error?.message ?? message
    } catch {
      // Non-JSON error body; keep defaults.
    }
    throw new ApiError(res.status, code, message)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}