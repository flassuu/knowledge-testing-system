<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { dismissToast, getToastState, type ToastKind } from '../../composables/toast'

const { t } = useI18n()
const state = getToastState()

const kindClass: Record<ToastKind, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-rose-500',
  info: 'border-l-slate-500',
}
</script>

<template>
  <Teleport to="body">
    <div
      aria-live="polite"
      class="pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
    >
      <TransitionGroup
        name="toast"
        tag="div"
        class="flex w-full max-w-sm flex-col gap-2"
      >
        <div
          v-for="item in state.items"
          :key="item.id"
          role="status"
          class="pointer-events-auto flex items-start gap-2 rounded-lg border border-slate-200 border-l-4 bg-white px-3 py-2.5 shadow-lg"
          :class="kindClass[item.kind]"
        >
          <p class="min-w-0 flex-1 text-sm text-slate-700">{{ item.message }}</p>
          <button
            type="button"
            :aria-label="t('common.dismiss')"
            @click="dismissToast(item.id)"
            class="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
          >
            <span aria-hidden="true" class="text-xs font-bold">✕</span>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>