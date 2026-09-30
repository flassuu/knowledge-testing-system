<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileText, TrendingUp } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import JoinSessionCard from '../components/student/JoinSessionCard.vue'
import SessionResult from '../components/student/SessionResult.vue'
import SessionRunner from '../components/student/SessionRunner.vue'
import { ApiError } from '../api/client'
import {
  getCurrentSession,
  getSessionResult,
  joinSession,
  type SessionResultBody,
  type SessionState,
} from '../api/sessions'

const { t } = useI18n()

const code = ref('')
const joining = ref(false)
const joinError = ref('')
const state = ref<SessionState | null>(null)
const result = ref<SessionResultBody | null>(null)
const loading = ref(false)
const loadError = ref('')

const futureCards = [
  { key: 'materials', icon: FileText, phase: '2' },
  { key: 'results', icon: TrendingUp, phase: '4' },
] as const

/**
 * A teacher can hand out a link (or a QR of it) that lands the student straight
 * on the join card with the code filled in.
 */
function codeFromLink(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('join')
  if (fromQuery) return fromQuery.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return ''
}

function clearCodeFromLink(): void {
  if (!new URLSearchParams(window.location.search).has('join')) return
  const url = new URL(window.location.href)
  url.searchParams.delete('join')
  window.history.replaceState(null, '', url.toString())
}

function joinErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return t('student.errors.joinFailed')
  if (error.code === 'NOT_FOUND') return t('student.errors.noSuchCode')
  if (error.code === 'CONFLICT') return t('student.errors.sessionClosed')
  if (error.code === 'NETWORK') return t('student.errors.network')
  if (error.code === 'FORBIDDEN') return t('student.errors.notAllowed')
  return t('student.errors.joinFailed')
}

async function join(): Promise<void> {
  joining.value = true
  joinError.value = ''
  try {
    state.value = await joinSession(code.value)
    code.value = ''
    clearCodeFromLink()
  } catch (error) {
    joinError.value = joinErrorMessage(error)
  } finally {
    joining.value = false
  }
}

async function showResult(sessionId: string): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    result.value = await getSessionResult(sessionId)
    // The paper is spent: leaving the result must land on the home screen, not
    // on a stale runner for a session that can no longer be submitted.
    state.value = null
  } catch (error) {
    loadError.value = t('student.errors.resultFailed')
  } finally {
    loading.value = false
  }
}

/** A reload mid-session must land the student back on their paper, not the gate. */
async function resume(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    state.value = await getCurrentSession()
  } catch {
    // No active session is the normal case, not an error worth showing.
    state.value = null
  } finally {
    loading.value = false
  }
}

function leaveRunner(): void {
  state.value = null
  void resume()
}

onMounted(() => {
  code.value = codeFromLink()
  void resume()
})
</script>

<template>
  <div class="min-h-dvh bg-surface">
    <AppHeader />

    <main class="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h2 class="text-xl font-semibold text-on-surface">
        {{ t('student.heading') }}
      </h2>
      <p class="mt-1 text-sm text-on-surface-variant">{{ t('student.subheading') }}</p>

      <p
        v-if="loadError"
        role="alert"
        class="mt-4 rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container"
      >
        {{ loadError }}
      </p>

      <div v-if="loading" class="mt-6 space-y-3" role="status">
        <span class="sr-only">{{ t('common.loading') }}</span>
        <div class="h-4 w-1/2 animate-pulse rounded-full bg-surface-container-highest" aria-hidden="true" />
        <div class="h-3 w-3/4 animate-pulse rounded-full bg-surface-container-highest" aria-hidden="true" />
      </div>

      <template v-else-if="result">
        <SessionResult class="mt-6" :result="result" />
        <button
          type="button"
          @click="result = null"
          class="mt-4 w-full rounded-xl border border-outline bg-surface px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
        >
          {{ t('student.result.back') }}
        </button>
        <button
          type="button"
          @click="resume()"
          class="mt-2 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
        >
          {{ t('student.result.joinAnother') }}
        </button>
      </template>

      <template v-else-if="state">
        <div class="mt-6">
          <SessionRunner :state="state" @submitted="showResult" />
        </div>
        <button
          type="button"
          @click="leaveRunner"
          class="mt-4 text-xs text-on-surface-variant underline"
        >
          {{ t('student.runner.leave') }}
        </button>
      </template>

      <template v-else>
        <div class="mt-6">
          <JoinSessionCard
            v-model="code"
            v-model:busy="joining"
            v-model:error="joinError"
            @joined="join"
          />
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div
            v-for="card in futureCards"
            :key="card.key"
            class="rounded-xl border border-outline-variant bg-surface-container p-4 shadow-sm"
          >
            <div class="flex items-center gap-2">
              <component :is="card.icon" class="size-5" aria-hidden="true" />
              <h3 class="text-sm font-semibold text-on-surface">
                {{ t(`student.cards.${card.key}.title`) }}
              </h3>
            </div>
            <p class="mt-2 text-xs text-on-surface-variant">
              {{ t(`student.cards.${card.key}.description`) }}
            </p>
            <span
              class="mt-3 inline-block rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant"
            >
              {{ t('student.cards.phase', { phase: card.phase }) }}
            </span>
          </div>
        </div>
      </template>

      <p class="mt-8 text-center text-xs text-on-surface-variant">
        {{ t('footer.message') }}
      </p>
    </main>
  </div>
</template>
