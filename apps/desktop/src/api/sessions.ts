import { apiFetch } from './client'

export type LiveSessionStatus = 'active' | 'paused' | 'finished'
export type ParticipationStatus = 'joined' | 'submitted' | 'auto_submitted'

/** Flat answer payload; one shape per question type, mirroring the question payload. */
export interface AnswerInput {
  key?: string
  keys?: string[]
  boolean?: boolean
  text?: string
  pairs?: Array<{ left: string; right: string }>
}

export interface StudentQuestion {
  id: string
  type: string
  body: string
  points: number
  position: number
  payload: Record<string, unknown>
}

export interface GradedQuestion extends StudentQuestion {
  isCorrect: boolean
  pointsAwarded: number
}

export interface Participation {
  id: string
  sessionId: string
  status: ParticipationStatus
  questionOrder: string[]
  score: number | null
  maxScore: number | null
  percent: number | null
  passed: boolean | null
  joinedAt: string
  submittedAt: string | null
}

export interface LiveSession {
  id: string
  testId: string
  ownerId: string
  joinCode: string
  status: LiveSessionStatus
  timeLimitSec: number | null
  passingPercent: number | null
  startedAt: string
  finishedAt: string | null
  test: { id: string; title: string; questionCount: number }
}

export interface SessionState {
  participation: Participation
  session: {
    id: string
    status: LiveSessionStatus
    timeLimitSec: number | null
    passingPercent: number | null
    startedAt: string
    serverNow: string
  }
  questions: StudentQuestion[]
}

export interface SubmitResult {
  participation: Participation
  result: { score: number; maxScore: number; percent: number; passed: boolean | null }
}

export interface SessionResultBody {
  participation: Participation
  session: { id: string; status: LiveSessionStatus }
  test: { id: string; title: string; passingPercent: number | null } | null
  questions: GradedQuestion[]
}

export interface ParticipantEntry {
  userId: string
  username: string
  fullName: string
  status: ParticipationStatus
  score: number | null
  percent: number | null
  passed: boolean | null
  joinedAt: string
  submittedAt: string | null
}

/** A session with the counts the board needs. */
export interface SessionSummary extends LiveSession {
  title: string
  joinedCount: number
  submittedCount: number
}

/** Teacher only: their own sessions (an admin sees every teacher's). */
export async function listSessions(): Promise<SessionSummary[]> {
  const result = await apiFetch<{ sessions: SessionSummary[] }>('/api/sessions')
  return result.sessions
}

/** Teacher only: starts a run of one of their tests. */
export async function startSession(testId: string): Promise<LiveSession> {
  const result = await apiFetch<{ session: LiveSession }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ testId }),
  })
  return result.session
}

/** Teacher only. */
export async function getParticipants(sessionId: string): Promise<{
  session: LiveSession
  participants: ParticipantEntry[]
}> {
  return apiFetch(`/api/sessions/${sessionId}/participants`)
}

/** Teacher only: pauses, resumes or finishes. */
export async function setSessionStatus(
  sessionId: string,
  status: LiveSessionStatus,
): Promise<LiveSession> {
  const result = await apiFetch<{ session: LiveSession }>(`/api/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return result.session
}

/** Student only. The code is normalised server-side, so case and spaces are fine. */
export async function joinSession(code: string): Promise<SessionState> {
  return apiFetch<SessionState>('/api/sessions/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

/** Student only: the paper and the clock of the session in progress, if any. */
export async function getCurrentSession(): Promise<SessionState> {
  return apiFetch<SessionState>('/api/sessions/current')
}

export async function submitSession(
  sessionId: string,
  answers: Record<string, AnswerInput>,
): Promise<SubmitResult> {
  return apiFetch<SubmitResult>(`/api/sessions/${sessionId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  })
}

export async function getSessionResult(sessionId: string): Promise<SessionResultBody> {
  return apiFetch<SessionResultBody>(`/api/sessions/${sessionId}/result`)
}
