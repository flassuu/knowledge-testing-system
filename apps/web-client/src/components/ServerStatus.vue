<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Server, WifiOff } from '@lucide/vue'
import { getHealthState, recheckHealth } from '../composables/health'

const { t } = useI18n()
const health = getHealthState()
</script>

<template>
  <!--
    A pill with a word in it. It used to be a bare dot labelled Online, which
    told a teacher that *something* was fine without saying what - and the title
    attribute explained it only on hover, on the one screen you cannot afford to
    hover. Clicking rechecks; the spinner says so while it happens.
  -->
  <button
    type="button"
    :aria-label="t('server.recheckHint')"
    class="inline-flex h-[var(--control-md)] shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors duration-[var(--motion-short)]"
    :class="
      health.status === 'checking'
        ? 'bg-surface-container-high text-on-surface-variant'
        : health.status === 'online'
          ? 'bg-success-container text-on-success-container'
          : 'bg-error-container text-on-error-container'
    "
    @click="void recheckHealth()"
  >
    <span
      class="inline-flex size-3.5 shrink-0 items-center justify-center"
      :aria-hidden="true"
    >
      <!-- Checking reads as motion, not as a third colour nobody has a word for. -->
      <span
        v-if="health.status === 'checking'"
        class="size-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
      />
      <Server v-else-if="health.status === 'online'" class="size-3.5" />
      <WifiOff v-else class="size-3.5" />
    </span>
    <!-- "Server" is hidden on the narrowest screens: the pill has to keep its
         box, and "Online" with a green icon already says the app is alive. The
         desktop has the width for the full label and gets it. -->
    <span class="hidden sm:inline">{{ t('server.label') }}:</span>
    <span>{{ t(`server.${health.status}`) }}</span>
  </button>
</template>