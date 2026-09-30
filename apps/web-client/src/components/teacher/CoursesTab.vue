<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiError } from '../../api/client'
import { createCourse, deleteCourse, listCourses } from '../../api/courses'
import type { CourseSummary } from '../../api/types'
import CourseDetails from './CourseDetails.vue'
import { useConfirm } from '../../composables/confirm'
import { useToast } from '../../composables/toast'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

const courses = ref<CourseSummary[]>([])
const loading = ref(false)
const errorKey = ref('')

const creating = ref(false)
const newTitle = ref('')
const newDescription = ref('')
const createError = ref('')

const openCourseId = ref<string | null>(null)

function apiErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.code === 'NETWORK') return 'network'
  if (error.code === 'VALIDATION') return 'validation'
  return 'generic'
}

function showError(key: string): string {
  return key === 'generic' ? t('teacher.errors.generic') : t(`teacher.errors.${key}`)
}

async function load() {
  loading.value = true
  errorKey.value = ''
  try {
    courses.value = await listCourses()
  } catch (error) {
    errorKey.value = apiErrorKey(error)
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!newTitle.value.trim()) {
    createError.value = 'titleRequired'
    return
  }
  createError.value = ''
  try {
    await createCourse({ title: newTitle.value.trim(), description: newDescription.value.trim() })
    toast.success(t('teacher.courses.created'))
    newTitle.value = ''
    newDescription.value = ''
    creating.value = false
    await load()
  } catch (error) {
    createError.value = apiErrorKey(error)
  }
}

async function remove(course: CourseSummary) {
  if (!(await confirm({ message: t('teacher.courses.deleteConfirm') }))) return
  try {
    await deleteCourse(course.id)
    toast.success(t('teacher.courses.deleted'))
    await load()
  } catch (error) {
    errorKey.value = apiErrorKey(error)
  }
}

onMounted(load)
</script>

<template>
  <section>
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-on-surface">{{ t('teacher.courses.heading') }}</h3>
      <button
        v-if="!creating && !openCourseId"
        type="button"
        @click="creating = true"
        class="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-on-success hover:opacity-90"
      >
        + {{ t('teacher.courses.newCourse') }}
      </button>
    </div>

    <CourseDetails
      v-if="openCourseId"
      :course-id="openCourseId"
      @close="openCourseId = null; load()"
    />

    <form v-else-if="creating" class="mt-4 space-y-3 rounded-xl border border-outline-variant bg-surface-container p-4" @submit.prevent="create">
      <label class="block">
        <span class="text-xs font-semibold text-on-surface-variant">{{ t('teacher.courses.title') }}</span>
        <input
          v-model="newTitle"
          type="text"
          class="mt-1 w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-outline"
        />
      </label>
      <label class="block">
        <span class="text-xs font-semibold text-on-surface-variant">{{ t('teacher.courses.description') }}</span>
        <textarea
          v-model="newDescription"
          rows="2"
          class="mt-1 w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-outline"
        />
      </label>
      <p v-if="createError" role="alert" class="text-sm text-error">
        {{ createError === 'titleRequired' ? t('teacher.form.err.titleRequired') : showError(createError) }}
      </p>
      <div class="flex gap-2">
        <button type="submit" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90">
          {{ t('teacher.courses.save') }}
        </button>
        <button
          type="button"
          @click="creating = false; createError = ''"
          class="rounded-lg border border-outline bg-surface px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
        >
          {{ t('teacher.tests.cancel') }}
        </button>
      </div>
    </form>

    <template v-else>
      <p v-if="errorKey" role="alert" class="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
        {{ showError(errorKey) }}
      </p>
      <p v-else-if="loading" class="mt-6 text-center text-sm text-on-surface-variant">{{ t('common.loading') }}</p>
      <p v-else-if="courses.length === 0" class="mt-6 text-center text-sm text-on-surface-variant">
        {{ t('teacher.courses.empty') }}
      </p>
      <ul v-else class="mt-4 space-y-2">
        <li
          v-for="course in courses"
          :key="course.id"
          class="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 shadow-sm sm:flex-row sm:items-center"
        >
          <button
            type="button"
            class="min-w-0 flex-1 text-left"
            @click="openCourseId = course.id"
          >
            <p class="truncate text-sm font-semibold text-on-surface">{{ course.title }}</p>
            <p class="mt-0.5 text-xs text-on-surface-variant">
              {{ t('teacher.courses.studentsCount', { count: course.studentsCount }) }} ·
              {{ t('teacher.courses.testsCount', { count: course.testsCount }) }} ·
              {{ t('teacher.courses.materialsCount', { count: course.materialsCount }) }}
            </p>
          </button>
          <button
            type="button"
            @click="remove(course)"
            class="shrink-0 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-error-container hover:bg-error-container"
          >
            {{ t('teacher.tests.delete') }}
          </button>
        </li>
      </ul>
    </template>
  </section>
</template>