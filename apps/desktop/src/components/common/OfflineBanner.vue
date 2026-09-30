<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getHealthState } from '../../composables/health'

const { t } = useI18n()
const health = getHealthState()
</script>

<template>
  <div
    v-if="health.status === 'offline'"
    role="alert"
    class="fixed inset-x-0 top-0 z-[60] bg-rose-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-md"
  >
    {{ t('server.offlineBanner') }}
  </div>
</template>