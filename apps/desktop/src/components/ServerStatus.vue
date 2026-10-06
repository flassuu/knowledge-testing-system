<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getHealthState, recheckHealth } from '../composables/health'

const { t } = useI18n()
const health = getHealthState()
</script>

<template>
  <button
    type="button"
    @click="void recheckHealth()"
    :title="t('server.recheckHint')"
    class="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-medium transition-colors"
    :class="
      health.status === 'checking'
        ? 'bg-surface-container-high text-on-surface-variant'
        : health.status === 'online'
          ? 'bg-success-container text-on-success-container'
          : 'bg-error-container text-on-error-container'
    "
  >
    <span
      class="size-2 rounded-full"
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