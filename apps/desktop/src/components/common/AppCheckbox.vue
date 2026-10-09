<script setup lang="ts">
import { Check } from '@lucide/vue'

/**
 * A checkbox, M3 shape: a 4px-rounded square, primary when it is on, with the
 * check drawn on top of the tick-free box rather than beside a word.
 *
 * The label is part of the control's own button, not a separate `<label for>`:
 * the whole row is the target, which is what makes it usable on a phone, and it
 * removes the id that has to stay in step with the markup.
 *
 * Only colour and opacity animate. A box that scaled or slid on every tap was
 * the sharpest twitch in the form.
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    label: string
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

function toggle(): void {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="modelValue"
    :disabled="disabled"
    class="group inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-[var(--radius-control)] px-1 text-left text-sm disabled:opacity-60"
    @click="toggle"
  >
    <span
      aria-hidden="true"
      class="flex size-5 shrink-0 items-center justify-center rounded-[4px] border-2"
      :class="
        modelValue
          ? 'border-primary bg-primary text-on-primary'
          : 'border-outline bg-transparent group-hover:border-on-surface-variant'
      "
    >
      <Check
        v-if="modelValue"
        class="size-3.5"
        :stroke-width="3"
      />
    </span>
    <span class="min-w-0 text-on-surface-variant">{{ label }}</span>
  </button>
</template>