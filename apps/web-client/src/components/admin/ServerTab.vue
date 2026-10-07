<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleCheck, Pause, Play, Trash2, TriangleAlert } from '@lucide/vue'
import { getSystemStats } from '../../api/admin'
import { ApiError } from '../../api/client'
import { listUsers, setUserStatus } from '../../api/users'
import type { LogEntry, PublicUser, SystemStats } from '../../api/types'
import AppButton from '../../components/common/AppButton.vue'
import AppCard from '../../components/common/AppCard.vue'
import SkeletonList from '../../components/common/SkeletonList.vue'
import { useLogStream } from '../../composables/logStream'
import { useToast } from '../../composables/toast'

/**
 * The admin's Server tab: what the server is doing, and the two things an admin
 * has to do while a class is running.
 *
 * The lines come from the same buffer the terminal console prints, so the two
 * never disagree. Restarting is deliberately not here — stopping a server is a
 * local act on the machine, and an HTTP request that killed the process serving
 * it would be a strange thing to be able to send.
 */
const { t } = useI18n()
const toast = useToast()
const stream = useLogStream()

const stats = ref<SystemStats | null>(null)
const pending = ref<PublicUser[]>([])
const loading = ref(true)
const errorKey = ref('')

/** Level filter: `null` means every level, which is the default. */
const level = ref<LogEntry['level'] | null>(null)
const paused = ref(false)
const visible = ref<HTMLElement | null>(null)

const LEVELS: Array<LogEntry['level'] | null> = ['error', 'warn', 'info', null]

const shown = computed(() => {
  if (level.value === null) return stream.entries.value
  return stream.entries.value.filter((entry) => entry.level === level.value)
})

/**
 * "Nothing yet" and "nothing at this level" are different sentences: with a
 * filter on and a full buffer behind it, claiming nothing was logged is a lie
 * the reader can disprove by clearing the filter.
 */
const emptyText = computed(() =>
  stream.entries.value.length === 0
    ? t('admin.server.empty')
    : t('admin.server.emptyFiltered'),
)

const counts = computed(() => {
  const totals: Record<string, number> = { error: 0, warn: 0, info: 0 }
  for (const entry of stream.entries.value) {
    if (entry.level === 'error' || entry.level === 'fatal') totals.error = (totals.error ?? 0) + 1
    else if (entry.level === 'warn') totals.warn = (totals.warn ?? 0) + 1
    else totals.info = (totals.info ?? 0) + 1
  }
  return totals
})

/** Same colour rules the terminal formatter uses, on the same level names. */
const levelClass: Record<LogEntry['level'], string> = {
  debug: 'text-on-surface-variant',
  info: 'text-on-surface',
  warn: 'text-on-warning-container',
  error: 'text-error',
  fatal: 'text-error',
}

function clock(entry: LogEntry): string {
  const date = new Date(entry.at)
  return date.toLocaleTimeString(undefined, { hour12: false })
}

/** A request line reads as one thing; anything else as its message. */
function text(entry: LogEntry): string {
  const request = entry.fields.req as
    | { method?: string; url?: string; statusCode?: number }
    | undefined
  if (request) return `→ ${request.method ?? '?'} ${request.url ?? '?'}${request.statusCode ? ` ${request.statusCode}` : ''}`
  const error = entry.fields.err as { message?: string } | undefined
  return `${entry.msg}${error?.message ? `: ${error.message}` : ''}`
}

function scrollToEnd(): void {
  const element = visible.value
  if (!element) return
  element.scrollTop = element.scrollHeight
}

async function load(): Promise<void> {
  loading.value = true
  errorKey.value = ''
  try {
    const [loadedStats, users] = await Promise.all([
      getSystemStats(),
      listUsers({ status: 'pending' }),
    ])
    stats.value = loadedStats
    pending.value = users
  } catch (error) {
    errorKey.value = error instanceof ApiError ? error.code : ''
  } finally {
    loading.value = false
  }
}

async function setStatus(user: PublicUser, status: 'approved' | 'blocked'): Promise<void> {
  try {
    await setUserStatus(user.id, status)
    pending.value = pending.value.filter((candidate) => candidate.id !== user.id)
    toast.success(
      status === 'approved'
        ? t('admin.server.approvedToast', { name: user.fullName })
        : t('admin.server.blockedToast', { name: user.fullName }),
    )
  } catch (error) {
    toast.error(
      t(
        `admin.errors.${
          error instanceof ApiError && error.code === 'NETWORK' ? 'network' : 'generic'
        }`,
      ),
    )
  }
}

function toggleLevel(next: LogEntry['level'] | null): void {
  // Clicking the active filter clears it: a filter that has to be found in order
  // to be removed is a worse filter than no filter.
  level.value = level.value === next ? null : next
  requestAnimationFrame(scrollToEnd)
}

onMounted(() => {
  stream.connect()
  void load()
  requestAnimationFrame(scrollToEnd)
})
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-on-surface">{{ t('admin.server.title') }}</h3>
        <span
          class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          :class="
            stream.connected.value
              ? 'bg-success-container text-on-success-container'
              : 'bg-surface-container-high text-on-surface-variant'
          "
        >
          <span
            class="size-1.5 rounded-full"
            :class="stream.connected.value ? 'bg-success' : 'bg-outline'"
          />
          {{ stream.connected.value ? t('admin.server.live') : t('admin.server.reconnecting') }}
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <AppButton
          v-for="item in LEVELS"
          :key="String(item)"
          variant="secondaryPlain"
          size="sm"
          :aria-pressed="level === item"
          :class="item === null ? 'font-semibold' : ''"
          @click="toggleLevel(item)"
        >
          {{ item === null ? t('admin.server.allLevels') : t(`admin.server.level.${item}`) }}
          <span
            v-if="item !== null && counts[item]"
            class="rounded-full bg-surface-container-highest px-1.5 text-[10px] font-bold"
          >
            {{ counts[item] }}
          </span>
        </AppButton>
        <AppButton
          variant="ghost"
          icon
          size="sm"
          :aria-label="paused ? t('admin.server.resume') : t('admin.server.pause')"
          :title="paused ? t('admin.server.resume') : t('admin.server.pause')"
          @click="paused = !paused"
        >
          <Play v-if="paused" class="size-4" aria-hidden="true" />
          <Pause v-else class="size-4" aria-hidden="true" />
        </AppButton>
        <AppButton
          variant="ghost"
          icon
          size="sm"
          :aria-label="t('admin.server.clear')"
          :title="t('admin.server.clear')"
          @click="stream.clear()"
        >
          <Trash2 class="size-4" aria-hidden="true" />
        </AppButton>
      </div>
    </div>

    <!-- The console. A fixed height with its own scroll: the page must not grow
         as lines arrive. -->
    <div
      ref="visible"
      class="h-80 overflow-y-auto rounded-[var(--radius-card)] bg-surface-container p-3 font-mono text-xs leading-relaxed"
      role="log"
      aria-live="polite"
      :aria-label="t('admin.server.title')"
    >
      <p v-if="paused" class="mb-2 flex items-center gap-1.5 text-on-surface-variant">
        <TriangleAlert class="size-3.5" aria-hidden="true" />
        {{ t('admin.server.pausedHint') }}
      </p>
      <p v-if="shown.length === 0" class="text-on-surface-variant">
        {{ emptyText }}
      </p>
      <p
        v-for="entry in shown"
        :key="entry.seq"
        class="flex gap-2 whitespace-pre-wrap break-all"
        :class="levelClass[entry.level]"
      >
        <span class="shrink-0 opacity-70">{{ clock(entry) }}</span>
        <span class="shrink-0 opacity-70">{{ entry.level }}</span>
        <span class="min-w-0">{{ text(entry) }}</span>
      </p>
    </div>

    <p
      v-if="errorKey"
      role="alert"
      class="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
    >
      {{ t(`admin.errors.${errorKey === 'NETWORK' ? 'network' : 'generic'}`) }}
    </p>

    <SkeletonList v-else-if="loading" :rows="2" />

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <AppCard as="section">
        <h3 class="text-sm font-semibold text-on-surface">
          {{ t('admin.server.statusTitle') }}
        </h3>
        <dl class="mt-3 space-y-1.5 text-sm">
          <div class="flex justify-between gap-3">
            <dt class="truncate text-on-surface-variant">
              {{ t('admin.system.version') }}
            </dt>
            <dd class="font-semibold text-on-surface">{{ stats?.version ?? '—' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="truncate text-on-surface-variant">
              {{ t('admin.system.uptime') }}
            </dt>
            <dd class="font-semibold text-on-surface">
              {{ stats ? Math.round(stats.uptimeMs / 1000) : 0 }}s
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="truncate text-on-surface-variant">
              {{ t('admin.system.database') }}
            </dt>
            <dd>
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                :class="
                  stats?.database === 'ok'
                    ? 'bg-success-container text-on-success-container'
                    : 'bg-error-container text-on-error-container'
                "
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
        <p class="mt-3 text-xs text-on-surface-variant">{{ t('admin.server.restartHint') }}</p>
      </AppCard>

      <!-- Approving here is the same call the Users tab makes; in a lesson it is
           the difference between a student waiting and a student working. -->
      <AppCard as="section">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-on-surface">
            {{ t('admin.server.waitingTitle') }}
          </h3>
          <AppButton variant="ghost" size="sm" @click="load">
            {{ t('common.refresh') }}
          </AppButton>
        </div>
        <ul v-if="pending.length" class="mt-3 space-y-2">
          <li
            v-for="user in pending"
            :key="user.id"
            class="flex items-center justify-between gap-2"
          >
            <span class="min-w-0 truncate text-sm text-on-surface">{{ user.fullName }}</span>
            <span class="flex shrink-0 items-center gap-1">
              <AppButton
                variant="secondaryMuted"
                size="sm"
                :aria-label="t('admin.server.approve', { name: user.fullName })"
                @click="setStatus(user, 'approved')"
              >
                <CircleCheck class="size-3.5" aria-hidden="true" />
                {{ t('admin.server.approveShort') }}
              </AppButton>
              <AppButton
                variant="ghostDanger"
                size="sm"
                :aria-label="t('admin.server.block', { name: user.fullName })"
                @click="setStatus(user, 'blocked')"
              >
                {{ t('admin.server.blockShort') }}
              </AppButton>
            </span>
          </li>
        </ul>
        <p v-else class="mt-3 text-xs text-on-surface-variant">
          {{ t('admin.server.nobodyWaiting') }}
        </p>
      </AppCard>
    </div>
  </section>
</template>