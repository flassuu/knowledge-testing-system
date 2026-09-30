import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  answeredCount,
  buildAnswers,
  emptyResponse,
  emptyResponses,
  formatClock,
  isAnswered,
  matchingChoices,
  remainingMs,
  type Responses,
} from '../src/student/sessionLogic.ts'
import type { StudentQuestion } from '../src/api/sessions.ts'

function question(overrides: Partial<StudentQuestion> & { type: string }): StudentQuestion {
  return {
    id: 'q1',
    body: 'Question?',
    points: 1,
    position: 0,
    payload: {},
    ...overrides,
  }
}

const single = question({
  id: 'single',
  type: 'single_choice',
  payload: { options: [{ key: 'a', text: 'One' }, { key: 'b', text: 'Two' }] },
})
const multiple = question({
  id: 'multiple',
  type: 'multiple_choice',
  payload: {
    options: [
      { key: 'a', text: 'One' },
      { key: 'b', text: 'Two' },
      { key: 'c', text: 'Three' },
    ],
  },
})
const tf = question({ id: 'tf', type: 'true_false' })
const text = question({ id: 'text', type: 'short_answer' })
const matching = question({
  id: 'match',
  type: 'matching',
  payload: {
    pairs: [
      { left: 'Cat', right: 'Animal' },
      { left: 'Rose', right: 'Plant' },
      { left: 'Sun', right: 'Plant' },
    ],
  },
})
const all = [single, multiple, tf, text, matching]

describe('session logic: empty state', () => {
  it('gives every question a blank response', () => {
    const responses = emptyResponses(all)
    assert.equal(Object.keys(responses).length, 5)
    for (const entry of Object.values(responses)) {
      assert.deepEqual(entry.keys, [])
      assert.equal(entry.text, '')
    }
  })

  it('pre-fills matching rows with both sides and no choice yet', () => {
    const response = emptyResponse(matching)
    assert.deepEqual(response.pairs, [
      { left: 'Cat', right: '' },
      { left: 'Rose', right: '' },
      { left: 'Sun', right: '' },
    ])
  })

  it('offers each distinct right side once for a matching question', () => {
    assert.deepEqual(matchingChoices(matching), ['Animal', 'Plant'])
  })

  it('tolerates a payload with no options at all', () => {
    const broken = question({ id: 'broken', type: 'single_choice', payload: {} })
    assert.deepEqual(emptyResponse(broken), { keys: [], text: '' })
    assert.deepEqual(matchingChoices(broken), [])
  })
})

describe('session logic: what counts as answered', () => {
  it('needs exactly one option for a single choice', () => {
    assert.equal(isAnswered(single, { keys: [], text: '' }), false)
    assert.equal(isAnswered(single, { keys: ['a'], text: '' }), true)
    assert.equal(isAnswered(single, { keys: ['a', 'b'], text: '' }), false)
  })

  it('needs at least one option for a multiple choice', () => {
    assert.equal(isAnswered(multiple, { keys: ['a', 'c'], text: '' }), true)
    assert.equal(isAnswered(multiple, { keys: [], text: '' }), false)
  })

  it('needs an explicit true or false, not just a missing answer', () => {
    assert.equal(isAnswered(tf, { keys: [], text: '' }), false)
    assert.equal(isAnswered(tf, { keys: [], text: '', boolean: false }), true)
  })

  it('ignores whitespace-only free text', () => {
    assert.equal(isAnswered(text, { keys: [], text: '   ' }), false)
    assert.equal(isAnswered(text, { keys: [], text: 'Kyiv' }), true)
  })

  it('needs every matching row filled', () => {
    const partial: Responses = { [matching.id]: emptyResponse(matching) }
    assert.equal(isAnswered(matching, partial[matching.id]), false)
    partial[matching.id] = {
      keys: [],
      text: '',
      pairs: [
        { left: 'Cat', right: 'Animal' },
        { left: 'Rose', right: '' },
        { left: 'Sun', right: '' },
      ],
    }
    assert.equal(isAnswered(matching, partial[matching.id]), false)
    partial[matching.id] = {
      keys: [],
      text: '',
      pairs: [
        { left: 'Cat', right: 'Animal' },
        { left: 'Rose', right: 'Plant' },
        { left: 'Sun', right: 'Plant' },
      ],
    }
    assert.equal(isAnswered(matching, partial[matching.id]), true)
  })

  it('treats a missing response as unanswered', () => {
    assert.equal(isAnswered(single, undefined), false)
    assert.equal(answeredCount(all, {}), 0)
  })

  it('counts the answered questions', () => {
    const responses = emptyResponses(all)
    responses[single.id] = { keys: ['a'], text: '' }
    responses[text.id] = { keys: [], text: 'Kyiv' }
    assert.equal(answeredCount(all, responses), 2)
  })
})

describe('session logic: answer payload', () => {
  it('sends one shape per question type', () => {
    const responses = emptyResponses(all)
    responses[single.id] = { keys: ['a'], text: '' }
    responses[multiple.id] = { keys: ['a', 'c'], text: '' }
    responses[tf.id] = { keys: [], text: '', boolean: false }
    responses[text.id] = { keys: [], text: '  Kyiv  ' }
    responses[matching.id] = {
      keys: [],
      text: '',
      pairs: [
        { left: 'Cat', right: 'Animal' },
        { left: 'Rose', right: 'Plant' },
        { left: 'Sun', right: 'Plant' },
      ],
    }

    assert.deepEqual(buildAnswers(all, responses), {
      single: { key: 'a' },
      multiple: { keys: ['a', 'c'] },
      tf: { boolean: false },
      text: { text: '  Kyiv  ' },
      match: {
        pairs: [
          { left: 'Cat', right: 'Animal' },
          { left: 'Rose', right: 'Plant' },
          { left: 'Sun', right: 'Plant' },
        ],
      },
    })
  })

  it('drops unanswered questions so the server grades them as zero', () => {
    const responses = emptyResponses(all)
    responses[single.id] = { keys: ['a'], text: '' }
    assert.deepEqual(Object.keys(buildAnswers(all, responses)), ['single'])
  })

  it('never sends a false true/false as missing', () => {
    const responses = emptyResponses(all)
    responses[tf.id] = { keys: [], text: '', boolean: false }
    assert.deepEqual(buildAnswers(all, responses), { tf: { boolean: false } })
  })

  it('returns an empty payload for a blank paper', () => {
    assert.deepEqual(buildAnswers(all, emptyResponses(all)), {})
  })
})

describe('session logic: clock', () => {
  const startedAt = '2026-09-30T10:00:00.000Z'
  const serverNow = '2026-09-30T10:00:05.000Z'
  const clientNow = Date.parse('2026-09-30T10:00:00.000Z')

  it('subtracts the round trip from the remaining time', () => {
    // The server is 5s ahead of this device, so 600s of budget is really 595s here.
    assert.equal(remainingMs(startedAt, 600, serverNow, clientNow), 595_000)
  })

  it('never goes below zero once the deadline has passed', () => {
    const pastDeadline = '2026-09-30T10:20:00.000Z'
    const late = Date.parse(pastDeadline)
    assert.equal(remainingMs(startedAt, 600, pastDeadline, late), 0)
  })

  it('trusts the server clock over a device that thinks it is late', () => {
    // The device claims 20 minutes have passed, the server says 5 seconds.
    const late = Date.parse('2026-09-30T10:20:00.000Z')
    assert.equal(remainingMs(startedAt, 600, serverNow, late), 595_000)
  })

  it('is null when the test has no time limit', () => {
    assert.equal(remainingMs(startedAt, null, serverNow, clientNow), null)
  })

  it('formats minutes and seconds, and hours once needed', () => {
    assert.equal(formatClock(0), '00:00')
    assert.equal(formatClock(9_000), '00:09')
    assert.equal(formatClock(65_000), '01:05')
    assert.equal(formatClock(3_725_000), '1:02:05')
    assert.equal(formatClock(-5_000), '00:00')
  })
})
