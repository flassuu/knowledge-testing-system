<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useAuth } from './stores/auth'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import AdminDashboard from './views/AdminDashboard.vue'
import TeacherDashboard from './views/TeacherDashboard.vue'
import StudentDashboard from './views/StudentDashboard.vue'

const { t, locale } = useI18n()
const { status, user, initialize } = useAuth()

const mode = ref<'login' | 'register'>('login')

// Course-project touch: author's name in the window title, localized.
const windowTitles: Record<string, string> = {
  en: 'Maksym Halushechenko — Knowledge Testing',
  uk: 'Максим Галущенко — Тестування знань',
}

function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}

watch(
  locale,
  (lang) => {
    if (!isTauri()) return
    // Best-effort: WebView-only call, safe to ignore outside Tauri.
    void getCurrentWebviewWindow().setTitle(
      windowTitles[lang] ?? windowTitles.en,
    )
  },
  { immediate: true },
)

onMounted(() => void initialize())

type Screen = 'loading' | 'login' | 'register' | 'admin' | 'teacher' | 'student'

const screen = computed<Screen>(() => {
  if (status.value !== 'authenticated' || !user.value) {
    if (status.value === 'initializing') return 'loading'
    return mode.value === 'register' ? 'register' : 'login'
  }
  return user.value.role
})
</script>

<template>
  <div v-if="screen === 'loading'" class="flex min-h-dvh items-center justify-center">
    <p class="text-sm text-slate-400">{{ t('common.loading') }}</p>
  </div>

  <LoginView v-else-if="screen === 'login'" @register="mode = 'register'" />
  <RegisterView v-else-if="screen === 'register'" @back="mode = 'login'" />
  <AdminDashboard v-else-if="screen === 'admin'" />
  <TeacherDashboard v-else-if="screen === 'teacher'" />
  <StudentDashboard v-else-if="screen === 'student'" />
</template>