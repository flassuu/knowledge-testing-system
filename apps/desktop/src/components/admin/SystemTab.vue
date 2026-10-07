<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { TriangleAlert } from '@lucide/vue'
import { getSystemStats } from '../../api/admin'
import { ApiError } from '../../api/client'
import { getSettings, updateSettings } from '../../api/settings'
import SkeletonList from '../common/SkeletonList.vue'
import type { ServerSettings, SystemStats, TableCounts } from '../../api/types'
import AppButton from '../common/AppButton.vue'
import AppCard from '../common/AppCard.vue'
import AppInput from '../common/AppInput.vue'
import { isReachableFromPhone } from '../../utils/links'

/**
 * The one setting in this app that a stranger in another room depends on: the
 * address that ends up in the join link and in the QR code. It is an origin and
 * nothing else - no path, no query - because the client is served from the root
 * and a wrong suffix would only be discovered in the middle of a lesson.
 */
const { t } = useI18n()

const stats = ref<SystemStats | null>(null)
const loading = ref(false)
const errorKey = ref('')

const settings = ref<ServerSettings | null>(null)
const draftUrl = ref('')
const saving = ref(false)
const saveErrorKey = ref('')

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

/** The trimmed draft, or null for "not configured". */
const draft = computed(() => draftUrl.value.trim())

/** Nothing typed yet, or exactly what is already saved: there is nothing to do. */
const dirty = computed(
  () => (settings.value?.publicBaseUrl ?? '') !== (draft.value === '' ? '' : draft.value),
)

/** A warning while typing, before the server gets a chance to reject it. */
const draftUnreachable = computed(
  () => draft.value !== '' && !isReachableFromPhone(draft.value),
)

function useSuggestion(address: string): void {
  draftUrl.value = address
  saveErrorKey.value = ''
}

async function save(): Promise<void> {
  if (saving.value) return
  saving.value = true
  saveErrorKey.value = ''
  try {
    settings.value = await updateSettings(draft.value === '' ? null : draft.value)
    draftUrl.value = settings.value.publicBaseUrl ?? ''
  } catch (error) {
    if (!(error instanceof ApiError)) saveErrorKey.value = 'generic'
    else if (error.code === 'NETWORK') saveErrorKey.value = 'network'
    else if (error.status === 400) saveErrorKey.value = 'validation'
    else saveErrorKey.value = 'generic'
  } finally {
    saving.value = false
  }
}

async function clear(): Promise<void> {
  draftUrl.value = ''
  await save()
}

async function load(): Promise<void> {
  loading.value = true
  errorKey.value = ''
  try {
    const [loadedStats, loadedSettings] = await Promise.all([
      getSystemStats(),
      getSettings(),
    ])
    stats.value = loadedStats
    settings.value = loadedSettings
    draftUrl.value = loadedSettings.publicBaseUrl ?? ''
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
      <AppButton variant="secondary" @click="load">
        {{ t('admin.refresh') }}
      </AppButton>
    </div>

    <p
      v-if="errorKey"
      role="alert"
      class="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
    >
      {{ errorKey === 'NETWORK' ? t('auth.errors.network') : t('auth.errors.generic') }}
    </p>

    <SkeletonList v-else-if="loading" class="mt-4" :rows="3" />

    <div v-else class="mt-4 space-y-4">
      <!-- Public address: what a student types or scans. -->
      <AppCard as="section">
        <h3 class="text-sm font-semibold text-on-surface">
          {{ t('admin.system.publicTitle') }}
        </h3>
        <p class="mt-1 text-xs text-on-surface-variant">
          {{ t('admin.system.publicHint') }}
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-xs text-on-surface-variant">
            {{ t('admin.system.publicCurrent') }}
          </span>
          <code
            class="max-w-full truncate rounded-full bg-surface-container-high px-2.5 py-1 font-mono text-xs text-on-surface"
          >
            {{ settings?.publicBaseUrl ?? t('admin.system.publicUnset') }}
          </code>
        </div>

        <form class="mt-3 space-y-3" @submit.prevent="save">
          <div>
            <label class="text-xs font-medium text-on-surface-variant" for="public-base-url">
              {{ t('admin.system.publicLabel') }}
            </label>
            <AppInput
              id="public-base-url"
              v-model="draftUrl"
              type="url"
              inputmode="url"
              autocomplete="off"
              spellcheck="false"
              :placeholder="t('admin.system.publicPlaceholder')"
              class="mt-1 font-mono"
            />
          </div>

          <ul v-if="settings?.suggestions.length" class="flex flex-wrap gap-1.5">
            <li v-for="address in settings.suggestions" :key="address">
              <AppButton
                variant="secondaryPlain"
                size="sm"
                class="font-mono"
                :aria-pressed="draft === address"
                @click="useSuggestion(address)"
              >
                {{ address }}
              </AppButton>
            </li>
          </ul>

          <p
            v-if="draftUnreachable"
            class="flex items-start gap-2 rounded-[var(--radius-control)] bg-warning-container px-3 py-2 text-xs text-on-warning-container"
          >
            <TriangleAlert class="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>{{ t('admin.system.publicUnreachable') }}</span>
          </p>

          <p
            v-if="saveErrorKey"
            role="alert"
            class="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
          >
            {{ t(`admin.errors.${saveErrorKey}`) }}
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <AppButton
              type="submit"
              variant="primary"
              :disabled="saving || !dirty"
            >
              {{ t('admin.system.publicSave') }}
            </AppButton>
            <AppButton
              type="button"
              variant="secondaryMuted"
              :disabled="saving || !settings?.publicBaseUrl"
              @click="clear"
            >
              {{ t('admin.system.publicClear') }}
            </AppButton>
          </div>
        </form>
      </AppCard>

      <AppCard as="section">
        <h3 class="text-sm font-semibold text-on-surface">{{ t('admin.system.server') }}</h3>
        <dl class="mt-3 space-y-1.5 text-sm">
          <div class="flex justify-between">
            <dt class="text-on-surface-variant">{{ t('admin.system.version') }}</dt>
            <dd class="font-semibold text-on-surface">{{ stats?.version }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-on-surface-variant">{{ t('admin.system.uptime') }}</dt>
            <dd class="font-semibold text-on-surface">
              {{ stats ? formatUptime(stats.uptimeMs) : '' }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-on-surface-variant">{{ t('admin.system.schema') }}</dt>
            <dd class="font-semibold text-on-surface">{{ stats?.schemaVersion }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-on-surface-variant">{{ t('admin.system.database') }}</dt>
            <dd>
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                :class="stats?.database === 'ok' ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'"
              >
                {{
                  stats?.database === 'ok'
                    ? t('admin.system.databaseOk')
                    : t('admin.system.databaseError')
                }}
              </span>
            </dd>
          </div>
        </dl>
      </AppCard>

      <AppCard as="section">
        <h3 class="text-sm font-semibold text-on-surface">{{ t('admin.system.counts') }}</h3>
        <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
          <div
            v-for="item in countLabels"
            :key="item.key"
            class="flex items-baseline justify-between gap-2"
          >
            <dt class="truncate text-on-surface-variant">{{ t(`admin.system.${item.label}`) }}</dt>
            <dd class="font-semibold tabular-nums text-on-surface">
              {{ stats?.counts[item.key] ?? 0 }}
            </dd>
          </div>
        </dl>
      </AppCard>
    </div>
  </section>
</template>