<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CircleCheck,
  CircleX,
  Copy,
  Link2,
  Pause,
  Play,
  Radio,
  RotateCw,
  Square,
  Users,
} from '@lucide/vue'
import { ApiError } from '../../api/client'
import {
  listSessions,
  setSessionStatus,
  startSession,
  type LiveSessionStatus,
  type SessionSummary,
} from '../../api/sessions'
import type { TestSummary } from '../../api/types'
import EmptyState from '../common/EmptyState.vue'
import SkeletonList from '../common/SkeletonList.vue'
import TestPicker from './TestPicker.vue'
import { useConfirm } from '../../composables/confirm'
import { useSessionChannel } from '../../composables/sessionChannel'
import { useToast } from '../../composables/toast'

const props = defineProps<{
  tests: TestSummary[]
}>()

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

const sessions = ref<SessionSummary[]>([])
const selectedId = ref('')
const loading = ref(false)
const errorKey = ref('')
const actionError = ref('')
const starting = ref(false)
const startingTestId = ref('')
const showStart = ref(false)
const copied = ref(false)
const linkCopied = ref(false)

/** The server pushes the board over a WebSocket; polling is the fallback. */
const channel = useSessionChannel()
const participants = channel.participants
const boardStatus = channel.status

const selected = computed(() => sessions.value.find((session) => session.id === selectedId.value) ?? null)
const submittedCount = computed(
  () => participants.value.filter((entry) => entry.status !== 'joined').length,
)
const sortedParticipants = computed(() =>
  [...participants.value].sort((left, right) => {
    if (left.status === 'joined') return 1
    if (right.status === 'joined') return -1
    return (right.percent ?? -1) - (left.percent ?? -1)
  }),
)

const statusChip: Record<LiveSessionStatus, string> = {
  active: 'bg-success-container text-on-success-container',
  paused: 'bg-warning-container text-on-warning-container',
  finished: 'bg-surface-container-highest text-on-surface-variant',
}

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return t('teacher.errors.generic')
  if (error.code === 'NETWORK') return t('teacher.errors.network')
  if (error.code === 'VALIDATION' || error.code === 'INVALID_OPERATION') return t('teacher.errors.validation')
  if (error.code === 'CONFLICT') return t('teacher.errors.conflict')
  if (error.code === 'NOT_FOUND') return t('teacher.errors.notFound')
  return t('teacher.errors.generic')
}

async function load(): Promise<void> {
  loading.value = true
  errorKey.value = ''
  try {
    sessions.value = await listSessions()
    if (!selectedId.value || !sessions.value.some((session) => session.id === selectedId.value)) {
      selectedId.value = sessions.value[0]?.id ?? ''
    }
  } catch (error) {
    errorKey.value = errorMessage(error)
  } finally {
    loading.value = false
  }
}

async function start(testId: string): Promise<void> {
  starting.value = true
  actionError.value = ''
  try {
    const session = await startSession(testId)
    showStart.value = false
    startingTestId.value = ''
    toast.success(t('teacher.live.started', { code: session.joinCode }))
    await load()
    selectedId.value = session.id
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    starting.value = false
  }
}

async function changeStatus(status: LiveSessionStatus): Promise<void> {
  if (!selected.value) return
  if (status === 'finished') {
    const outstanding = participants.value.filter((entry) => entry.status === 'joined').length
    const ok = await confirm({
      message:
        outstanding > 0
          ? t('teacher.live.finishConfirmOutstand', { count: outstanding })
          : t('teacher.live.finishConfirm'),
    })
    if (!ok) return
  }
  actionError.value = ''
  try {
    await setSessionStatus(selected.value.id, status)
    await load()
  } catch (error) {
    actionError.value = errorMessage(error)
  }
}

async function writeClipboard(value: string, flag: 'code' | 'link'): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    if (flag === 'code') copied.value = true
    else linkCopied.value = true
    window.setTimeout(() => {
      if (flag === 'code') copied.value = false
      else linkCopied.value = false
    }, 1500)
  } catch {
    // Clipboard is blocked in some contexts; the value is on screen anyway.
    actionError.value = t('teacher.live.copyFailed')
  }
}

function copyCode(): Promise<void> {
  return selected.value ? writeClipboard(selected.value.joinCode, 'code') : Promise.resolve()
}

/** A link the teacher can paste into a chat; the student lands pre-filled. */
function joinLink(): string {
  if (!selected.value) return ''
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('join', selected.value.joinCode)
  return url.toString()
}

function copyLink(): Promise<void> {
  return writeClipboard(joinLink(), 'link')
}

watch(selectedId, (id) => {
  if (id) channel.connect(id)
  else channel.disconnect()
})

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-base font-semibold text-on-surface">{{ t('teacher.live.heading') }}</h3>
      <button
        v-if="!showStart"
        type="button"
        @click="showStart = !showStart"
        class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90"
      >
        <Radio class="size-3.5" aria-hidden="true" />
        {{ t('teacher.live.start') }}
      </button>
    </div>

    <p
      v-if="errorKey"
      role="alert"
      class="rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container"
    >
      {{ errorKey }}
    </p>

    <section
      v-if="showStart"
      class="rounded-2xl border border-outline-variant bg-surface-container p-4"
    >
      <h4 class="text-sm font-semibold text-on-surface">{{ t('teacher.live.startTitle') }}</h4>
      <p class="mt-1 text-xs text-on-surface-variant">{{ t('teacher.live.startHint') }}</p>
      <TestPicker
        :tests="props.tests"
        :busy="starting"
        @select="startingTestId = $event"
      />
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          :disabled="!startingTestId || starting"
          @click="start(startingTestId)"
          class="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-on-success transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Play class="size-3.5" aria-hidden="true" />
          {{ starting ? t('common.loading') : t('teacher.live.startRun') }}
        </button>
        <button
          type="button"
          @click="showStart = false; startingTestId = ''"
          class="rounded-lg border border-outline bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high"
        >
          {{ t('common.cancel') }}
        </button>
      </div>
    </section>

    <p
      v-if="actionError"
      role="alert"
      class="rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container"
    >
      {{ actionError }}
    </p>

    <SkeletonList v-if="loading" :rows="2" />

    <EmptyState
      v-else-if="sessions.length === 0"
      :icon="Radio"
      :title="t('teacher.live.emptyTitle')"
      :description="t('teacher.live.emptyHint')"
      :action-label="t('teacher.live.start')"
      @action="showStart = true"
    />

    <template v-else>
      <ul class="flex flex-wrap gap-1.5">
        <li v-for="session in sessions" :key="session.id">
          <button
            type="button"
            @click="selectedId = session.id"
            class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            :class="
              selectedId === session.id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
            "
          >
            <span class="size-2 rounded-full" :class="statusChip[session.status]" />
            <span class="max-w-32 truncate">{{ session.title }}</span>
            <span class="opacity-80">{{ session.joinCode }}</span>
          </button>
        </li>
      </ul>

      <section v-if="selected" class="rounded-2xl border border-outline-variant bg-surface-container p-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-on-surface">{{ selected.title }}</p>
            <span
              class="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="statusChip[boardStatus]"
            >
              {{ t(`teacher.live.status.${boardStatus}`) }}
            </span>
          </div>

          <div class="text-center">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
              {{ t('teacher.live.codeLabel') }}
            </p>
            <p class="font-mono text-4xl font-bold tracking-[0.2em] text-on-surface">
              {{ selected.joinCode }}
            </p>
            <button
              type="button"
              @click="copyCode"
              class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
            >
              <CircleCheck v-if="copied" class="size-3.5" aria-hidden="true" />
              <Copy v-else class="size-3.5" aria-hidden="true" />
              {{ copied ? t('teacher.live.copied') : t('teacher.live.copy') }}
            </button>
            <p class="mt-2 text-[11px] text-on-surface-variant">
              {{ t('teacher.live.linkHint') }}
            </p>
            <button
              type="button"
              @click="copyLink"
              class="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
            >
              <Link2 class="size-3.5" aria-hidden="true" />
              {{ linkCopied ? t('teacher.live.copied') : t('teacher.live.copyLink') }}
            </button>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button
            v-if="boardStatus === 'active'"
            type="button"
            @click="changeStatus('paused')"
            class="inline-flex items-center gap-1.5 rounded-lg border border-outline bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
          >
            <Pause class="size-3.5" aria-hidden="true" />
            {{ t('teacher.live.pause') }}
          </button>
          <button
            v-else-if="boardStatus === 'paused'"
            type="button"
            @click="changeStatus('active')"
            class="inline-flex items-center gap-1.5 rounded-lg border border-outline bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
          >
            <Play class="size-3.5" aria-hidden="true" />
            {{ t('teacher.live.resume') }}
          </button>
          <button
            v-if="boardStatus !== 'finished'"
            type="button"
            @click="changeStatus('finished')"
            class="inline-flex items-center gap-1.5 rounded-lg bg-error px-3 py-1.5 text-xs font-semibold text-on-error transition-opacity hover:opacity-90"
          >
            <Square class="size-3.5" aria-hidden="true" />
            {{ t('teacher.live.finish') }}
          </button>
          <span class="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
            <RotateCw
              class="size-3.5"
              :class="channel.connected.value ? 'text-success' : 'text-warning'"
              aria-hidden="true"
            />
            {{ t('teacher.live.board', { done: submittedCount, joined: participants.length }) }}
            <span class="sr-only">
              {{ channel.connected.value ? t('teacher.live.live') : t('teacher.live.polling') }}
            </span>
          </span>
        </div>
      </section>

      <section v-if="selected" class="rounded-2xl border border-outline-variant bg-surface-container p-4">
        <h4 class="flex items-center gap-2 text-sm font-semibold text-on-surface">
          <Users class="size-4" aria-hidden="true" />
          {{ t('teacher.live.participants') }}
        </h4>

        <p
          v-if="participants.length === 0"
          class="mt-3 flex items-center gap-1.5 text-xs text-on-surface-variant"
        >
          <Users class="size-3.5" aria-hidden="true" />
          {{ t('teacher.live.noParticipants') }}
        </p>

        <ul v-else class="mt-3 space-y-1.5">
          <li
            v-for="entry in sortedParticipants"
            :key="entry.userId"
            class="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
          >
            <span class="flex min-w-0 items-center gap-2">
              <CircleCheck
                v-if="entry.status !== 'joined'"
                class="size-4 shrink-0"
                :class="entry.passed ? 'text-success' : 'text-error'"
                aria-hidden="true"
              />
              <CircleX v-else class="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
              <span class="min-w-0 truncate text-on-surface">
                {{ entry.fullName || entry.username }}
              </span>
            </span>
            <span class="shrink-0 text-xs font-semibold tabular-nums text-on-surface-variant">
              <template v-if="entry.status === 'joined'">
                {{ t('teacher.live.working') }}
              </template>
              <template v-else>
                {{ entry.percent }}%
                <span
                  v-if="entry.passed !== null"
                  class="ml-1 rounded-full px-1.5 py-0.5 text-[11px]"
                  :class="entry.passed ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'"
                >
                  {{ entry.passed ? t('teacher.live.passed') : t('teacher.live.failed') }}
                </span>
              </template>
            </span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
