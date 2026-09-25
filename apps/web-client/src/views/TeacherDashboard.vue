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
  <div class="min-h-dvh bg-slate-50">
    <AppHeader />

    <main class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h2 class="text-xl font-semibold text-slate-900">
        {{ t('teacher.heading') }}
      </h2>
      <p class="mt-1 text-sm text-slate-500">{{ t('teacher.subheading') }}</p>

      <div class="mt-5 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === 'tests' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="activeTab = 'tests'"
        >
          {{ t('teacher.tabs.tests') }}
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === 'courses' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="activeTab = 'courses'"
        >
          {{ t('teacher.tabs.courses') }}
        </button>
      </div>

      <div class="mt-5">
        <TestsTab v-if="activeTab === 'tests'" />
        <CoursesTab v-else />
      </div>

      <p class="mt-8 text-center text-xs text-slate-400">
        {{ t('footer.message') }}
      </p>
    </main>
  </div>
</template>