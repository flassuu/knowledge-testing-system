<script setup lang="ts">
import { computed } from 'vue'

/**
 * The one button in the system.
 *
 * Two rules from the Material 3 button guidelines drive the shape of this
 * component: a label is short, never wraps, never truncates - and the control
 * keeps its height whatever the language says. Widths may follow the label;
 * heights and icon squares may not, because a layout that moves when you switch
 * language reads as broken.
 */
const props = withDefaults(
  defineProps<{
    variant?: Variant
    /** sm: in a dense row · md: default · lg: the one action on a card or a form. */
    size?: Size
    type?: 'button' | 'submit'
    disabled?: boolean
    block?: boolean
    /** Square, for an icon with no label next to it. */
    icon?: boolean
    class?: string
  }>(),
  { variant: 'secondary', size: 'md', type: 'button', disabled: false, block: false, icon: false },
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

type Size = 'sm' | 'md' | 'lg'

const ICON_SIZES: Record<Size, string> = { sm: 'size-4', md: 'size-4', lg: 'size-5' }

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

/*
 * Hover is a state layer, not a background colour.
 *
 * The tints a variant used to fade are gone: fading a colour repaints the
 * control on every frame of the fade, and in a software-rendered webview that
 * is the whole reason hovers felt like they stuttered. `state-layer` puts a
 * 9% overlay of the button's own colour on top and animates only opacity, which
 * the compositor does without repainting. `dangerSecondary` and `ghostDanger`
 * keep a red tint - the danger has to read as danger on hover, and a tint of the
 * content colour already is that colour.
 */
const SIZES: Record<Size, string> = {
  sm: 'h-[var(--control-sm)] px-3 text-xs',
  md: 'h-[var(--control-md)] px-3.5 text-sm',
  lg: 'h-[var(--control-lg)] px-5 text-base',
}

const ICON_BOX: Record<Size, string> = {
  sm: 'size-[var(--control-sm)]',
  md: 'size-[var(--control-md)]',
  lg: 'size-[var(--control-lg)]',
}

/** An icon-only button is a square: its box comes from the size, not padding. */
function sizeClasses(): string {
  if (props.icon) return ICON_BOX[props.size]
  return SIZES[props.size]
}

const classes = computed(() =>
  [
    'inline-flex shrink-0 items-center justify-center gap-2',
    'whitespace-nowrap rounded-[var(--radius-control)] font-semibold',
    // No scale: an M3 press state is a tint over the label, and that tint is the
    // `state-layer` overlay below. Nothing on a press is a paint.
    'state-layer',
    'disabled:pointer-events-none disabled:opacity-60',
    VARIANTS[props.variant],
    sizeClasses(),
    props.block ? 'w-full' : '',
    props.class ?? '',
  ]
    .filter(Boolean)
    .join(' '),
)

/** Icons inherit the button's box, so a size change cannot move the label. */
const iconClass = computed(() => ICON_SIZES[props.size])
</script>

<template>
  <button :type="type" :disabled="disabled" :class="classes">
    <slot :icon-class="iconClass" />
  </button>
</template>