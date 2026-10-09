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
    A still placeholder. It used to breathe, each row a step behind the one above,
    which said a list was arriving; the pulse went with the rest of the motion and
    the rows still read as a list of the right shape.
  -->
  <div role="status">
    <span class="sr-only">{{ t('common.loading') }}</span>
    <div v-if="variant === 'cards'" class="space-y-2" aria-hidden="true">
      <AppCard
        v-for="row in rows"
        :key="row"
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
        class="flex items-center gap-4 border-b border-outline-variant px-4 py-3 last:border-0"
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
