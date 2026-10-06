import type { QuestionInput } from '../api/types'

/**
 * Drafts are the teacher's work that could not reach the server: the save was
 * pressed while the room had no link to it, or the machine was shut down
 * mid-edit. They live in localStorage, one entry per unsynced test, and are
 * uploaded by the caller once the server answers again.
 */

const STORAGE_KEY = 'drafts.tests'

/** A draft is always complete: the editor only saves a form it considers valid. */
export interface DraftPayload {
  title: string
  description: string
  timeLimitSec: number | null
  passingPercent: number | null
  questions: QuestionInput[]
}

export interface TestDraft {
  /** Local id; the server assigns its own when the draft is uploaded. */
  id: string
  /** ISO timestamp of the last edit, for "saved 4 minutes ago" and for ordering. */
  updatedAt: string
  payload: DraftPayload
}

/** The slice of the Storage API this module needs, so tests can pass a fake. */
export interface DraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function browserStorage(): DraftStorage {
  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  }
}

export function listDrafts(storage: DraftStorage = browserStorage()): TestDraft[] {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isDraft).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  } catch {
    // A corrupted entry must not take the whole list down with it.
    return []
  }
}

function isDraft(value: unknown): value is TestDraft {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<TestDraft>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.payload === 'object' &&
    candidate.payload !== null &&
    typeof (candidate.payload as Partial<DraftPayload>).title === 'string'
  )
}

function writeDrafts(drafts: TestDraft[], storage: DraftStorage): void {
  try {
    if (drafts.length === 0) storage.removeItem(STORAGE_KEY)
    else storage.setItem(STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    // No quota, or storage disabled: the teacher simply loses the draft.
  }
}

/**
 * Stores (or replaces) a draft. A draft without a title is not worth keeping -
 * it is an abandoned form, not work.
 */
export function saveDraft(
  payload: DraftPayload,
  storage: DraftStorage = browserStorage(),
): TestDraft | null {
  if (!payload.title.trim()) return null
  const drafts = listDrafts(storage)
  const existing = drafts.find((draft) => draft.payload.title === payload.title)
  const draft: TestDraft = {
    id: existing?.id ?? crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    payload,
  }
  writeDrafts([...drafts.filter((entry) => entry.id !== draft.id), draft], storage)
  return draft
}

export function deleteDraft(id: string, storage: DraftStorage = browserStorage()): void {
  writeDrafts(
    listDrafts(storage).filter((draft) => draft.id !== id),
    storage,
  )
}

export function clearDrafts(storage: DraftStorage = browserStorage()): void {
  writeDrafts([], storage)
}

/**
 * Uploads every draft through `upload` and reports what happened: the ones that
 * went up and the ones that failed. Failures keep their draft, so a second
 * attempt does not lose work.
 */
export async function syncDrafts(
  upload: (payload: DraftPayload) => Promise<unknown>,
  storage: DraftStorage = browserStorage(),
): Promise<{ uploaded: TestDraft[]; failed: TestDraft[] }> {
  const drafts = listDrafts(storage)
  const uploaded: TestDraft[] = []
  const failed: TestDraft[] = []

  for (const draft of drafts) {
    try {
      await upload(draft.payload)
      uploaded.push(draft)
    } catch {
      failed.push(draft)
    }
  }

  const gone = new Set(uploaded.map((draft) => draft.id))
  writeDrafts(
    drafts.filter((draft) => !gone.has(draft.id)),
    storage,
  )
  return { uploaded, failed }
}