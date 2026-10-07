<script setup lang="ts">
/**
 * The app mark, and a placeholder for the final artwork.
 *
 * Drawn as geometry rather than shipped as an icon set: AGENTS.md wants Lucide
 * for interface icons, but the product logo is not an interface icon. This one
 * is a lantern drawn over a LAN node - four clients around a lit centre - and it
 * is the single source for every size: favicon, app icons and the header. The
 * real mark replaces this file; nothing else has to change.
 */
const props = withDefaults(defineProps<{ size?: number; class?: string }>(), { size: 24 })

const viewBox = '0 0 32 32'
</script>

<template>
  <svg
    :viewBox="viewBox"
    :width="props.size"
    :height="props.size"
    :class="props.class"
    role="img"
    aria-label="LANtern"
  >
    <!-- the light: a warm core, the one warm accent in an otherwise cool mark -->
    <circle cx="16" cy="16" r="6.5" fill="var(--lantern-glow)" />
    <circle cx="16" cy="16" r="3" fill="var(--lantern-core)" />
    <!-- the handle -->
    <path
      d="M12 9.5V8a4 4 0 0 1 8 0v1.5"
      fill="none"
      stroke="var(--lantern-frame)"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <!-- the lantern body -->
    <path
      d="M11 9.5h10l1.2 13.5a1.6 1.6 0 0 1-1.6 1.7h-9.2a1.6 1.6 0 0 1-1.6-1.7z"
      fill="var(--lantern-glass)"
      stroke="var(--lantern-frame)"
      stroke-width="1.8"
      stroke-linejoin="round"
    />
    <!-- the LAN: clients hanging off the same wire -->
    <circle cx="16" cy="16" r="2" fill="var(--lantern-core)" />
    <circle cx="6" cy="6" r="1.9" fill="var(--lantern-node)" />
    <circle cx="26" cy="6" r="1.9" fill="var(--lantern-node)" />
    <circle cx="6" cy="26" r="1.9" fill="var(--lantern-node)" />
    <circle cx="26" cy="26" r="1.9" fill="var(--lantern-node)" />
    <g stroke="var(--lantern-wire)" stroke-width="1.2" stroke-linecap="round">
      <path d="M7.2 7.2 13 13" />
      <path d="M24.8 7.2 19 13" />
      <path d="M7.2 24.8 13 19" />
      <path d="M24.8 24.8 19 19" />
    </g>
  </svg>
</template>