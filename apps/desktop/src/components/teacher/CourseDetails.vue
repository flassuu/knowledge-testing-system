<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiError } from '../../api/client'
import {
  attachTest,
  deleteCourse,
  detachTest,
  downloadMaterial,
  enrollStudent,
  getCourse,
  unenrollStudent,
  uploadMaterial,
} from '../../api/courses'
import { listTests } from '../../api/tests'
import type { CourseDetails, Material, TestSummary } from '../../api/types'

const props = defineProps<{
  courseId: string
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const course = ref<CourseDetails | null>(null)
const loading = ref(false)
const errorKey = ref('')

const availableTests = ref<TestSummary[]>([])
const enrollUsername = ref('')
const attachTestId = ref('')
const actionError = ref('')

function apiErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.code === 'NETWORK') return 'network'
  if (error.code === 'VALIDATION' || error.code === 'INVALID_OPERATION') return 'validation'
  if (error.code === 'CONFLICT') return 'conflict'
  if (error.code === 'NOT_FOUND') return 'notFound'
  return 'generic'
}

function showError(key: string): string {
  return key === 'generic' ? t('teacher.errors.generic') : t(`teacher.errors.${key}`)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function load() {
  loading.value = true
  errorKey.value = ''
  try {
    course.value = await getCourse(props.courseId)
    const tests = await listTests()
    const attached = new Set(course.value.tests.map((test) => test.id))
    availableTests.value = tests.filter((test) => !attached.has(test.id))
  } catch (error) {
    errorKey.value = apiErrorKey(error)
  } finally {
    loading.value = false
  }
}

async function run(action: () => Promise<unknown>) {
  actionError.value = ''
  try {
    await action()
    await load()
  } catch (error) {
    const key = apiErrorKey(error)
    actionError.value =
      key === 'validation' && error instanceof ApiError && error.status === 400
        ? t('teacher.courses.studentNotFound')
        : showError(key)
  }
}

async function enroll() {
  const username = enrollUsername.value.trim()
  if (!username) return
  await run(() => enrollStudent(props.courseId, username))
  enrollUsername.value = ''
}

async function detach(testId: string) {
  await run(() => detachTest(props.courseId, testId))
}

async function attach() {
  if (!attachTestId.value) return
  await run(() => attachTest(props.courseId, attachTestId.value))
  attachTestId.value = ''
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  void run(() => uploadMaterial(props.courseId, file))
  input.value = ''
}

async function download(material: Material) {
  try {
    await downloadMaterial(props.courseId, material.id, material.title)
  } catch {
    actionError.value = showError('network')
  }
}

async function removeCourse() {
  if (!window.confirm(t('teacher.courses.deleteConfirm'))) return
  await run(() => deleteCourse(props.courseId))
  emit('close')
}

onMounted(load)
</script>

<template>
  <div v-if="loading" class="mt-6 text-center text-sm text-slate-400">{{ t('common.loading') }}</div>

  <div v-else-if="course" class="mt-4 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h4 class="text-base font-semibold text-slate-800">{{ course.title }}</h4>
        <p v-if="course.description" class="mt-0.5 text-sm text-slate-500">{{ course.description }}</p>
      </div>
      <button
        type="button"
        @click="emit('close')"
        class="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
      >
        ← {{ t('teacher.courses.back') }}
      </button>
    </div>

    <p v-if="actionError" role="alert" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ actionError }}
    </p>

    <!-- students -->
    <section class="rounded-xl border border-slate-200 bg-white p-4">
      <h5 class="text-sm font-semibold text-slate-700">
        {{ t('teacher.courses.students') }} ({{ course.students.length }})
      </h5>
      <ul v-if="course.students.length" class="mt-3 space-y-1.5">
        <li
          v-for="student in course.students"
          :key="student.id"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <span class="min-w-0 truncate text-slate-700">
            {{ student.fullName }} <span class="text-slate-400">@{{ student.username }}</span>
          </span>
          <button
            type="button"
            @click="run(() => unenrollStudent(courseId, student.id))"
            class="shrink-0 rounded border border-rose-200 px-2 py-0.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
          >
            {{ t('teacher.courses.unenroll') }}
          </button>
        </li>
      </ul>
      <p v-else class="mt-3 text-xs text-slate-400">{{ t('teacher.courses.noStudents') }}</p>
      <form class="mt-3 flex gap-2" @submit.prevent="enroll">
        <input
          v-model="enrollUsername"
          type="text"
          :placeholder="t('teacher.courses.enrollPlaceholder')"
          class="w-full max-w-52 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          class="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          {{ t('teacher.courses.enroll') }}
        </button>
      </form>
    </section>

    <!-- tests -->
    <section class="rounded-xl border border-slate-200 bg-white p-4">
      <h5 class="text-sm font-semibold text-slate-700">
        {{ t('teacher.courses.tests') }} ({{ course.tests.length }})
      </h5>
      <ul v-if="course.tests.length" class="mt-3 space-y-1.5">
        <li
          v-for="test in course.tests"
          :key="test.id"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <span class="min-w-0 truncate text-slate-700">{{ test.title }}</span>
          <button
            type="button"
            @click="detach(test.id)"
            class="shrink-0 rounded border border-rose-200 px-2 py-0.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
          >
            {{ t('teacher.courses.detach') }}
          </button>
        </li>
      </ul>
      <p v-else class="mt-3 text-xs text-slate-400">{{ t('teacher.courses.noTests') }}</p>
      <form v-if="availableTests.length" class="mt-3 flex gap-2" @submit.prevent="attach">
        <select
          v-model="attachTestId"
          class="w-full max-w-52 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="" disabled>{{ t('teacher.courses.attachTest') }}</option>
          <option v-for="test in availableTests" :key="test.id" :value="test.id">
            {{ test.title }}
          </option>
        </select>
        <button
          type="submit"
          :disabled="!attachTestId"
          class="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {{ t('teacher.courses.attach') }}
        </button>
      </form>
    </section>

    <!-- materials -->
    <section class="rounded-xl border border-slate-200 bg-white p-4">
      <h5 class="text-sm font-semibold text-slate-700">
        {{ t('teacher.courses.materials') }} ({{ course.materials.length }})
      </h5>
      <ul v-if="course.materials.length" class="mt-3 space-y-1.5">
        <li v-for="material in course.materials" :key="material.id" class="flex items-center gap-2 text-sm">
          <span class="min-w-0 flex-1 truncate text-slate-700">📎 {{ material.title }}</span>
          <span class="shrink-0 text-xs text-slate-400">{{ formatBytes(material.sizeBytes) }}</span>
          <button
            type="button"
            @click="download(material)"
            class="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            {{ t('teacher.courses.download') }}
          </button>
        </li>
      </ul>
      <p v-else class="mt-3 text-xs text-slate-400">{{ t('teacher.courses.noMaterials') }}</p>
      <label class="mt-3 inline-block cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
        + {{ t('teacher.courses.upload') }}
        <input type="file" class="hidden" @change="onFileSelected" />
      </label>
    </section>

    <button
      type="button"
      @click="removeCourse"
      class="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
    >
      {{ t('teacher.courses.deleteCourse') }}
    </button>
  </div>

  <p v-else-if="errorKey" role="alert" class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
    {{ showError(errorKey) }}
  </p>
</template>