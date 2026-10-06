<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BarChart3, Eye, FileQuestion, Plus } from '@lucide/vue'
import { ApiError } from '../../api/client'
import EmptyState from '../common/EmptyState.vue'
import SkeletonList from '../common/SkeletonList.vue'
import { createTest, deleteTest, getTest, getTestResults, listTests, updateTest } from '../../api/tests'
import type { TestSummary } from '../../api/types'
import type { TestResults } from '../../api/tests'
import {
  buildQuestions,
  duplicateQuestionForm,
  formsFromQuestions,
  newQuestionForm,
  type QuestionForm,
} from './questionForm'
import QuestionEditor from './QuestionEditor.vue'
import TestPreviewDialog from './TestPreviewDialog.vue'
import TestResultsView from './TestResultsView.vue'
import { useConfirm } from '../../composables/confirm'
import { useToast } from '../../composables/toast'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

const tests = ref<TestSummary[]>([])
const loading = ref(false)
const errorKey = ref('')

/** True while the create/edit form is open (both create and edit). */
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const formErrorKey = ref('')
const title = ref('')
const description = ref('')
const timeLimitMin = ref('')
const passingPercent = ref('')
const questionForms = ref<QuestionForm[]>([])
const busyId = ref('')
/** Which test's journal is open instead of the list. */
const resultsFor = ref<TestSummary | null>(null)
const results = ref<TestResults | null>(null)
const resultsLoading = ref(false)
const showPreview = ref(false)

function apiErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.code === 'NETWORK') return 'network'
  if (error.code === 'VALIDATION') return 'validation'
  if (error.code === 'CONFLICT') return 'conflict'
  if (error.code === 'NOT_FOUND') return 'notFound'
  return 'generic'
}

function showError(key: string): string {
  return key === 'generic' ? t('teacher.errors.generic') : t(`teacher.errors.${key}`)
}

function formError(): string {
  return formErrorKey.value ? t(`teacher.form.err.${formErrorKey.value}`) : ''
}

async function load() {
  loading.value = true
  errorKey.value = ''
  try {
    tests.value = await listTests()
  } catch (error) {
    errorKey.value = apiErrorKey(error)
  } finally {
    loading.value = false
  }
}

function startCreate() {
  formErrorKey.value = ''
  title.value = ''
  description.value = ''
  timeLimitMin.value = ''
  passingPercent.value = ''
  questionForms.value = [newQuestionForm()]
  editingId.value = null
  isEditing.value = true
}

async function startEdit(test: TestSummary) {
  formErrorKey.value = ''
  try {
    const details = await getTest(test.id)
    title.value = details.title
    description.value = details.description
    timeLimitMin.value = details.timeLimitSec ? String(Math.round(details.timeLimitSec / 60)) : ''
    passingPercent.value = details.passingPercent != null ? String(details.passingPercent) : ''
    questionForms.value = formsFromQuestions(details.questions)
    editingId.value = test.id
    isEditing.value = true
  } catch (error) {
    errorKey.value = apiErrorKey(error)
  }
}

function addQuestion() {
  questionForms.value.push(newQuestionForm())
}

async function openResults(test: TestSummary): Promise<void> {
  resultsFor.value = test
  results.value = null
  resultsLoading.value = true
  try {
    results.value = await getTestResults(test.id)
  } catch (error) {
    toast.error(
      error instanceof ApiError && error.code === 'FORBIDDEN'
        ? t('teacher.errors.generic')
        : t('teacher.errors.network'),
    )
    resultsFor.value = null
  } finally {
    resultsLoading.value = false
  }
}

function closeResults(): void {
  resultsFor.value = null
  results.value = null
}

function removeQuestion(index: number) {
  questionForms.value.splice(index, 1)
}

function duplicateQuestion(index: number) {
  const source = questionForms.value[index]
  if (!source) return
  questionForms.value.splice(index + 1, 0, duplicateQuestionForm(source))
}

function moveQuestion(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= questionForms.value.length) return
  const [row] = questionForms.value.splice(index, 1)
  if (!row) return
  questionForms.value.splice(target, 0, row)
}

async function save() {
  const built = buildQuestions(questionForms.value)
  if (typeof built === 'string') {
    formErrorKey.value = built
    return
  }
  if (!title.value.trim()) {
    formErrorKey.value = 'titleRequired'
    return
  }
  formErrorKey.value = ''
  saving.value = true
  try {
    const payload = {
      title: title.value.trim(),
      description: description.value.trim(),
      timeLimitSec: timeLimitMin.value ? Number(timeLimitMin.value) * 60 : null,
      passingPercent: passingPercent.value ? Number(passingPercent.value) : null,
      questions: built,
    }
    if (editingId.value) await updateTest(editingId.value, payload)
    else await createTest(payload)
    toast.success(editingId.value ? t('teacher.tests.updated') : t('teacher.tests.created'))
    await load()
    isEditing.value = false
    showPreview.value = false
  } catch (error) {
    formErrorKey.value = apiErrorKey(error)
  } finally {
    saving.value = false
  }
}

async function remove(test: TestSummary) {
  if (!(await confirm({ message: t('teacher.tests.deleteConfirm') }))) return
  busyId.value = test.id
  try {
    await deleteTest(test.id)
    toast.success(t('teacher.tests.deleted'))
    await load()
  } catch (error) {
    errorKey.value = apiErrorKey(error)
  } finally {
    busyId.value = ''
  }
}

onMounted(load)
</script>

<template>
  <section>
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-on-surface">{{ t('teacher.tests.heading') }}</h3>
      <button
        v-if="!isEditing"
        type="button"
        @click="startCreate"
        class="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-on-success hover:opacity-90"
      >
        <Plus class="size-3.5" aria-hidden="true" />
        {{ t('teacher.tests.newTest') }}
      </button>
    </div>

    <!-- editor (also renders while creating: editingId === null is handled by `isEditing`) -->
    <form v-if="isEditing" class="mt-4 space-y-4" @submit.prevent="save">
      <div class="rounded-xl border border-outline-variant bg-surface-container p-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="text-xs font-semibold text-on-surface-variant">{{ t('teacher.tests.title') }}</span>
            <input
              v-model="title"
              type="text"
              class="mt-1 w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:border-primary"
            />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs font-semibold text-on-surface-variant">{{ t('teacher.tests.timeLimit') }}</span>
              <input
                v-model="timeLimitMin"
                type="number"
                min="0"
                class="mt-1 w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:border-primary"
              />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-on-surface-variant">{{ t('teacher.tests.passingPercent') }}</span>
              <input
                v-model="passingPercent"
                type="number"
                min="0"
                max="100"
                class="mt-1 w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:border-primary"
              />
            </label>
          </div>
          <label class="block sm:col-span-2">
            <span class="text-xs font-semibold text-on-surface-variant">{{ t('teacher.tests.description') }}</span>
            <textarea
              v-model="description"
              rows="2"
              class="mt-1 w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:border-primary"
            />
          </label>
        </div>
      </div>

      <div v-if="formError()" role="alert" class="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
        {{ formError() }}
      </div>

      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-semibold text-on-surface">{{ t('teacher.tests.questions') }}</p>
          <button
            type="button"
            @click="showPreview = true"
            class="inline-flex items-center gap-1.5 rounded-lg border border-outline bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high"
          >
            <Eye class="size-3.5" aria-hidden="true" />
            {{ t('teacher.tests.preview') }}
          </button>
        </div>
        <QuestionEditor
          v-for="(question, index) in questionForms"
          :key="question.key"
          :question="question"
          :index="index"
          :total="questionForms.length"
          @remove="removeQuestion"
          @duplicate="duplicateQuestion"
          @move="moveQuestion"
        />
        <button
          type="button"
          @click="addQuestion"
          class="inline-flex items-center gap-1.5 rounded-lg border border-outline bg-surface px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
        >
          <Plus class="size-4" aria-hidden="true" />
          {{ t('teacher.tests.addQuestion') }}
        </button>
      </div>

      <TestPreviewDialog
        :open="showPreview"
        :title="title"
        :description="description"
        :time-limit-min="timeLimitMin"
        :passing-percent="passingPercent"
        :forms="questionForms"
        @close="showPreview = false"
      />

      <div class="flex gap-2">
        <button
          type="submit"
          :disabled="saving"
          class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {{ t('teacher.tests.save') }}
        </button>
        <button
          type="button"
          @click="isEditing = false"
          class="rounded-lg border border-outline bg-surface px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
        >
          {{ t('teacher.tests.cancel') }}
        </button>
      </div>
    </form>

    <!-- grade journal for one test, opened from the list -->
    <SkeletonList v-else-if="resultsFor && resultsLoading" class="mt-4" :rows="3" />

    <TestResultsView
      v-else-if="resultsFor && results"
      :test="{
        id: resultsFor.id,
        title: results.test.title,
        passingPercent: results.test.passingPercent,
      }"
      :results="results"
      @back="closeResults"
    />

    <!-- list -->
    <template v-else>
      <p v-if="errorKey" role="alert" class="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
        {{ showError(errorKey) }}
      </p>
      <SkeletonList v-else-if="loading" class="mt-4" :rows="3" />

      <EmptyState
        v-else-if="tests.length === 0"
        class="mt-4"
        :icon="FileQuestion"
        :title="t('teacher.tests.emptyTitle')"
        :description="t('teacher.tests.emptyHint')"
        :action-label="t('teacher.tests.newTest')"
        @action="startCreate"
      />
      <ul v-else class="mt-4 space-y-2">
        <li
          v-for="test in tests"
          :key="test.id"
          class="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 shadow-sm sm:flex-row sm:items-center"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-on-surface">{{ test.title }}</p>
            <p class="mt-0.5 text-xs text-on-surface-variant">
              {{ t('teacher.tests.questionCount', { count: test.questionCount }) }}
              <span v-if="test.timeLimitSec"> · {{ t('teacher.tests.timeLimit') }}:
                {{ Math.round(test.timeLimitSec / 60) }} {{ t('teacher.tests.minutes') }}</span>
              <span v-if="test.passingPercent != null"> · {{ t('teacher.tests.passing', { percent: test.passingPercent }) }}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              :disabled="busyId === test.id"
              @click="openResults(test)"
              class="inline-flex items-center gap-1.5 rounded-lg border border-outline bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high disabled:opacity-60"
            >
              <BarChart3 class="size-3.5" aria-hidden="true" />
              {{ t('teacher.tests.results') }}
            </button>
            <button
              type="button"
              :disabled="busyId === test.id"
              @click="startEdit(test)"
              class="rounded-lg border border-outline bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high disabled:opacity-60"
            >
              {{ t('teacher.tests.edit') }}
            </button>
            <button
              type="button"
              :disabled="busyId === test.id"
              @click="remove(test)"
              class="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-error-container hover:bg-error-container disabled:opacity-60"
            >
              {{ t('teacher.tests.delete') }}
            </button>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>