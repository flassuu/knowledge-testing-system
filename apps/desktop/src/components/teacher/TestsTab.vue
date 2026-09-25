<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiError } from '../../api/client'
import { createTest, deleteTest, getTest, listTests, updateTest } from '../../api/tests'
import type { TestSummary } from '../../api/types'
import {
  buildQuestions,
  formsFromQuestions,
  newQuestionForm,
  type QuestionForm,
} from './questionForm'
import QuestionEditor from './QuestionEditor.vue'

const { t } = useI18n()

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

function removeQuestion(index: number) {
  questionForms.value.splice(index, 1)
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
    await load()
    isEditing.value = false
  } catch (error) {
    formErrorKey.value = apiErrorKey(error)
  } finally {
    saving.value = false
  }
}

async function remove(test: TestSummary) {
  if (!window.confirm(t('teacher.tests.deleteConfirm'))) return
  busyId.value = test.id
  try {
    await deleteTest(test.id)
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
      <h3 class="text-base font-semibold text-slate-800">{{ t('teacher.tests.heading') }}</h3>
      <button
        v-if="!isEditing"
        type="button"
        @click="startCreate"
        class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        + {{ t('teacher.tests.newTest') }}
      </button>
    </div>

    <!-- editor (also renders while creating: editingId === null is handled by `isEditing`) -->
    <form v-if="isEditing" class="mt-4 space-y-4" @submit.prevent="save">
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="text-xs font-semibold text-slate-500">{{ t('teacher.tests.title') }}</span>
            <input
              v-model="title"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">{{ t('teacher.tests.timeLimit') }}</span>
              <input
                v-model="timeLimitMin"
                type="number"
                min="0"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label class="block">
              <span class="text-xs font-semibold text-slate-500">{{ t('teacher.tests.passingPercent') }}</span>
              <input
                v-model="passingPercent"
                type="number"
                min="0"
                max="100"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
          </div>
          <label class="block sm:col-span-2">
            <span class="text-xs font-semibold text-slate-500">{{ t('teacher.tests.description') }}</span>
            <textarea
              v-model="description"
              rows="2"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </label>
        </div>
      </div>

      <div v-if="formError()" role="alert" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ formError() }}
      </div>

      <div class="space-y-3">
        <p class="text-sm font-semibold text-slate-700">{{ t('teacher.tests.questions') }}</p>
        <QuestionEditor
          v-for="(question, index) in questionForms"
          :key="question.key"
          :question="question"
          :index="index"
          @remove="removeQuestion"
        />
        <button
          type="button"
          @click="addQuestion"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          + {{ t('teacher.tests.addQuestion') }}
        </button>
      </div>

      <div class="flex gap-2">
        <button
          type="submit"
          :disabled="saving"
          class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:bg-slate-700 disabled:opacity-60"
        >
          {{ t('teacher.tests.save') }}
        </button>
        <button
          type="button"
          @click="isEditing = false"
          class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          {{ t('teacher.tests.cancel') }}
        </button>
      </div>
    </form>

    <!-- list -->
    <template v-else>
      <p v-if="errorKey" role="alert" class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ showError(errorKey) }}
      </p>
      <p v-else-if="loading" class="mt-6 text-center text-sm text-slate-400">{{ t('common.loading') }}</p>
      <p v-else-if="tests.length === 0" class="mt-6 text-center text-sm text-slate-400">
        {{ t('teacher.tests.empty') }}
      </p>
      <ul v-else class="mt-4 space-y-2">
        <li
          v-for="test in tests"
          :key="test.id"
          class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-slate-800">{{ test.title }}</p>
            <p class="mt-0.5 text-xs text-slate-400">
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
              @click="startEdit(test)"
              class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            >
              {{ t('teacher.tests.edit') }}
            </button>
            <button
              type="button"
              :disabled="busyId === test.id"
              @click="remove(test)"
              class="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              {{ t('teacher.tests.delete') }}
            </button>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>