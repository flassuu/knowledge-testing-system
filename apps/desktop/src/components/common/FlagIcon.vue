<script setup lang="ts">
/**
 * Language flags as drawn shapes, not emoji: AGENTS.md bans emoji in the UI, and
 * emoji flags render differently on every platform anyway. Two rectangles for
 * Ukraine, stripes and a canton for English - at 16x12 they only need to be
 * recognisable, not exact.
 *
 * Round. Both flags are rectangles, so a squared one was the only shape the art
 * had - and next to a circular avatar it read as a chip that belonged to
 * something else. The frame is a circle and the flag is clipped into it, which
 * keeps the drawing the same and gives every flag in the app one silhouette.
 *
 * English is the American flag, not the Union Jack: the locale is `en`, the
 * teacher is choosing a language, and a flag that names a country turns that into
 * a claim about where they are from.
 */
const props = withDefaults(defineProps<{ code: 'en' | 'uk'; class?: string }>(), { class: '' })

const viewBox = '0 0 16 12'
</script>

<template>
  <span
    class="inline-flex size-4 shrink-0 overflow-hidden rounded-full ring-1 ring-outline-variant"
    :class="props.class"
    role="img"
    aria-hidden="true"
  >
  <svg
    v-if="props.code === 'uk'"
    :viewBox="viewBox"
    preserveAspectRatio="xMidYMid slice"
    class="size-full"
    focusable="false"
  >
    <rect width="16" height="6" fill="#0057B7" />
    <rect y="6" width="16" height="6" fill="#FFD700" />
  </svg>
  <svg
    v-else
    :viewBox="viewBox"
    preserveAspectRatio="xMidYMid slice"
    class="size-full"
    focusable="false"
  >
    <!-- Thirteen stripes, drawn as seven red on six white. -->
    <rect width="16" height="12" fill="#FFFFFF" />
    <g fill="#B22234">
      <rect y="0" width="16" height="0.92" />
      <rect y="1.84" width="16" height="0.92" />
      <rect y="3.68" width="16" height="0.92" />
      <rect y="5.52" width="16" height="0.92" />
      <rect y="7.36" width="16" height="0.92" />
      <rect y="9.2" width="16" height="0.92" />
      <rect y="11.08" width="16" height="0.92" />
    </g>
    <!-- The canton: blue, with stars too small to draw one by one. -->
    <rect width="7" height="6.4" fill="#3C3B6E" />
    <g fill="#FFFFFF">
      <rect x="0.9" y="0.7" width="0.9" height="0.9" />
      <rect x="3.1" y="0.7" width="0.9" height="0.9" />
      <rect x="5.3" y="0.7" width="0.9" height="0.9" />
      <rect x="2" y="2.75" width="0.9" height="0.9" />
      <rect x="4.2" y="2.75" width="0.9" height="0.9" />
      <rect x="0.9" y="4.8" width="0.9" height="0.9" />
      <rect x="3.1" y="4.8" width="0.9" height="0.9" />
      <rect x="5.3" y="4.8" width="0.9" height="0.9" />
    </g>
  </svg>
  </span>
</template>