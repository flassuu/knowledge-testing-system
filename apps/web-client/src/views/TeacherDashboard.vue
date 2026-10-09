<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen, FileQuestion, Radio, Users } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import TabStrip from '../components/common/TabStrip.vue'
import TestsTab from '../components/teacher/TestsTab.vue'
import CoursesTab from '../components/teacher/CoursesTab.vue'
import ClassesTab from '../components/teacher/ClassesTab.vue'
import LiveSessionsTab from '../components/teacher/LiveSessionsTab.vue'
import { listTests } from '../api/tests'
import type { TestSummary } from '../api/types'

const { t } = useI18n()

const activeTab = ref<'live' | 'tests' | 'courses' | 'classes'>('live')
const tests = ref<TestSummary[]>([])

/** The live tab starts sessions from the teacher's own tests, so it needs the list. */
onMounted(async () => {
  try {
    tests.value = await listTests()
  } catch {
    tests.value = []
  }
})
</script>

<template>
  <div class="min-h-dvh bg-surface">
    <AppHeader />

    <main class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h2 class="text-xl font-semibold text-on-surface">
        {{ t('teacher.heading') }}
      </h2>
      <p class="mt-1 text-sm text-on-surface-variant">{{ t('teacher.subheading') }}</p>

      <TabStrip
        v-model="activeTab"
        class="mt-5"
        :aria-label="t('teacher.heading')"
        :items="[
          { value: 'live', label: t('teacher.tabs.live'), icon: Radio },
          { value: 'tests', label: t('teacher.tabs.tests'), icon: FileQuestion },
          { value: 'courses', label: t('teacher.tabs.courses'), icon: BookOpen },
          { value: 'classes', label: t('teacher.tabs.classes'), icon: Users },
        ]"
      />

      <!--
        `:key` remounts the sheet on a tab change and the transition fades it
        in and out: a swap that teleports reads as a glitch, one that fades
        reads as a page turning.
      -->
      <Transition mode="out-in" name="view">
        <div :key="activeTab" class="mt-5">
          <LiveSessionsTab v-if="activeTab === 'live'" :tests="tests" />
          <TestsTab v-else-if="activeTab === 'tests'" />
          <CoursesTab v-else-if="activeTab === 'courses'" />
          <ClassesTab v-else />
        </div>
      </Transition>

    </main>
  </div>
</template>
