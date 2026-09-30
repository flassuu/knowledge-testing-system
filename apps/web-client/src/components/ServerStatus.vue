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
    title="Server status — click to re-check"
    class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors"
    :class="
      health.status === 'checking'
        ? 'bg-slate-100 text-slate-500'
        : health.status === 'online'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-rose-50 text-rose-700'
    "
  >
    <span
      class="size-2 rounded-full"
      :class="
        health.status === 'checking'
          ? 'bg-slate-400'
          : health.status === 'online'
            ? 'bg-emerald-500'
            : 'bg-rose-500'
      "
    />
    {{ t(`server.${health.status}`) }}
  </button>
</template>