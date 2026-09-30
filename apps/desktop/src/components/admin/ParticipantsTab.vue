<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listParticipants } from '../../api/admin'
import { ApiError } from '../../api/client'
import type { ParticipationEntry, UserStatus } from '../../api/types'

const { t } = useI18n()

const participants = ref<ParticipationEntry[]>([])
const loading = ref(false)
const errorKey = ref('')
const courseFilter = ref('all')

const courses = computed(() => {
  const titles = new Set(participants.value.map((entry) => entry.courseTitle))
  return [...titles].sort()
})

const filtered = computed(() =>
  courseFilter.value === 'all'
    ? participants.value
    : participants.value.filter((entry) => entry.courseTitle === courseFilter.value),
)

const statusBadgeClass: Record<UserStatus, string> = {
  pending: 'bg-warning-container text-on-warning-container',
  approved: 'bg-success-container text-on-success-container',
  blocked: 'bg-error-container text-on-error-container',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

async function load() {
  loading.value = true
  errorKey.value = ''
  try {
    participants.value = await listParticipants()
  } catch (error) {
    errorKey.value = error instanceof ApiError ? error.code : ''
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section>
    <div class="flex items-center justify-between gap-2">
      <select
        v-model="courseFilter"
        class="rounded-lg border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-outline"
      >
        <option value="all">{{ t('admin.participants.allCourses') }}</option>
        <option v-for="course in courses" :key="course" :value="course">
          {{ course }}
        </option>
      </select>
      <button
        type="button"
        @click="load"
        class="rounded-lg border border-outline bg-surface px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
      >
        {{ t('admin.refresh') }}
      </button>
    </div>

    <p
      v-if="errorKey"
      role="alert"
      class="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
    >
      {{ errorKey === 'NETWORK' ? t('auth.errors.network') : t('auth.errors.generic') }}
    </p>

    <p v-else-if="loading" class="mt-6 text-center text-sm text-on-surface-variant">
      {{ t('common.loading') }}
    </p>

    <p
      v-else-if="filtered.length === 0"
      class="mt-6 text-center text-sm text-on-surface-variant"
    >
      {{ t('admin.participants.empty') }}
    </p>

    <div v-else class="mt-4">
      <p class="text-xs font-semibold text-on-surface-variant">
        {{ t('admin.participants.students', { count: filtered.length }) }}
      </p>
      <ul class="mt-2 space-y-2">
        <li
          v-for="entry in filtered"
          :key="`${entry.courseId}-${entry.studentId}`"
          class="rounded-xl border border-outline-variant bg-surface-container p-4 shadow-sm"
        >
          <p class="text-xs font-semibold text-on-surface-variant">{{ entry.courseTitle }}</p>
          <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p class="truncate text-sm font-semibold text-on-surface">{{ entry.fullName }}</p>
            <p class="text-xs text-on-surface-variant">@{{ entry.username }}</p>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="statusBadgeClass[entry.status]"
            >
              {{ t(`admin.status.${entry.status}`) }}
            </span>
          </div>
          <p class="mt-1 text-xs text-on-surface-variant">
            {{ t('admin.participants.enrolledAt', { date: formatDate(entry.enrolledAt) }) }}
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>