<script setup lang="ts">
import { computed } from 'vue'

/**
 * The one text field in the system. Nineteen inputs used to spell out the same
 * `w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm
 * focus:border-primary`, and three of them had drifted to a different radius or
 * lost the `bg-surface`, which is how a form ends up looking assembled.
 */
const model = defineModel<string>({ default: '' })

const props = withDefaults(
  defineProps<{
    type?: string
    placeholder?: string
    id?: string
    name?: string
    disabled?: boolean
    required?: boolean
    min?: string
    max?: string
    step?: string
    autocomplete?: string
    /** Extra classes for layout only (grid span, max width, margins). */
    class?: string
  }>(),
  { type: 'text' },
)

const emit = defineEmits<{ enter: [] }>()

const classes = computed(() =>
  [
    'w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm text-on-surface',
    'transition-colors placeholder:text-on-surface-variant',
    'focus:border-primary disabled:opacity-60',
    props.class ?? '',
  ]
    .filter(Boolean)
    .join(' '),
)
</script>

<template>
  <input
    v-model="model"
    :type="type"
    :id="id"
    :name="name"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :min="min"
    :max="max"
    :step="step"
    :autocomplete="autocomplete"
    :class="classes"
    @keydown.enter="emit('enter')"
  />
</template>