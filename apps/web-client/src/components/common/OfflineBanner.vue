<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getHealthState } from '../../composables/health'

const { t } = useI18n()
const health = getHealthState()
</script>

<template>
  <!--
    Rendered *inside* the header component, right below the bar, not in App.vue
    above it: in App.vue it sat earlier in the document, so a banner "below the
    header" was a banner above it.
  -->
  <div
    v-if="health.status === 'offline'"
    role="alert"
    class="bg-error px-4 py-2 text-center text-sm font-semibold text-on-error shadow-md"
  >
    {{ t('server.offlineBanner') }}
  </div>
</template>