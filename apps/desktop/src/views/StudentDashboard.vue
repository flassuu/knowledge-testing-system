<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppHeader from '../components/AppHeader.vue'

const { t } = useI18n()

const cards = [
  { key: 'join', icon: '🎯', phase: '3' },
  { key: 'materials', icon: '📄', phase: '2' },
  { key: 'results', icon: '📈', phase: '4' },
] as const
</script>

<template>
  <div class="min-h-dvh bg-slate-50">
    <AppHeader />

    <main class="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h2 class="text-xl font-semibold text-slate-900">
        {{ t('student.heading') }}
      </h2>
      <p class="mt-1 text-sm text-slate-500">{{ t('student.subheading') }}</p>

      <div class="mt-6 grid gap-3 sm:grid-cols-2">
        <div
          v-for="card in cards"
          :key="card.key"
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div class="flex items-center gap-2">
            <span class="text-xl" aria-hidden="true">{{ card.icon }}</span>
            <h3 class="text-sm font-semibold text-slate-800">
              {{ t(`student.cards.${card.key}.title`) }}
            </h3>
          </div>
          <p class="mt-2 text-xs text-slate-500">
            {{ t(`student.cards.${card.key}.description`) }}
          </p>
          <span
            class="mt-3 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500"
          >
            {{ t('student.cards.phase', { phase: card.phase }) }}
          </span>
        </div>
      </div>

      <p class="mt-8 text-center text-xs text-slate-400">
        {{ t('footer.message') }}
      </p>
    </main>
  </div>
</template>