<script setup lang="ts">
/**
 * The shell every dialog shares: a scrim that fades and a panel that arrives
 * with the emphasized spring, so opening a dialog has a sense of weight.
 * Durations and easings come from the motion tokens in theme.css, and the
 * reduced-motion override in there collapses both to nothing.
 */
defineProps<{
  label: string
  maxWidth?: string
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="label"
    >
      <Transition
        enter-active-class="transition-opacity duration-[var(--motion-medium)] ease-[var(--ease-decelerate)]"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-[var(--motion-short)] ease-[var(--ease-accelerate)]"
        leave-to-class="opacity-0"
      >
        <div class="absolute inset-0 bg-scrim" @click="emit('close')" />
      </Transition>

      <Transition
        enter-active-class="transition-[opacity,transform] duration-[var(--motion-slow)] ease-[var(--ease-emphasized)]"
        enter-from-class="opacity-0 translate-y-6 scale-95"
        leave-active-class="transition-[opacity,transform] duration-[var(--motion-short)] ease-[var(--ease-accelerate)]"
        leave-to-class="opacity-0 translate-y-3 scale-97"
      >
        <div
          class="relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface-container shadow-xl sm:rounded-[var(--radius-sheet)] rounded-t-[var(--radius-sheet)]"
          :class="maxWidth ?? 'max-w-sm'"
        >
          <slot />
        </div>
      </Transition>
    </div>
  </Teleport>
</template>