<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowLeftRight, ArrowUp, Copy, Plus, X } from '@lucide/vue'
import { QUESTION_TYPES } from '../../api/types'
import type { QuestionType } from '../../api/types'
import type { QuestionForm } from './questionForm'

const props = defineProps<{
  question: QuestionForm
  index: number
  total: number
}>()

const emit = defineEmits<{
  remove: [index: number]
  duplicate: [index: number]
  move: [index: number, delta: number]
}>()

const { t } = useI18n()

function typeLabel(type: QuestionType): string {
  return t(`teacher.types.${type}`)
}

function addOption(): void {
  props.question.options.push('')
}

function removeOption(index: number): void {
  if (props.question.options.length <= 2) return
  props.question.options.splice(index, 1)
  if (props.question.correctIndex === index) {
    props.question.correctIndex = 0
  } else if (props.question.correctIndex > index) {
    props.question.correctIndex -= 1
  }
  props.question.correctIndexes = props.question.correctIndexes
    .filter((i) => i !== index)
    .map((i) => (i > index ? i - 1 : i))
}

function toggleCorrect(index: number): void {
  const set = props.question.correctIndexes
  if (set.includes(index)) props.question.correctIndexes = set.filter((i) => i !== index)
  else props.question.correctIndexes = [...set, index].sort()
}

function addPair(): void {
  props.question.pairs.push({ left: '', right: '' })
}

function removePair(index: number): void {
  if (props.question.pairs.length <= 2) return
  props.question.pairs.splice(index, 1)
}
</script>

<template>
  <fieldset class="rounded-xl border border-outline-variant bg-surface-container p-4">
    <div class="mb-3 flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container"
        >
          {{ index + 1 }}
        </span>
        <span class="truncate text-xs font-semibold text-on-surface-variant">
          {{ typeLabel(question.type) }}
        </span>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          :disabled="index === 0"
          @click="emit('move', index, -1)"
          class="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-30"
          :aria-label="t('teacher.editor.moveUp')"
        >
          <ArrowUp class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          :disabled="index === total - 1"
          @click="emit('move', index, 1)"
          class="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-30"
          :aria-label="t('teacher.editor.moveDown')"
        >
          <ArrowDown class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          @click="emit('duplicate', index)"
          class="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          :aria-label="t('teacher.editor.duplicateQuestion')"
        >
          <Copy class="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          @click="emit('remove', index)"
          class="rounded-lg p-1.5 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
          :aria-label="t('teacher.editor.removeQuestion')"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        v-model="question.body"
        type="text"
        :aria-label="t('teacher.editor.bodyPlaceholder')"
        :placeholder="t('teacher.editor.bodyPlaceholder')"
        class="w-full flex-1 rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:border-primary"
      />
      <div class="flex items-center gap-2">
        <select
          v-model="question.type"
          :aria-label="t('teacher.editor.typeLabel')"
          class="rounded-lg border border-outline bg-surface px-2 py-2 text-sm focus:border-primary"
        >
          <option v-for="type in QUESTION_TYPES" :key="type" :value="type">
            {{ typeLabel(type) }}
          </option>
        </select>
        <label class="flex items-center gap-1 text-xs text-on-surface-variant">
          {{ t('teacher.editor.points') }}
          <input
            v-model.number="question.points"
            type="number"
            min="1"
            class="w-16 rounded-lg border border-outline bg-surface px-2 py-2 text-sm focus:border-primary"
          />
        </label>
      </div>
    </div>

    <!-- single / multiple choice -->
    <div
      v-if="question.type === 'single_choice' || question.type === 'multiple_choice'"
      class="mt-3 space-y-2"
    >
      <p class="text-xs font-semibold text-on-surface-variant">{{ t('teacher.editor.options') }}</p>
      <div
        v-for="(_, index) in question.options"
        :key="index"
        class="flex items-center gap-2"
      >
        <input
          v-if="question.type === 'single_choice'"
          type="radio"
          :name="`correct-${question.key}`"
          :checked="question.correctIndex === index"
          @change="question.correctIndex = index"
          class="shrink-0"
        />
        <input
          v-else
          type="checkbox"
          :checked="question.correctIndexes.includes(index)"
          @change="toggleCorrect(index)"
          class="shrink-0"
        />
        <input
          v-model="question.options[index]"
          type="text"
          :aria-label="t('teacher.editor.optionLabel')"
          class="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:border-primary"
        />
        <button
          type="button"
          :disabled="question.options.length <= 2"
          @click="removeOption(index)"
          :aria-label="t('teacher.editor.removeOption')"
          class="shrink-0 rounded p-1.5 text-on-surface-variant hover:text-error disabled:opacity-30"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        @click="addOption"
        class="inline-flex items-center gap-1.5 rounded-lg border border-outline px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high"
      >
        <Plus class="size-3.5" aria-hidden="true" />
        {{ t('teacher.editor.addOption') }}
      </button>
    </div>

    <!-- true / false -->
    <div v-else-if="question.type === 'true_false'" class="mt-3 flex gap-4">
      <label class="flex items-center gap-2 text-sm text-on-surface">
        <input v-model="question.isTrue" type="radio" :value="true" class="shrink-0" />
        {{ t('teacher.editor.trueValue') }}
      </label>
      <label class="flex items-center gap-2 text-sm text-on-surface">
        <input v-model="question.isTrue" type="radio" :value="false" class="shrink-0" />
        {{ t('teacher.editor.falseValue') }}
      </label>
    </div>

    <!-- short answer -->
    <div v-else-if="question.type === 'short_answer'" class="mt-3">
      <p class="text-xs font-semibold text-on-surface-variant">{{ t('teacher.editor.accepted') }}</p>
      <textarea
        v-model="question.accepted"
        rows="3"
        :aria-label="t('teacher.editor.accepted')"
        class="mt-1 w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:border-primary"
      />
    </div>

    <!-- matching -->
    <div v-else class="mt-3 space-y-2">
      <p class="text-xs font-semibold text-on-surface-variant">{{ t('teacher.editor.pairs') }}</p>
      <div
        v-for="(_, index) in question.pairs"
        :key="index"
        class="flex items-center gap-2"
      >
        <input
          v-model="question.pairs[index].left"
          type="text"
          :aria-label="t('teacher.editor.left')"
          :placeholder="t('teacher.editor.left')"
          class="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:border-primary"
        />
        <ArrowLeftRight class="size-4 text-on-surface-variant" aria-hidden="true" />
        <input
          v-model="question.pairs[index].right"
          type="text"
          :aria-label="t('teacher.editor.right')"
          :placeholder="t('teacher.editor.right')"
          class="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:border-primary"
        />
        <button
          type="button"
          :disabled="question.pairs.length <= 2"
          @click="removePair(index)"
          :aria-label="t('teacher.editor.removePair')"
          class="shrink-0 rounded p-1.5 text-on-surface-variant hover:text-error disabled:opacity-30"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        @click="addPair"
        class="inline-flex items-center gap-1.5 rounded-lg border border-outline px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high"
      >
        <Plus class="size-3.5" aria-hidden="true" />
        {{ t('teacher.editor.addPair') }}
      </button>
    </div>
  </fieldset>
</template>