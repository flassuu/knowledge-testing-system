import { describe, expect, it } from 'bun:test'
import { gradeAnswer, scoreSubmission, summarise, type AnswerInput } from '../src/lib/scoring'

const options = [
  { key: 'a', text: 'Kyiv' },
  { key: 'b', text: 'Lviv' },
  { key: 'c', text: 'Odesa' },
]

describe('scoring: single choice', () => {
  const question = { type: 'single_choice' as const, payload: { options, correct: 'b' }, points: 2 }

  it('awards points for the correct option key', () => {
    expect(gradeAnswer(question, { key: 'b' })).toEqual({ isCorrect: true, points: 2 })
  })

  it('ignores surrounding whitespace in the key', () => {
    expect(gradeAnswer(question, { key: '  b ' }).isCorrect).toBe(true)
  })

  it('rejects a wrong option', () => {
    expect(gradeAnswer(question, { key: 'a' })).toEqual({ isCorrect: false, points: 0 })
  })

  it('rejects a missing, empty or non-string answer', () => {
    expect(gradeAnswer(question, {}).isCorrect).toBe(false)
    expect(gradeAnswer(question, { key: '' }).isCorrect).toBe(false)
    expect(gradeAnswer(question, { key: 42 }).isCorrect).toBe(false)
  })

  it('rejects anything that is not an object', () => {
    expect(gradeAnswer(question, 'b').isCorrect).toBe(false)
    expect(gradeAnswer(question, null).isCorrect).toBe(false)
    expect(gradeAnswer(question, ['b']).isCorrect).toBe(false)
  })
})

describe('scoring: multiple choice', () => {
  const question = {
    type: 'multiple_choice' as const,
    payload: { options, correct: ['a', 'c'] },
    points: 3,
  }

  it('awards points when the key set matches exactly', () => {
    expect(gradeAnswer(question, { keys: ['a', 'c'] }).points).toBe(3)
    expect(gradeAnswer(question, { keys: ['c', 'a'] }).points).toBe(3)
  })

  it('rejects partial selections (no partial credit)', () => {
    expect(gradeAnswer(question, { keys: ['a'] })).toEqual({ isCorrect: false, points: 0 })
  })

  it('rejects extra selections', () => {
    expect(gradeAnswer(question, { keys: ['a', 'b', 'c'] }).isCorrect).toBe(false)
  })

  it('rejects duplicates that would otherwise fake a full set', () => {
    expect(gradeAnswer(question, { keys: ['a', 'a', 'c'] }).isCorrect).toBe(false)
  })

  it('rejects an empty or malformed selection', () => {
    expect(gradeAnswer(question, { keys: [] }).isCorrect).toBe(false)
    expect(gradeAnswer(question, { keys: 'a' as unknown as string[] }).isCorrect).toBe(false)
  })
})

describe('scoring: true / false', () => {
  const question = { type: 'true_false' as const, payload: { correct: true }, points: 1 }

  it('awards points for the right statement', () => {
    expect(gradeAnswer(question, { boolean: true }).points).toBe(1)
  })

  it('rejects the wrong statement', () => {
    expect(gradeAnswer(question, { boolean: false }).points).toBe(0)
  })

  it('rejects truthy stand-ins for booleans', () => {
    expect(gradeAnswer(question, { boolean: 'true' as unknown as boolean }).isCorrect).toBe(false)
    expect(gradeAnswer(question, { boolean: 1 as unknown as boolean }).isCorrect).toBe(false)
  })

  it('rejects a missing answer', () => {
    expect(gradeAnswer(question, {}).isCorrect).toBe(false)
  })
})

describe('scoring: short answer', () => {
  const question = {
    type: 'short_answer' as const,
    payload: { accepted: ['Photosynthesis', '  фотосинтез  '] },
    points: 4,
  }

  it('accepts any accepted variant', () => {
    expect(gradeAnswer(question, { text: 'photosynthesis' }).points).toBe(4)
    expect(gradeAnswer(question, { text: 'ФОТОСИНТЕЗ' }).points).toBe(4)
  })

  it('collapses inner whitespace before comparing', () => {
    expect(gradeAnswer(question, { text: 'photo   synthesis' }).isCorrect).toBe(false)
    expect(gradeAnswer({ ...question, payload: { accepted: ['photo synthesis'] } }, { text: '  photo   synthesis  ' }).isCorrect).toBe(true)
  })

  it('rejects a different answer', () => {
    expect(gradeAnswer(question, { text: 'respiration' }).isCorrect).toBe(false)
  })

  it('rejects empty and non-string answers', () => {
    expect(gradeAnswer(question, { text: '   ' }).isCorrect).toBe(false)
    expect(gradeAnswer(question, { text: 7 as unknown as string }).isCorrect).toBe(false)
    expect(gradeAnswer(question, {}).isCorrect).toBe(false)
  })
})

describe('scoring: matching', () => {
  const question = {
    type: 'matching' as const,
    payload: {
      pairs: [
        { left: 'Cat', right: 'Animal' },
        { left: 'Rose', right: 'Plant' },
      ],
    },
    points: 5,
  }

  it('awards points when every pair is right', () => {
    expect(
      gradeAnswer(question, {
        pairs: [
          { left: 'Rose', right: 'Plant' },
          { left: 'Cat', right: 'Animal' },
        ],
      }).points,
    ).toBe(5)
  })

  it('rejects a single swapped pair', () => {
    expect(
      gradeAnswer(question, {
        pairs: [
          { left: 'Cat', right: 'Plant' },
          { left: 'Rose', right: 'Animal' },
        ],
      }).isCorrect,
    ).toBe(false)
  })

  it('rejects a missing pair', () => {
    expect(gradeAnswer(question, { pairs: [{ left: 'Cat', right: 'Animal' }] }).isCorrect).toBe(false)
  })

  it('rejects duplicate left sides', () => {
    expect(
      gradeAnswer(question, {
        pairs: [
          { left: 'Cat', right: 'Animal' },
          { left: 'cat', right: 'Plant' },
        ],
      }).isCorrect,
    ).toBe(false)
  })

  it('rejects a malformed pair list', () => {
    expect(gradeAnswer(question, { pairs: 'Cat:Animal' as unknown as [] }).isCorrect).toBe(false)
    expect(gradeAnswer(question, {}).isCorrect).toBe(false)
  })
})

describe('scoring: summary', () => {
  it('adds awarded points against the maximum the test offers', () => {
    const result = summarise(
      [
        { awarded: 2, max: 2 },
        { awarded: 0, max: 3 },
        { awarded: 1, max: 1 },
      ],
      null,
    )
    expect(result).toEqual({ score: 3, maxScore: 6, percent: 50, passed: null })
  })

  it('rounds the percentage to the nearest integer', () => {
    const result = summarise(
      [
        { awarded: 2, max: 2 },
        { awarded: 0, max: 1 },
      ],
      null,
    )
    expect(result.percent).toBe(67)
  })

  it('marks a result as passed against the pass mark', () => {
    // 5 of 8 points is 63%.
    const scores = [
      { awarded: 3, max: 4 },
      { awarded: 2, max: 4 },
    ]
    expect(summarise(scores, 50).passed).toBe(true)
    expect(summarise(scores, 75).passed).toBe(false)
  })

  it('leaves passed unknown when the test has no pass mark', () => {
    expect(summarise([{ awarded: 0, max: 4 }], null).passed).toBeNull()
  })

  it('never divides by zero for an empty or zero-point test', () => {
    expect(summarise([], 50)).toEqual({ score: 0, maxScore: 0, percent: 0, passed: false })
    expect(summarise([{ awarded: 0, max: 0 }], null).percent).toBe(0)
  })
})

describe('scoring: whole submission', () => {
  const questions = [
    { id: 'q1', type: 'single_choice' as const, payload: { options, correct: 'a' }, points: 2 },
    { id: 'q2', type: 'true_false' as const, payload: { correct: false }, points: 1 },
    { id: 'q3', type: 'short_answer' as const, payload: { accepted: ['Kyiv'] }, points: 2 },
  ]

  it('grades every question, including the unanswered ones', () => {
    const { results, summary } = scoreSubmission(questions, { q1: { key: 'a' } }, 50)
    expect(results.map((entry) => entry.isCorrect)).toEqual([true, false, false])
    expect(results[0]).toMatchObject({ questionId: 'q1', points: 2 })
    expect(summary).toEqual({ score: 2, maxScore: 5, percent: 40, passed: false })
  })

  it('ignores answers for questions outside the session', () => {
    const { summary } = scoreSubmission(
      questions,
      { q1: { key: 'a' }, q2: { boolean: false }, q3: { text: 'Kyiv' }, qX: { key: 'b' } },
      100,
    )
    expect(summary).toEqual({ score: 5, maxScore: 5, percent: 100, passed: true })
  })

  it('treats a garbage answer map as a zero score', () => {
    const { summary } = scoreSubmission(questions, null as unknown as Record<string, unknown>, null)
    expect(summary.score).toBe(0)
  })
})

describe('scoring: answer shape', () => {
  const typed: AnswerInput = { key: 'a', keys: ['a'], boolean: true, text: 'x', pairs: [] }
  it('accepts the documented flat answer shape', () => {
    expect(Object.keys(typed)).toEqual(['key', 'keys', 'boolean', 'text', 'pairs'])
  })
})
