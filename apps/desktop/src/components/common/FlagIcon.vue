<script setup lang="ts">
/**
 * Language flags as drawn shapes, not emoji: AGENTS.md bans emoji in the UI, and
 * emoji flags render differently on every platform anyway. Two rectangles for
 * Ukraine, a simplified Union Jack for English - at 16x12 they only need to be
 * recognisable, not exact.
 */
const props = withDefaults(defineProps<{ code: 'en' | 'uk'; class?: string }>(), { class: '' })

const viewBox = '0 0 16 12'
</script>

<template>
  <svg
    v-if="props.code === 'uk'"
    :viewBox="viewBox"
    class="h-3 w-4 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"
    :class="props.class"
    role="img"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="16" height="6" fill="#0057B7" />
    <rect y="6" width="16" height="6" fill="#FFD700" />
  </svg>
  <svg
    v-else
    :viewBox="viewBox"
    class="h-3 w-4 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"
    :class="props.class"
    role="img"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="16" height="12" fill="#012169" />
    <path d="M0 0 16 12M16 0 0 12" stroke="#fff" stroke-width="2.4" />
    <path d="M0 0 16 12M16 0 0 12" stroke="#C8102E" stroke-width="1" />
    <path d="M8 0v12M0 6h16" stroke="#fff" stroke-width="4" />
    <path d="M8 0v12M0 6h16" stroke="#C8102E" stroke-width="2.4" />
  </svg>
</template>