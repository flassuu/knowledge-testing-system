<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp } from '@lucide/vue'
import { listParticipants } from '../../api/admin'
import { ApiError } from '../../api/client'
import { useTableSort } from '../../composables/tableSort'
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

const statusRank: Record<UserStatus, number> = { pending: 0, approved: 1, blocked: 2 }

const { sorted, toggle, ariaSort } = useTableSort(
  filtered,
  {
    course: (entry) => entry.courseTitle,
    student: (entry) => entry.fullName,
    enrolled: (entry) => entry.enrolledAt,
    status: (entry) => statusRank[entry.status],
  },
  'course',
)

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
        class="rounded-lg border border-outline bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
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

    <p
      v-else-if="loading"
      class="mt-6 text-center text-sm text-on-surface-variant"
    >
      {{ t('common.loading') }}
    </p>

    <p
      v-else-if="filtered.length === 0"
      class="mt-6 text-center text-sm text-on-surface-variant"
    >
      {{ t('admin.participants.empty') }}
    </p>

    <template v-else>
      <p class="mt-4 text-xs font-semibold text-on-surface-variant">
        {{ t('admin.participants.students', { count: filtered.length }) }}
      </p>

      <!-- wide screens: sortable table -->
      <div
        class="mt-2 hidden overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container shadow-sm sm:block"
      >
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-outline-variant text-left text-xs uppercase tracking-wide text-on-surface-variant">
              <th scope="col" class="px-3 py-2.5" :aria-sort="ariaSort('course')">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 font-semibold hover:text-on-surface"
                  @click="toggle('course')"
                >
                  {{ t('admin.col.course') }}
                  <ArrowDown v-if="ariaSort('course') === 'ascending'" class="size-3" aria-hidden="true" />
                  <ArrowUp v-else-if="ariaSort('course') === 'descending'" class="size-3" aria-hidden="true" />
                </button>
              </th>
              <th scope="col" class="px-3 py-2.5" :aria-sort="ariaSort('student')">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 font-semibold hover:text-on-surface"
                  @click="toggle('student')"
                >
                  {{ t('admin.col.student') }}
                  <ArrowDown v-if="ariaSort('student') === 'ascending'" class="size-3" aria-hidden="true" />
                  <ArrowUp v-else-if="ariaSort('student') === 'descending'" class="size-3" aria-hidden="true" />
                </button>
              </th>
              <th scope="col" class="px-3 py-2.5" :aria-sort="ariaSort('enrolled')">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 font-semibold hover:text-on-surface"
                  @click="toggle('enrolled')"
                >
                  {{ t('admin.col.enrolled') }}
                  <ArrowDown v-if="ariaSort('enrolled') === 'ascending'" class="size-3" aria-hidden="true" />
                  <ArrowUp v-else-if="ariaSort('enrolled') === 'descending'" class="size-3" aria-hidden="true" />
                </button>
              </th>
              <th scope="col" class="px-3 py-2.5" :aria-sort="ariaSort('status')">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 font-semibold hover:text-on-surface"
                  @click="toggle('status')"
                >
                  {{ t('admin.col.status') }}
                  <ArrowDown v-if="ariaSort('status') === 'ascending'" class="size-3" aria-hidden="true" />
                  <ArrowUp v-else-if="ariaSort('status') === 'descending'" class="size-3" aria-hidden="true" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in sorted"
              :key="`${entry.courseId}-${entry.studentId}`"
              class="border-b border-outline-variant last:border-0 transition-colors hover:bg-surface-container-high"
            >
              <td class="px-3 py-2.5 font-medium text-on-surface">{{ entry.courseTitle }}</td>
              <td class="px-3 py-2.5">
                <p class="truncate font-semibold text-on-surface">{{ entry.fullName }}</p>
                <p class="truncate text-xs text-on-surface-variant">@{{ entry.username }}</p>
              </td>
              <td class="px-3 py-2.5 text-on-surface-variant">
                {{ formatDate(entry.enrolledAt) }}
              </td>
              <td class="px-3 py-2.5">
                <span
                  class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  :class="statusBadgeClass[entry.status]"
                >
                  {{ t(`admin.status.${entry.status}`) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- narrow screens: cards -->
      <ul class="mt-3 space-y-2 sm:hidden">
        <li
          v-for="entry in sorted"
          :key="`${entry.courseId}-${entry.studentId}`"
          class="rounded-2xl border border-outline-variant bg-surface-container p-4 shadow-sm"
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
    </template>
  </section>
</template>