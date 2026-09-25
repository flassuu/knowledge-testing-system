<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from './stores/auth'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import AdminDashboard from './views/AdminDashboard.vue'
import TeacherDashboard from './views/TeacherDashboard.vue'
import StudentDashboard from './views/StudentDashboard.vue'

const { t } = useI18n()
const { status, user, initialize } = useAuth()

const mode = ref<'login' | 'register'>('login')

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