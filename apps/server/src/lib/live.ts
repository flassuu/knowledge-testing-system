import type { LiveSessionStatus, ParticipantEntry } from './sessions'
import type { UserRole } from './users'

/**
 * The slice of a WebSocket the hub needs. `ws` arrives with @fastify/websocket,
 * so the shape is declared here instead of importing a transitive dependency.
 */
export interface LiveSocket {
  readonly readyState: number
  send(data: string): void
  on(event: 'close' | 'error', listener: () => void): void
}

/** One connected client watching a session. */
export interface LiveClient {
  socket: LiveSocket
  userId: string
  role: UserRole
  isTeacher: boolean
}

export type LiveMessage =
  | { type: 'participants'; participants: ParticipantEntry[] }
  | { type: 'status'; status: LiveSessionStatus; serverNow: string }
  | { type: 'error'; code: string; message: string }

const rooms = new Map<string, Set<LiveClient>>()

function send(client: LiveClient, message: LiveMessage): void {
  if (client.socket.readyState !== 1) return
  client.socket.send(JSON.stringify(message))
}

export function joinRoom(sessionId: string, client: LiveClient): void {
  const room = rooms.get(sessionId) ?? new Set<LiveClient>()
  room.add(client)
  rooms.set(sessionId, room)
}

export function leaveRoom(sessionId: string, client: LiveClient): void {
  const room = rooms.get(sessionId)
  if (!room) return
  room.delete(client)
  if (room.size === 0) rooms.delete(sessionId)
}

/** Sends to every client in the room, or only to the teachers when asked. */
export function broadcast(sessionId: string, message: LiveMessage, teachersOnly = false): void {
  const room = rooms.get(sessionId)
  if (!room) return
  for (const client of room) {
    if (teachersOnly && !client.isTeacher) continue
    send(client, message)
  }
}

export function sendTo(client: LiveClient, message: LiveMessage): void {
  send(client, message)
}

export function roomSize(sessionId: string): number {
  return rooms.get(sessionId)?.size ?? 0
}
