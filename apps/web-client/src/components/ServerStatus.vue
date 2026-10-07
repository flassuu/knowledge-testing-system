<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getHealthState, recheckHealth } from '../composables/health'

const { t } = useI18n()
const health = getHealthState()
</script>

<template>
  <!--
    A status pill, not a button with a paragraph: the dot carries the state, the
    label is one short word, and the whole thing keeps its box in both languages
    so the header does not resize when the locale changes.
  -->
  <button
    type="button"
    @click="void recheckHealth()"
    :title="t('server.recheckHint')"
    :aria-label="t('server.recheckHint')"
    class="inline-flex h-[var(--control-md)] shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors duration-[var(--motion-short)]"
    :class="
      health.status === 'checking'
        ? 'bg-surface-container-high text-on-surface-variant'
        : health.status === 'online'
          ? 'bg-success-container text-on-success-container'
          : 'bg-error-container text-on-error-container'
    "
  >
    <span
      class="size-2 shrink-0 rounded-full transition-colors duration-[var(--motion-medium)]"
      :class="
        health.status === 'checking'
          ? 'bg-outline'
          : health.status === 'online'
            ? 'bg-success'
            : 'bg-error'
      "
    />
    {{ t(`server.${health.status}`) }}
  </button>
</template>