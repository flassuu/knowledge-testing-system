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
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  blocked: 'bg-rose-50 text-rose-700',
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
        class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
      >
        <option value="all">{{ t('admin.participants.allCourses') }}</option>
        <option v-for="course in courses" :key="course" :value="course">
          {{ course }}
        </option>
      </select>
      <button
        type="button"
        @click="load"
        class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      >
        {{ t('admin.refresh') }}
      </button>
    </div>

    <p
      v-if="errorKey"
      role="alert"
      class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
    >
      {{ errorKey === 'NETWORK' ? t('auth.errors.network') : t('auth.errors.generic') }}
    </p>

    <p v-else-if="loading" class="mt-6 text-center text-sm text-slate-400">
      {{ t('common.loading') }}
    </p>

    <p
      v-else-if="filtered.length === 0"
      class="mt-6 text-center text-sm text-slate-400"
    >
      {{ t('admin.participants.empty') }}
    </p>

    <div v-else class="mt-4">
      <p class="text-xs font-semibold text-slate-500">
        {{ t('admin.participants.students', { count: filtered.length }) }}
      </p>
      <ul class="mt-2 space-y-2">
        <li
          v-for="entry in filtered"
          :key="`${entry.courseId}-${entry.studentId}`"
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p class="text-xs font-semibold text-slate-500">{{ entry.courseTitle }}</p>
          <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p class="truncate text-sm font-semibold text-slate-800">{{ entry.fullName }}</p>
            <p class="text-xs text-slate-400">@{{ entry.username }}</p>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="statusBadgeClass[entry.status]"
            >
              {{ t(`admin.status.${entry.status}`) }}
            </span>
          </div>
          <p class="mt-1 text-xs text-slate-400">
            {{ t('admin.participants.enrolledAt', { date: formatDate(entry.enrolledAt) }) }}
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>