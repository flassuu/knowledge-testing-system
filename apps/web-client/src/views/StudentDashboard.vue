<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { FileText, Target, TrendingUp } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'

const { t } = useI18n()

const cards = [
  { key: 'join', icon: Target, phase: '3' },
  { key: 'materials', icon: FileText, phase: '2' },
  { key: 'results', icon: TrendingUp, phase: '4' },
] as const
</script>

<template>
  <div class="min-h-dvh bg-surface">
    <AppHeader />

    <main class="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h2 class="text-xl font-semibold text-on-surface">
        {{ t('student.heading') }}
      </h2>
      <p class="mt-1 text-sm text-on-surface-variant">{{ t('student.subheading') }}</p>

      <div class="mt-6 grid gap-3 sm:grid-cols-2">
        <div
          v-for="card in cards"
          :key="card.key"
          class="rounded-xl border border-outline-variant bg-surface-container p-4 shadow-sm"
        >
          <div class="flex items-center gap-2">
            <component :is="card.icon" class="size-5" aria-hidden="true" />
            <h3 class="text-sm font-semibold text-on-surface">
              {{ t(`student.cards.${card.key}.title`) }}
            </h3>
          </div>
          <p class="mt-2 text-xs text-on-surface-variant">
            {{ t(`student.cards.${card.key}.description`) }}
          </p>
          <span
            class="mt-3 inline-block rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant"
          >
            {{ t('student.cards.phase', { phase: card.phase }) }}
          </span>
        </div>
      </div>

      <p class="mt-8 text-center text-xs text-on-surface-variant">
        {{ t('footer.message') }}
      </p>
    </main>
  </div>
</template>