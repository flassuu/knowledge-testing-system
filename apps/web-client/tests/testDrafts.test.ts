import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  clearDrafts,
  deleteDraft,
  listDrafts,
  saveDraft,
  syncDrafts,
  type DraftPayload,
  type DraftStorage,
} from '../src/drafts/testDrafts.ts'


function memoryStorage(): DraftStorage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  }
}

const PAYLOAD: DraftPayload = {
  title: 'Photosynthesis',
  description: 'Grade 9',
  timeLimitSec: 600,
  passingPercent: 60,
  questions: [
    { type: 'true_false', body: 'Plants eat light.', points: 1, position: 0, payload: { correct: true } },
  ],
}

describe('test drafts', () => {
  it('keeps a draft and gives it back', () => {
    const storage = memoryStorage()
    const saved = saveDraft(PAYLOAD, storage)

    assert.ok(saved)
    assert.equal(listDrafts(storage).length, 1)
    assert.deepEqual(listDrafts(storage)[0]?.payload, PAYLOAD)
  })

  it('replaces a draft of the same test instead of piling copies up', () => {
    const storage = memoryStorage()
    const first = saveDraft(PAYLOAD, storage)
    const second = saveDraft({ ...PAYLOAD, description: 'Grade 9, autumn' }, storage)

    assert.equal(first?.id, second?.id)
    const drafts = listDrafts(storage)
    assert.equal(drafts.length, 1)
    assert.equal(drafts[0]?.payload.description, 'Grade 9, autumn')
  })

  it('does not keep an empty form', () => {
    const storage = memoryStorage()
    assert.equal(saveDraft({ ...PAYLOAD, title: '   ' }, storage), null)
    assert.deepEqual(listDrafts(storage), [])
  })

  it('survives a corrupted entry', () => {
    const storage = memoryStorage()
    storage.setItem('drafts.tests', '{not json')
    assert.deepEqual(listDrafts(storage), [])

    storage.setItem('drafts.tests', JSON.stringify([{ id: 1 }, 'nope']))
    assert.deepEqual(listDrafts(storage), [])
  })

  it('deletes one draft and clears them all', () => {
    const storage = memoryStorage()
    const first = saveDraft(PAYLOAD, storage)
    saveDraft({ ...PAYLOAD, title: 'Vectors' }, storage)
    assert.equal(listDrafts(storage).length, 2)

    if (first) deleteDraft(first.id, storage)
    assert.equal(listDrafts(storage).length, 1)

    clearDrafts(storage)
    assert.deepEqual(listDrafts(storage), [])
  })

  it('uploads every draft and forgets the ones that went up', async () => {
    const storage = memoryStorage()
    saveDraft(PAYLOAD, storage)
    saveDraft({ ...PAYLOAD, title: 'Vectors' }, storage)
    const uploaded: string[] = []

    const result = await syncDrafts(async (payload) => uploaded.push(payload.title), storage)

    assert.deepEqual(uploaded.sort(), ['Photosynthesis', 'Vectors'])
    assert.equal(result.uploaded.length, 2)
    assert.deepEqual(result.failed, [])
    assert.deepEqual(listDrafts(storage), [])
  })

  it('keeps a draft that could not be uploaded, and reports it', async () => {
    const storage = memoryStorage()
    saveDraft(PAYLOAD, storage)
    saveDraft({ ...PAYLOAD, title: 'Vectors' }, storage)

    const result = await syncDrafts(async (payload) => {
      if (payload.title === 'Vectors') throw new Error('server said no')
    }, storage)

    assert.equal(result.uploaded.length, 1)
    assert.equal(result.failed.length, 1)
    const remaining = listDrafts(storage)
    assert.equal(remaining.length, 1)
    assert.equal(remaining[0]?.payload.title, 'Vectors')
  })

  it('orders drafts by the last edit, newest first', () => {
    const storage = memoryStorage()
    storage.setItem(
      'drafts.tests',
      JSON.stringify([
        { id: 'a', updatedAt: '2026-01-01T10:00:00.000Z', payload: PAYLOAD },
        { id: 'b', updatedAt: '2026-01-02T10:00:00.000Z', payload: { ...PAYLOAD, title: 'Newer' } },
      ]),
    )
    assert.deepEqual(
      listDrafts(storage).map((draft) => draft.payload.title),
      ['Newer', 'Photosynthesis'],
    )
  })
})