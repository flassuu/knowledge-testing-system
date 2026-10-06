<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Library, Plus } from '@lucide/vue'
import { ApiError } from '../../api/client'
import EmptyState from '../common/EmptyState.vue'
import SkeletonList from '../common/SkeletonList.vue'
import { createCourse, deleteCourse, listCourses } from '../../api/courses'
import type { CourseSummary } from '../../api/types'
import CourseDetails from './CourseDetails.vue'
import { useConfirm } from '../../composables/confirm'
import { useToast } from '../../composables/toast'
import AppButton from '../../components/common/AppButton.vue'
import AppCard from '../../components/common/AppCard.vue'
import AppInput from '../../components/common/AppInput.vue'

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
      <AppButton variant="success" v-if="!creating && !openCourseId" @click="creating = true">
        <Plus class="size-3.5" aria-hidden="true" />
        {{ t('teacher.courses.newCourse') }}
      </AppButton>
    </div>

    <CourseDetails
      v-if="openCourseId"
      :course-id="openCourseId"
      @close="openCourseId = null; load()"
    />

    <form v-else-if="creating" class="mt-4 space-y-3 rounded-xl border border-outline-variant bg-surface-container p-4" @submit.prevent="create">
      <label class="block">
        <span class="text-xs font-semibold text-on-surface-variant">{{ t('teacher.courses.title') }}</span>
        <AppInput v-model="newTitle" type="text" class="mt-1" />
      </label>
      <label class="block">
        <span class="text-xs font-semibold text-on-surface-variant">{{ t('teacher.courses.description') }}</span>
        <textarea
          v-model="newDescription"
          rows="2"
          class="mt-1 w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:border-primary"
        />
      </label>
      <p v-if="createError" role="alert" class="text-sm text-error">
        {{ createError === 'titleRequired' ? t('teacher.form.err.titleRequired') : showError(createError) }}
      </p>
      <div class="flex gap-2">
        <AppButton variant="primary" type="submit">
          {{ t('teacher.courses.save') }}
        </AppButton>
        <AppButton variant="secondaryMuted" @click="creating = false; createError = ''">
          {{ t('teacher.tests.cancel') }}
        </AppButton>
      </div>
    </form>

    <template v-else>
      <p v-if="errorKey" role="alert" class="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
        {{ showError(errorKey) }}
      </p>
      <SkeletonList v-else-if="loading" class="mt-4" :rows="3" />
      <EmptyState
        v-else-if="courses.length === 0"
        class="mt-4"
        :icon="Library"
        :title="t('teacher.courses.emptyTitle')"
        :description="t('teacher.courses.emptyHint')"
        :action-label="t('teacher.courses.newCourse')"
        @action="creating = true"
      />
      <ul v-else class="mt-4 space-y-2">
        <AppCard
          as="li"
          v-for="course in courses"
          :key="course.id"
          class="flex flex-col gap-3 shadow-sm sm:flex-row sm:items-center"
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
          <AppButton
            type="button"
            @click="remove(course)"
            variant="dangerSecondary" size="sm" class="shrink-0"
          >
            {{ t('teacher.tests.delete') }}
          </AppButton>
        </AppCard>
      </ul>
    </template>
  </section>
</template>