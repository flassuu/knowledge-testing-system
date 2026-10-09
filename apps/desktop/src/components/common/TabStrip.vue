<script setup lang="ts" generic="T extends string">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * A row of tabs with equal segments.
 *
 * M3 gives every segment the same width inside its group, and that is also what
 * keeps this row still when the locale changes: "Tests" and "Тести" are not the
 * same length, and a tab bar that resizes under the reader is the single most
 * visible sign of an unfinished interface.
 *
 * The indicator only ever moves. It slid by animating `transform` *and* `width`,
 * and a width change is a layout pass: every frame re-measured the row and
 * everything below it, which is why switching tabs stuttered. The grid already
 * makes every segment the same width, so the width is measured once and never
 * animated - a resize re-measures it without a transition, which is the one
 * case where an instant change is the right one.
 */
const props = defineProps<{
  modelValue: T
  items: Array<{ value: T; label: string; icon?: unknown; badge?: number | null }>
  ariaLabel?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const container = ref<HTMLElement | null>(null)
const indicator = ref({ left: 0, width: 0 })

/** A resize changes the geometry; the width follows without a transition. */
let observer: ResizeObserver | null = null

/** Indicator geometry in the container's own pixels, so nothing skews it. */
function measure(): void {
  const root = container.value
  if (!root) return
  const active = root.querySelector<HTMLElement>('[data-active="true"]')
  if (!active) return
  const rootBox = root.getBoundingClientRect()
  const box = active.getBoundingClientRect()
  indicator.value = { left: box.left - rootBox.left, width: box.width }
}

// The first measure happens before the element has a box, so it waits a frame.
onMounted(() => {
  requestAnimationFrame(measure)
  if (container.value) {
    observer = new ResizeObserver(measure)
    observer.observe(container.value)
  }
})
// And it follows the model whenever the active tab changes.
watch(() => props.modelValue, () => requestAnimationFrame(measure))

onBeforeUnmount(() => observer?.disconnect())

const style = computed(() => ({
  transform: `translateX(${indicator.value.left}px)`,
  width: `${indicator.value.width}px`,
}))

function select(value: T): void {
  if (value === props.modelValue) return
  emit('update:modelValue', value)
}

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.items.length}, minmax(0, 1fr))`,
}))
</script>

<template>
  <div
    ref="container"
    class="relative grid gap-1 rounded-[var(--radius-card)] border border-outline-variant bg-surface-container p-1"
    :style="gridStyle"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-1 rounded-[var(--radius-control)] bg-primary transition-transform duration-[var(--motion-medium)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
      :style="style"
    />
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      role="tab"
      :data-active="item.value === modelValue"
      :aria-selected="item.value === modelValue"
      :tabindex="item.value === modelValue ? 0 : -1"
      class="relative z-1 inline-flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] px-2 py-2 text-center transition-colors duration-[var(--motion-short)] ease-[var(--ease-standard)]"
      :class="
        item.value === modelValue
          ? 'text-on-primary'
          : 'text-on-surface-variant hover:bg-surface-container-high'
      "
      @click="select(item.value)"
    >
      <span class="flex items-center gap-1.5">
        <component
          :is="item.icon"
          v-if="item.icon"
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        <span class="truncate text-sm font-semibold">{{ item.label }}</span>
        <span
          v-if="item.badge"
          class="rounded-full bg-error-container px-1.5 text-[11px] font-bold text-on-error-container"
        >
          {{ item.badge }}
        </span>
      </span>
    </button>
  </div>
</template>