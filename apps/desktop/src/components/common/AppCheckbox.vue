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
 * The state layer is a circle around the box, not the whole row: M3 points at
 * the control, and a tint that ran under the label would read as the row being
 * selectable text. `group-hover`/`group-active` drive the circle, so a pointer
 * anywhere on the row lights exactly the box. The check draws in with a turn
 * (`check-in`) and the box squishes under the press (`checkbox-box`).
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
    class="group inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-[var(--radius-control)] pl-1 pr-2 text-left text-sm disabled:opacity-60"
    @click="toggle"
  >
    <!-- The 40px circular state layer, lit only under the box. -->
    <span class="relative inline-flex size-10 shrink-0 items-center justify-center">
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 rounded-full bg-on-surface opacity-0 transition-opacity duration-150 group-hover:opacity-[0.08] group-active:opacity-[0.12]"
      />
      <span
        aria-hidden="true"
        class="checkbox-box relative flex size-5 items-center justify-center rounded-[4px] border-2 group-active:scale-90"
        :class="
          modelValue
            ? 'border-primary bg-primary text-on-primary'
            : 'border-outline bg-transparent group-hover:border-on-surface-variant'
        "
      >
        <Check v-if="modelValue" class="check-in size-3.5" :stroke-width="3" />
      </span>
    </span>
    <span class="min-w-0 text-on-surface-variant">{{ label }}</span>
  </button>
</template>
