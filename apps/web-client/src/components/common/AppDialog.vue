<script setup lang="ts">
/**
 * The shell every dialog shares: a scrim that fades and a panel that arrives
 * from below with the emphasized curve, so opening a dialog has a sense of
 * weight.
 *
 * Durations and easings come from the motion tokens in theme.css, and the
 * reduced-motion override in there collapses the entrance to nothing.
 */
defineProps<{
  label: string
  maxWidth?: string
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <!--
      The entrance is a keyframe animation, not a transition. A transition on a
      panel that is mounted and unmounted with its parent is at the mercy of when
      the styles land, and the pair of <Transition>s that used to wrap these two
      elements could restart one mid-flight. A keyframe animation plays once per
      mount and nothing can interrupt it.
    -->
    <div
      class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="label"
    >
      <div class="dialog-scrim absolute inset-0 bg-scrim" @click="emit('close')" />

      <div
        class="dialog-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface-container shadow-xl sm:rounded-[var(--radius-sheet)] rounded-t-[var(--radius-sheet)]"
        :class="maxWidth ?? 'max-w-sm'"
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>