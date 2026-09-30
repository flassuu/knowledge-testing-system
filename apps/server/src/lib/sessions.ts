import { randomInt, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { nowIso } from './db'
import type { QuestionType } from './tests'

export type LiveSessionStatus = 'active' | 'paused' | 'finished'
export type ParticipationStatus = 'joined' | 'submitted' | 'auto_submitted'

/** Ambiguous glyphs (0/O, 1/I) stay out so codes can be read aloud in class. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export interface LiveSessionRow {
  id: string
  test_id: string
  owner_id: string
  join_code: string
  status: LiveSessionStatus
  time_limit_sec: number | null
  passing_percent: number | null
  created_at: string
  started_at: string
  finished_at: string | null
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
}

export interface ParticipationRow {
  id: string
  session_id: string
  user_id: string
  status: ParticipationStatus
  question_order: string
  score: number | null
  max_score: number | null
  percent: number | null
  passed: number | null
  joined_at: string
  submitted_at: string | null
}

export interface Participation {
  id: string
  sessionId: string
  userId: string
  status: ParticipationStatus
  questionOrder: string[]
  score: number | null
  maxScore: number | null
  percent: number | null
  passed: boolean | null
  joinedAt: string
  submittedAt: string | null
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

/** A question as the student sees it: no correct answers, no other question's payload. */
export interface StudentQuestion {
  id: string
  type: QuestionType
  body: string
  points: number
  position: number
  payload: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Strips the answer key. Choices keep their keys and text (the client submits
 * keys), matching keeps both sides minus the mapping is not stored anyway, and
 * short answers lose the accepted list.
 */
export function toStudentPayload(type: QuestionType, payload: Record<string, unknown>): Record<string, unknown> {
  if (type === 'single_choice' || type === 'multiple_choice') {
    const options = Array.isArray(payload.options) ? payload.options : []
    return {
      options: options.map((option) =>
        isRecord(option) ? { key: option.key, text: option.text } : option,
      ),
    }
  }
  if (type === 'true_false') return {}
  if (type === 'short_answer') return {}
  if (type === 'matching') {
    const pairs = Array.isArray(payload.pairs) ? payload.pairs : []
    return {
      pairs: pairs.map((pair) =>
        isRecord(pair) ? { left: pair.left, right: pair.right } : pair,
      ),
    }
  }
  return {}
}

function randomCode(): string {
  let code = ''
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]
  }
  return code
}

export function generateJoinCode(db: DatabaseSync): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = randomCode()
    const taken = db.prepare('SELECT 1 FROM live_sessions WHERE join_code = ?').get(code)
    if (!taken) return code
  }
  throw new Error('could not allocate a unique join code')
}

/** Deterministic per-student order: stored on join so a reload never reshuffles. */
export function shuffledQuestionIds(
  questionIds: string[],
  seed: string,
): string[] {
  // FNV-1a keeps the shuffle reproducible without pulling in a dependency.
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  const next = (value: number): number => {
    // xorshift32 keeps the sequence identical across runs and platforms.
    let x = value || 0x9e3779b9
    x ^= x << 13
    x >>>= 0
    x ^= x >> 17
    x ^= x << 5
    x >>>= 0
    return x
  }

  const ids = [...questionIds]
  let state = hash
  for (let index = ids.length - 1; index > 0; index -= 1) {
    state = next(state)
    const swap = state % (index + 1)
    const tmp = ids[index] as string
    ids[index] = ids[swap] as string
    ids[swap] = tmp
  }
  return ids
}

export function toSession(row: LiveSessionRow): LiveSession {
  return {
    id: row.id,
    testId: row.test_id,
    ownerId: row.owner_id,
    joinCode: row.join_code,
    status: row.status,
    timeLimitSec: row.time_limit_sec,
    passingPercent: row.passing_percent,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

export function toParticipation(row: ParticipationRow): Participation {
  let questionOrder: string[] = []
  try {
    const parsed: unknown = JSON.parse(row.question_order)
    if (Array.isArray(parsed)) {
      questionOrder = parsed.filter((entry): entry is string => typeof entry === 'string')
    }
  } catch {
    questionOrder = []
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    status: row.status,
    questionOrder,
    score: row.score,
    maxScore: row.max_score,
    percent: row.percent,
    passed: row.passed === null ? null : row.passed === 1,
    joinedAt: row.joined_at,
    submittedAt: row.submitted_at,
  }
}

export function findSessionRow(db: DatabaseSync, id: string): LiveSessionRow | null {
  return (
    (db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(id) as LiveSessionRow | undefined) ?? null
  )
}

export function findSessionByCode(db: DatabaseSync, code: string): LiveSessionRow | null {
  return (
    (db
      .prepare('SELECT * FROM live_sessions WHERE join_code = ?')
      .get(code.trim().toUpperCase()) as LiveSessionRow | undefined) ?? null
  )
}

export function createSession(
  db: DatabaseSync,
  input: { testId: string; ownerId: string; timeLimitSec: number | null; passingPercent: number | null },
): LiveSession {
  const id = randomUUID()
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO live_sessions
       (id, test_id, owner_id, join_code, status, time_limit_sec, passing_percent, created_at, started_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
  ).run(
    id,
    input.testId,
    input.ownerId,
    generateJoinCode(db),
    input.timeLimitSec,
    input.passingPercent,
    timestamp,
    timestamp,
  )
  const row = findSessionRow(db, id)
  if (!row) throw new Error('session insert failed')
  return toSession(row)
}

export function setSessionStatus(
  db: DatabaseSync,
  id: string,
  status: LiveSessionStatus,
): LiveSession | null {
  const finishedAt = status === 'finished' ? nowIso() : null
  db.prepare(
    'UPDATE live_sessions SET status = ?, finished_at = COALESCE(?, finished_at) WHERE id = ?',
  ).run(status, finishedAt, id)
  const row = findSessionRow(db, id)
  return row ? toSession(row) : null
}

export function findParticipation(
  db: DatabaseSync,
  sessionId: string,
  userId: string,
): ParticipationRow | null {
  return (
    (db
      .prepare('SELECT * FROM participations WHERE session_id = ? AND user_id = ?')
      .get(sessionId, userId) as ParticipationRow | undefined) ?? null
  )
}

export function joinSession(
  db: DatabaseSync,
  sessionId: string,
  userId: string,
  questionIds: string[],
): ParticipationRow {
  const existing = findParticipation(db, sessionId, userId)
  if (existing) return existing

  const order = shuffledQuestionIds(questionIds, `${sessionId}:${userId}`)
  const id = randomUUID()
  db.prepare(
    `INSERT INTO participations (id, session_id, user_id, status, question_order, joined_at)
     VALUES (?, ?, ?, 'joined', ?, ?)`,
  ).run(id, sessionId, userId, JSON.stringify(order), nowIso())
  const row = findParticipation(db, sessionId, userId)
  if (!row) throw new Error('participation insert failed')
  return row
}

export function listParticipations(db: DatabaseSync, sessionId: string): ParticipationRow[] {
  return db
    .prepare('SELECT * FROM participations WHERE session_id = ? ORDER BY joined_at ASC')
    .all(sessionId) as unknown as ParticipationRow[]
}

export function listParticipantEntries(
  db: DatabaseSync,
  sessionId: string,
): ParticipantEntry[] {
  const rows = db
    .prepare(
      `SELECT p.user_id, u.username, u.full_name, p.status, p.score, p.percent, p.passed,
              p.joined_at, p.submitted_at
         FROM participations p
         JOIN users u ON u.id = p.user_id
        WHERE p.session_id = ?
        ORDER BY p.joined_at ASC`,
    )
    .all(sessionId) as unknown as Array<{
    user_id: string
    username: string
    full_name: string
    status: ParticipationStatus
    score: number | null
    percent: number | null
    passed: number | null
    joined_at: string
    submitted_at: string | null
  }>
  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    status: row.status,
    score: row.score,
    percent: row.percent,
    passed: row.passed === null ? null : row.passed === 1,
    joinedAt: row.joined_at,
    submittedAt: row.submitted_at,
  }))
}

export function saveSubmission(
  db: DatabaseSync,
  participationId: string,
  status: ParticipationStatus,
  results: Array<{ questionId: string; isCorrect: boolean; points: number }>,
  answers: Record<string, unknown>,
  summary: { score: number; maxScore: number; percent: number; passed: boolean | null },
): ParticipationRow | null {
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM participation_answers WHERE participation_id = ?').run(participationId)
    const insert = db.prepare(
      `INSERT INTO participation_answers
         (id, participation_id, question_id, payload, is_correct, points_awarded)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const result of results) {
      insert.run(
        randomUUID(),
        participationId,
        result.questionId,
        JSON.stringify(answers[result.questionId] ?? null),
        result.isCorrect ? 1 : 0,
        result.points,
      )
    }
    db.prepare(
      `UPDATE participations
          SET status = ?, score = ?, max_score = ?, percent = ?, passed = ?, submitted_at = ?
        WHERE id = ?`,
    ).run(
      status,
      summary.score,
      summary.maxScore,
      summary.percent,
      summary.passed === null ? null : summary.passed ? 1 : 0,
      nowIso(),
      participationId,
    )
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return (
    (db.prepare('SELECT * FROM participations WHERE id = ?').get(participationId) as
      | ParticipationRow
      | undefined) ?? null
  )
}

/** Unanswered participations of a session, for the timeout sweep. */
export function listOpenParticipations(db: DatabaseSync, sessionId: string): ParticipationRow[] {
  return db
    .prepare("SELECT * FROM participations WHERE session_id = ? AND status = 'joined'")
    .all(sessionId) as unknown as ParticipationRow[]
}

export function isSessionOver(
  session: LiveSession,
  now: number = Date.now(),
): boolean {
  if (session.status === 'finished') return true
  if (session.timeLimitSec === null) return false
  return now >= Date.parse(session.startedAt) + session.timeLimitSec * 1000
}
