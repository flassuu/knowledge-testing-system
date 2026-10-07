<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppCard from '../../components/common/AppCard.vue'

withDefaults(
  defineProps<{
    variant?: 'cards' | 'table'
    rows?: number
    columns?: number
  }>(),
  { variant: 'cards', rows: 3, columns: 4 },
)

const { t } = useI18n()
</script>

<template>
  <!--
    The skeleton breathes rather than blinks: each row is one step behind the
    previous one, so a list that is arriving looks like it has a direction.
    Stagger is capped at six rows - beyond that it would read as sluggish.
  -->
  <div role="status">
    <span class="sr-only">{{ t('common.loading') }}</span>
    <div v-if="variant === 'cards'" class="space-y-2" aria-hidden="true">
      <AppCard
        v-for="row in rows"
        :key="row"
        class="skeleton-row"
        :style="{ animationDelay: `${Math.min(row - 1, 5) * 90}ms` }"
      >
        <div class="h-3 w-2/5 rounded-full bg-surface-container-highest" />
        <div class="mt-2.5 h-2.5 w-3/5 rounded-full bg-surface-container-highest" />
      </AppCard>
    </div>
    <div
      v-else
      class="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container"
      aria-hidden="true"
    >
      <div
        v-for="row in rows"
        :key="row"
        class="skeleton-row flex items-center gap-4 border-b border-outline-variant px-4 py-3 last:border-0"
        :style="{ animationDelay: `${Math.min(row - 1, 5) * 90}ms` }"
      >
        <div
          v-for="column in columns"
          :key="column"
          class="h-3 rounded-full bg-surface-container-highest"
          :class="column === 1 ? 'w-1/3' : 'w-1/6'"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-row {
  animation: skeleton 1.4s var(--ease-standard) infinite;
}

@keyframes skeleton {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}
</style>