<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getSystemStats } from '../../api/admin'
import { ApiError } from '../../api/client'
import type { SystemStats, TableCounts } from '../../api/types'

const { t } = useI18n()

const stats = ref<SystemStats | null>(null)
const loading = ref(false)
const errorKey = ref('')

const countLabels: Array<{ key: keyof TableCounts; label: string }> = [
  { key: 'users', label: 'users' },
  { key: 'admins', label: 'admins' },
  { key: 'teachers', label: 'teachers' },
  { key: 'students', label: 'students' },
  { key: 'pendingUsers', label: 'pending' },
  { key: 'approvedUsers', label: 'approved' },
  { key: 'blockedUsers', label: 'blocked' },
  { key: 'tests', label: 'tests' },
  { key: 'questions', label: 'questions' },
  { key: 'courses', label: 'courses' },
  { key: 'enrollments', label: 'enrollments' },
  { key: 'materials', label: 'materials' },
]

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

async function load() {
  loading.value = true
  errorKey.value = ''
  try {
    stats.value = await getSystemStats()
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
    <div class="flex items-center justify-end">
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

    <div v-else-if="stats" class="mt-4 space-y-4">
      <section class="rounded-xl border border-slate-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-700">{{ t('admin.system.server') }}</h3>
        <dl class="mt-3 space-y-1.5 text-sm">
          <div class="flex justify-between">
            <dt class="text-slate-500">{{ t('admin.system.version') }}</dt>
            <dd class="font-semibold text-slate-800">{{ stats.version }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">{{ t('admin.system.uptime') }}</dt>
            <dd class="font-semibold text-slate-800">{{ formatUptime(stats.uptimeMs) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">{{ t('admin.system.schema') }}</dt>
            <dd class="font-semibold text-slate-800">{{ stats.schemaVersion }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-500">{{ t('admin.system.database') }}</dt>
            <dd>
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                :class="stats.database === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
              >
                {{ stats.database === 'ok' ? t('admin.system.databaseOk') : t('admin.system.databaseError') }}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-700">{{ t('admin.system.counts') }}</h3>
        <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
          <div
            v-for="item in countLabels"
            :key="item.key"
            class="flex items-baseline justify-between gap-2"
          >
            <dt class="truncate text-slate-500">{{ t(`admin.system.${item.label}`) }}</dt>
            <dd class="font-semibold tabular-nums text-slate-800">{{ stats.counts[item.key] }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </section>
</template>