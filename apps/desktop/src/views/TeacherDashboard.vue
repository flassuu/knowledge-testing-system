<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppHeader from '../components/AppHeader.vue'
import TestsTab from '../components/teacher/TestsTab.vue'
import CoursesTab from '../components/teacher/CoursesTab.vue'

const { t } = useI18n()

const activeTab = ref<'tests' | 'courses'>('tests')
</script>

<template>
  <div class="min-h-dvh bg-surface">
    <AppHeader />

    <main class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h2 class="text-xl font-semibold text-on-surface">
        {{ t('teacher.heading') }}
      </h2>
      <p class="mt-1 text-sm text-on-surface-variant">{{ t('teacher.subheading') }}</p>

      <div class="mt-5 flex gap-1 rounded-xl border border-outline-variant bg-surface-container p-1 shadow-sm">
        <button
          type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === 'tests' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'"
          @click="activeTab = 'tests'"
        >
          {{ t('teacher.tabs.tests') }}
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === 'courses' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'"
          @click="activeTab = 'courses'"
        >
          {{ t('teacher.tabs.courses') }}
        </button>
      </div>

      <div class="mt-5">
        <TestsTab v-if="activeTab === 'tests'" />
        <CoursesTab v-else />
      </div>

      <p class="mt-8 text-center text-xs text-on-surface-variant">
        {{ t('footer.message') }}
      </p>
    </main>
  </div>
</template>