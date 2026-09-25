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