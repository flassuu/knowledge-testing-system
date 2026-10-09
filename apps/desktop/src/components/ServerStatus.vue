<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Server, WifiOff } from '@lucide/vue'
import { getHealthState, recheckHealth } from '../composables/health'

const { t } = useI18n()
const health = getHealthState()

/** The pill shows the state; hovering spells out which server is in it. */
const statusTip = computed(() => `${t('server.label')}: ${t(`server.${health.status}`)}`)
</script>

<template>
  <!--
    A pill with a word in it. It used to be a bare dot labelled Online, which
    told a teacher that *something* was fine without saying what - and the title
    attribute explained it only on hover, on the one screen you cannot afford to
    hover. Clicking rechecks; the spinner says so while it happens.

    The word "Server" left the pill for the tooltip: the colour and the icon
    already say healthy or not, and the pill keeps its box small. `tip-end`
    right-aligns the bubble, as it does for the avatar beside it.
  -->
  <button
    type="button"
    :aria-label="t('server.recheckHint')"
    v-tip="statusTip"
    class="inline-flex h-[var(--control-md)] shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-xs font-medium tip-end"
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
        class="size-3 rounded-full border-2 border-current border-t-transparent"
      />
      <Server v-else-if="health.status === 'online'" class="size-3.5" />
      <WifiOff v-else class="size-3.5" />
    </span>
    <!-- The status word is the whole label now; the icon carries the rest. -->
    <span>{{ t(`server.${health.status}`) }}</span>
  </button>
</template>