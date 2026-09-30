import { onBeforeUnmount, ref, type Ref } from 'vue'
import { getToken } from '../api/client'
import { getParticipants, type LiveSessionStatus, type ParticipantEntry } from '../api/sessions'

/** How often the board is re-read while the socket is down, and as a safety net. */
const FALLBACK_POLL_MS = 5000
const SAFETY_POLL_MS = 20_000
const MAX_BACKOFF_MS = 10_000

export interface SessionChannel {
  participants: Ref<ParticipantEntry[]>
  status: Ref<LiveSessionStatus>
  connected: Ref<boolean>
  connect: (sessionId: string) => void
  disconnect: () => void
}

function socketUrl(sessionId: string): string | null {
  const token = getToken()
  if (!token) return null
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws/sessions/${sessionId}?token=${encodeURIComponent(token)}`
}

/**
 * Live board feed for one session. The server pushes status changes and the
 * participant list over a WebSocket; if the socket cannot be opened (blocked,
 * proxy without upgrade) the channel silently falls back to polling so the
 * board keeps working, and reconnects with a backoff once the network is back.
 */
export function useSessionChannel(): SessionChannel {
  const participants = ref<ParticipantEntry[]>([])
  const status = ref<LiveSessionStatus>('active')
  const connected = ref(false)

  let socket: WebSocket | null = null
  let sessionId = ''
  let retryDelay = 1000
  let retryTimer: number | undefined
  let fallbackTimer: number | undefined
  let safetyTimer: number | undefined
  let disposed = false

  function clearTimers(): void {
    for (const name of ['retryTimer', 'fallbackTimer', 'safetyTimer'] as const) {
      if (name === 'retryTimer' && retryTimer !== undefined) window.clearTimeout(retryTimer)
      if (name === 'fallbackTimer' && fallbackTimer !== undefined) window.clearInterval(fallbackTimer)
      if (name === 'safetyTimer' && safetyTimer !== undefined) window.clearInterval(safetyTimer)
    }
    retryTimer = undefined
    fallbackTimer = undefined
    safetyTimer = undefined
  }

  async function refresh(): Promise<void> {
    if (!sessionId) return
    try {
      const board = await getParticipants(sessionId)
      participants.value = board.participants
      status.value = board.session.status
    } catch {
      // A failed read keeps the last known board; the next tick retries.
    }
  }

  function open(): void {
    if (disposed || !sessionId) return
    const url = socketUrl(sessionId)
    if (!url) return

    let socketRef: WebSocket
    try {
      socketRef = new WebSocket(url)
    } catch {
      scheduleRetry()
      return
    }
    socket = socketRef

    socketRef.onopen = () => {
      connected.value = true
      retryDelay = 1000
      stopFallback()
      void refresh()
    }
    socketRef.onmessage = (event: MessageEvent<string>) => {
      let message: unknown
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      if (typeof message !== 'object' || message === null) return
      const payload = message as { type?: string; participants?: ParticipantEntry[]; status?: LiveSessionStatus }
      if (payload.type === 'participants' && Array.isArray(payload.participants)) {
        participants.value = payload.participants
      } else if (payload.type === 'status' && payload.status) {
        status.value = payload.status
      }
    }
    socketRef.onclose = () => {
      connected.value = false
      if (socketRef !== socket) return
      socket = null
      scheduleRetry()
    }
    socketRef.onerror = () => {
      connected.value = false
    }
  }

  function scheduleRetry(): void {
    if (disposed || !sessionId) return
    startFallback()
    if (retryTimer !== undefined) window.clearTimeout(retryTimer)
    retryTimer = window.setTimeout(() => {
      retryTimer = undefined
      open()
    }, retryDelay)
    retryDelay = Math.min(retryDelay * 2, MAX_BACKOFF_MS)
  }

  function startFallback(): void {
    if (fallbackTimer !== undefined) return
    fallbackTimer = window.setInterval(() => void refresh(), FALLBACK_POLL_MS)
  }

  function stopFallback(): void {
    if (fallbackTimer !== undefined) {
      window.clearInterval(fallbackTimer)
      fallbackTimer = undefined
    }
  }

  function connect(id: string): void {
    disconnect()
    disposed = false
    sessionId = id
    if (!id) return
    participants.value = []
    open()
    // Even on a healthy socket, a slow refresh catches anything a dropped
    // message would have hidden.
    if (safetyTimer !== undefined) window.clearInterval(safetyTimer)
    safetyTimer = window.setInterval(() => void refresh(), SAFETY_POLL_MS)
  }

  function disconnect(): void {
    disposed = true
    sessionId = ''
    connected.value = false
    participants.value = []
    clearTimers()
    if (socket) {
      const current = socket
      socket = null
      current.onclose = null
      current.onerror = null
      current.close()
    }
  }

  onBeforeUnmount(disconnect)

  return { participants, status, connected, connect, disconnect }
}
