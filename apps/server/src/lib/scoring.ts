import type { QuestionType } from './tests'

/**
 * Student answer payload. One flat shape for every question type, mirroring the
 * question payload conventions so the client can build it from the same fields.
 */
export interface AnswerInput {
  /** single_choice: the chosen option key. */
  key?: string
  /** multiple_choice: the chosen option keys. */
  keys?: string[]
  /** true_false: the chosen statement. */
  boolean?: boolean
  /** short_answer: free text. */
  text?: string
  /** matching: the student's pairing. */
  pairs?: Array<{ left: string; right: string }>
}

export interface GradeableQuestion {
  type: QuestionType
  payload: Record<string, unknown>
  points: number
}

export interface GradeResult {
  isCorrect: boolean
  points: number
}

export interface ParticipationSummary {
  score: number
  maxScore: number
  percent: number
  passed: boolean | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

/** Trimmed, whitespace-collapsed, case-insensitive key for free-text comparison. */
function normaliseText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function sameKeySet(left: string[], right: string[]): boolean {
  // Duplicates must not collapse into a match: ['a', 'a', 'c'] is not ['a', 'c'].
  const a = new Set(left.map(normaliseText))
  const b = new Set(right.map(normaliseText))
  if (a.size !== left.length || b.size !== right.length) return false
  if (a.size !== b.size) return false
  for (const entry of a) if (!b.has(entry)) return false
  return true
}

function gradeSingleChoice(payload: Record<string, unknown>, answer: AnswerInput): boolean {
  const correct = payload.correct
  if (typeof correct !== 'string') return false
  const chosen = answer.key
  if (typeof chosen !== 'string' || !chosen.trim()) return false
  return normaliseText(chosen) === normaliseText(correct)
}

function gradeMultipleChoice(payload: Record<string, unknown>, answer: AnswerInput): boolean {
  const correct = payload.correct
  if (!isStringArray(correct)) return false
  if (!isStringArray(answer.keys) || answer.keys.length === 0) return false
  return sameKeySet(correct, answer.keys)
}

function gradeTrueFalse(payload: Record<string, unknown>, answer: AnswerInput): boolean {
  const correct = payload.correct
  if (typeof correct !== 'boolean') return false
  return typeof answer.boolean === 'boolean' && answer.boolean === correct
}

function gradeShortAnswer(payload: Record<string, unknown>, answer: AnswerInput): boolean {
  const accepted = payload.accepted
  if (!isStringArray(accepted) || accepted.length === 0) return false
  if (typeof answer.text !== 'string') return false
  const given = normaliseText(answer.text)
  if (!given) return false
  return accepted.some((candidate) => normaliseText(candidate) === given)
}

function gradeMatching(payload: Record<string, unknown>, answer: AnswerInput): boolean {
  const pairs = payload.pairs
  if (!Array.isArray(pairs) || pairs.length === 0) return false
  const expected = new Map<string, string>()
  for (const pair of pairs) {
    if (!isRecord(pair)) return false
    if (typeof pair.left !== 'string' || typeof pair.right !== 'string') return false
    expected.set(normaliseText(pair.left), normaliseText(pair.right))
  }
  if (!Array.isArray(answer.pairs) || answer.pairs.length !== expected.size) return false

  const given = new Map<string, string>()
  for (const pair of answer.pairs) {
    if (!isRecord(pair)) return false
    if (typeof pair.left !== 'string' || typeof pair.right !== 'string') return false
    const left = normaliseText(pair.left)
    if (given.has(left)) return false
    given.set(left, normaliseText(pair.right))
  }
  for (const [left, right] of expected) {
    if (given.get(left) !== right) return false
  }
  return true
}

/** Grades one answer against its question. Unanswered or malformed input scores zero. */
export function gradeAnswer(question: GradeableQuestion, answer: unknown): GradeResult {
  const safeAnswer: AnswerInput = isRecord(answer) ? (answer as AnswerInput) : {}
  let isCorrect = false
  switch (question.type) {
    case 'single_choice':
      isCorrect = gradeSingleChoice(question.payload, safeAnswer)
      break
    case 'multiple_choice':
      isCorrect = gradeMultipleChoice(question.payload, safeAnswer)
      break
    case 'true_false':
      isCorrect = gradeTrueFalse(question.payload, safeAnswer)
      break
    case 'short_answer':
      isCorrect = gradeShortAnswer(question.payload, safeAnswer)
      break
    case 'matching':
      isCorrect = gradeMatching(question.payload, safeAnswer)
      break
  }
  return { isCorrect, points: isCorrect ? question.points : 0 }
}

export interface ScoredAnswer {
  awarded: number
  max: number
}

/** Rolls per-question grades into the participation totals shown to both sides. */
export function summarise(
  scores: ScoredAnswer[],
  passingPercent: number | null,
): ParticipationSummary {
  const score = scores.reduce((sum, entry) => sum + entry.awarded, 0)
  const maxScore = scores.reduce((sum, entry) => sum + Math.max(0, entry.max), 0)
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const passed = passingPercent === null ? null : percent >= passingPercent
  return { score, maxScore, percent, passed }
}

export interface ScoredQuestion extends GradeableQuestion {
  id: string
}

export interface SubmissionResult {
  results: Array<GradeResult & { questionId: string }>
  summary: ParticipationSummary
}

/**
 * Grades a whole submission in one pass: every question of the session, with
 * missing answers counted as zero, plus the participation totals.
 */
export function scoreSubmission(
  questions: ScoredQuestion[],
  answers: Record<string, unknown>,
  passingPercent: number | null,
): SubmissionResult {
  const given = isRecord(answers) ? answers : {}
  const results = questions.map((question) => ({
    questionId: question.id,
    ...gradeAnswer(question, given[question.id]),
  }))
  return {
    results,
    summary: summarise(
      results.map((result, index) => ({
        awarded: result.points,
        max: questions[index]?.points ?? 0,
      })),
      passingPercent,
    ),
  }
}
