<script setup lang="ts">
import { computed } from 'vue'

/**
 * The one button in the system. Every screen used to carry its own copy of
 * `rounded-lg … px-3 py-1.5 text-xs font-semibold`, which is how the height
 * drifted down to 28px on the primary actions — too small for a thumb. The
 * variants live here now, and the height floor is part of the component.
 */
const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit'
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'secondary', size: 'md', type: 'button', disabled: false, block: false },
)

type Variant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'secondary'
  | 'secondaryMuted'
  | 'secondaryPlain'
  | 'dangerSecondary'
  | 'ghost'
  | 'ghostDanger'

type Size = 'sm' | 'md' | 'icon'

/** Tonal surfaces and label colours, all semantic theme tokens. */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary',
  success: 'bg-success text-on-success',
  warning: 'bg-warning text-on-warning',
  danger: 'bg-error text-on-error',
  secondary: 'border border-outline bg-surface text-on-surface',
  secondaryMuted: 'border border-outline bg-surface text-on-surface-variant',
  // Quiet outline for dense rows, where a full-strength border would shout.
  secondaryPlain: 'border border-outline-variant bg-surface text-on-surface-variant',
  dangerSecondary: 'border border-outline-variant text-on-error-container',
  ghost: 'text-on-surface-variant',
  ghostDanger: 'text-error',
}

/** Hover is expressed as a variant modifier class, since the tone differs. */
const HOVERS: Record<Variant, string> = {
  primary: 'hover:opacity-90',
  success: 'hover:opacity-90',
  warning: 'hover:opacity-90',
  danger: 'hover:opacity-90',
  secondary: 'hover:bg-surface-container-high',
  secondaryMuted: 'hover:bg-surface-container-high',
  secondaryPlain: 'hover:bg-surface-container-high',
  dangerSecondary: 'hover:bg-error-container',
  ghost: 'hover:bg-surface-container-high',
  ghostDanger: 'hover:bg-error-container',
}

const SIZES: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-10 px-3.5 text-sm',
  // Square, for an icon with no label next to it.
  icon: 'size-9',
}

const classes = computed(() =>
  [
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold',
    'transition-colors disabled:pointer-events-none disabled:opacity-60',
    HOVERS[props.variant],
    VARIANTS[props.variant],
    SIZES[props.size],
    props.block ? 'w-full' : '',
  ]
    .filter(Boolean)
    .join(' '),
)
</script>

<template>
  <button :type="type" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>