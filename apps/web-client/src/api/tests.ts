import { apiFetch } from './client'
import type { TestDetails, TestInput, TestSummary } from './types'

/** Teacher/admin: own tests (admin sees all). */
export async function listTests(): Promise<TestSummary[]> {
  const result = await apiFetch<{ tests: TestSummary[] }>('/api/tests')
  return result.tests
}

export async function getTest(id: string): Promise<TestDetails> {
  const result = await apiFetch<{ test: TestDetails }>(`/api/tests/${id}`)
  return result.test
}

export async function createTest(input: TestInput): Promise<TestDetails> {
  const result = await apiFetch<{ test: TestDetails }>('/api/tests', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.test
}

/** Replaces the test and all of its questions. */
export async function updateTest(id: string, input: TestInput): Promise<TestDetails> {
  const result = await apiFetch<{ test: TestDetails }>(`/api/tests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return result.test
}

export async function deleteTest(id: string): Promise<void> {
  await apiFetch<void>(`/api/tests/${id}`, { method: 'DELETE' })
}

/** One row of the grade journal: a student's record for one test. */
export interface JournalRow {
  userId: string
  username: string
  fullName: string
  attempts: number
  bestPercent: number
  lastPercent: number
  lastPassed: boolean | null
  averagePercent: number
  lastSubmittedAt: string | null
}

/** How the class did on one question. */
export interface QuestionStat {
  questionId: string
  body: string
  type: string
  points: number
  answers: number
  correct: number
  percent: number
}

export interface TestResults {
  test: { id: string; title: string; passingPercent: number | null }
  students: number
  submissions: number
  averagePercent: number
  passRate: number | null
  journal: JournalRow[]
  questions: QuestionStat[]
}

/** Teacher only: the grade journal and per-question difficulty for a test. */
export async function getTestResults(testId: string): Promise<TestResults> {
  return apiFetch<TestResults>(`/api/tests/${testId}/results`)
}
