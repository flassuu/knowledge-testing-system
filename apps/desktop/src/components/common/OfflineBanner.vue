<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getHealthState } from '../../composables/health'

const { t } = useI18n()
const health = getHealthState()
</script>

<template>
  <!--
    It is rendered *inside* the header component, right below the bar, not in
    App.vue above it. In App.vue it sat earlier in the document, so a banner
    "below the header" was a banner above it. The header carries the server's
    state, the language and the account, and a warning pinned over that row is
    the one thing a teacher must still be able to read.
  -->
  <div
    v-if="health.status === 'offline'"
    role="alert"
    class="bg-error px-4 py-2 text-center text-sm font-semibold text-on-error"
  >
    {{ t('server.offlineBanner') }}
  </div>
</template>