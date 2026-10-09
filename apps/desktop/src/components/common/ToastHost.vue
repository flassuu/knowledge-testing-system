<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { X } from '@lucide/vue'
import { dismissToast, getToastState, type ToastKind } from '../../composables/toast'
import AppButton from '../../components/common/AppButton.vue'

const { t } = useI18n()
const state = getToastState()

const kindClass: Record<ToastKind, string> = {
  success: 'border-l-success',
  error: 'border-l-error',
  info: 'border-l-outline',
}
</script>

<template>
  <Teleport to="body">
    <!-- Bottom right: a message reports, it does not block. At the top it sits
         over the header, which is the one row a teacher must be able to read at
         a glance while a session is running. -->
    <div
      aria-live="polite"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-4 sm:items-end sm:pr-6"
    >
      <TransitionGroup
        name="toast"
        tag="div"
        class="flex w-full max-w-sm flex-col items-stretch gap-2"
      >
        <div
          v-for="item in state.items"
          :key="item.id"
          role="status"
          class="layer-move pointer-events-auto flex w-full items-start gap-2 rounded-[var(--radius-control)] border border-outline-variant border-l-4 bg-surface-container px-3 py-2.5 shadow-lg"
          :class="kindClass[item.kind]"
        >
          <p class="min-w-0 flex-1 text-sm text-on-surface">{{ item.message }}</p>
          <AppButton
  variant="ghost"
  class="shrink-0"
  :aria-label="t('common.dismiss')"
  @click="dismissToast(item.id)"
>
            <X class="size-3.5" aria-hidden="true" />
          </AppButton>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
/*
 * Toasts are the one surface that genuinely comes and goes, so this is the one
 * place a Transition is right: a toast is created and destroyed, and the
 * transition is attached to that single lifecycle. It arrives from below,
 * because it lives at the bottom now, and leaves quickly - it reports, it does
 * not perform. Enter and leave differ in duration and easing, which is what
 * made the two `<Transition>` pairs in the menus wrong when they both had to
 * cover a node that stayed put.
 */
.toast-enter-active {
  transition:
    opacity var(--motion-medium) var(--ease-decelerate),
    transform var(--motion-medium) var(--ease-emphasized);
}
.toast-leave-active {
  transition:
    opacity var(--motion-instant) var(--ease-accelerate),
    transform var(--motion-instant) var(--ease-accelerate);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(0.75rem);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(0.25rem);
}
.toast-move {
  transition: transform var(--motion-medium) var(--ease-standard);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-move {
    transition: none;
  }
}
</style>
