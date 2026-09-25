import type { Question, QuestionInput, QuestionType } from '../../api/types'

export interface AnswerPair {
  left: string
  right: string
}

/** Mutable form model backing the question editor. */
export interface QuestionForm {
  key: string
  type: QuestionType
  body: string
  points: number
  options: string[]
  correctIndex: number
  correctIndexes: number[]
  isTrue: boolean
  accepted: string
  pairs: AnswerPair[]
}

/** Question payloads from the server carry the same field names. */
interface ChoicePayloadOption {
  key?: string
  text?: string
}

type ReadbackPayload = {
  options?: ChoicePayloadOption[]
  correct?: string | string[]
  accepted?: string[]
  pairs?: Array<{ left?: string; right?: string }>
}

/** Validation result: built questions, or the i18n detail key of the first problem. */
export type QuestionBuild = QuestionInput[] | string

function optionKey(index: number): string {
  return String.fromCharCode(97 + index)
}

export function newQuestionForm(type: QuestionType = 'single_choice'): QuestionForm {
  return {
    key: crypto.randomUUID(),
    type,
    body: '',
    points: 1,
    options: ['', ''],
    correctIndex: 0,
    correctIndexes: [0],
    isTrue: true,
    accepted: '',
    pairs: [
      { left: '', right: '' },
      { left: '', right: '' },
    ],
  }
}

export function buildQuestions(forms: QuestionForm[]): QuestionBuild {
  const questions: QuestionInput[] = []
  for (let position = 0; position < forms.length; position++) {
    const form = forms[position]
    if (!form.body.trim()) return 'emptyBody'
    if (!Number.isInteger(form.points) || form.points < 1) return 'badPoints'

    let payload: Record<string, unknown>
    switch (form.type) {
      case 'single_choice': {
        const options = form.options.map((text, index) => ({
          key: optionKey(index),
          text: text.trim(),
        }))
        if (options.length < 2) return 'tooFewOptions'
        if (options.some((option) => !option.text)) return 'emptyOption'
        if (form.correctIndex < 0 || form.correctIndex >= options.length) return 'noCorrect'
        payload = { options, correct: options[form.correctIndex].key }
        break
      }
      case 'multiple_choice': {
        const options = form.options.map((text, index) => ({
          key: optionKey(index),
          text: text.trim(),
        }))
        if (options.length < 2) return 'tooFewOptions'
        if (options.some((option) => !option.text)) return 'emptyOption'
        const indexes = [...new Set(form.correctIndexes)].filter(
          (index) => index >= 0 && index < options.length,
        )
        if (indexes.length === 0) return 'noCorrect'
        payload = { options, correct: indexes.map((index) => options[index].key) }
        break
      }
      case 'true_false':
        payload = { correct: form.isTrue }
        break
      case 'short_answer': {
        const accepted = form.accepted
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
        if (accepted.length === 0) return 'noAccepted'
        payload = { accepted }
        break
      }
      case 'matching': {
        const pairs = form.pairs.map((pair) => ({
          left: pair.left.trim(),
          right: pair.right.trim(),
        }))
        if (pairs.length < 2) return 'tooFewPairs'
        if (pairs.some((pair) => !pair.left || !pair.right)) return 'emptyPair'
        payload = { pairs }
        break
      }
    }
    questions.push({
      type: form.type,
      body: form.body.trim(),
      points: form.points,
      position,
      payload,
    })
  }
  return questions
}

/** Maps server questions back into editable form rows. */
export function formsFromQuestions(questions: Question[]): QuestionForm[] {
  return questions.map((question) => {
    const form = newQuestionForm(question.type)
    form.body = question.body
    form.points = question.points
    const payload = (question.payload ?? {}) as ReadbackPayload
    switch (question.type) {
      case 'single_choice': {
        form.options = payload.options?.map((option) => option.text ?? '') ?? []
        const index =
          payload.options?.findIndex((option) => option.key !== undefined && option.key === payload.correct) ?? -1
        form.correctIndex = index >= 0 ? index : 0
        break
      }
      case 'multiple_choice': {
        form.options = payload.options?.map((option) => option.text ?? '') ?? []
        const correct = Array.isArray(payload.correct) ? (payload.correct as string[]) : []
        form.correctIndexes = (payload.options ?? [])
          .map((option, index) => (option.key !== undefined && correct.includes(option.key) ? index : -1))
          .filter((index) => index >= 0)
        if (form.correctIndexes.length === 0) form.correctIndexes = [0]
        break
      }
      case 'true_false':
        form.isTrue = (payload as { correct?: boolean }).correct === true
        break
      case 'short_answer':
        form.accepted = (payload.accepted ?? []).join('\n')
        break
      case 'matching':
        form.pairs = (payload.pairs ?? []).map((pair) => ({
          left: pair.left ?? '',
          right: pair.right ?? '',
        }))
        if (form.pairs.length === 0) form.pairs = newQuestionForm('matching').pairs
        break
    }
    return form
  })
}