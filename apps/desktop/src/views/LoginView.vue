<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import ServerStatus from '../components/ServerStatus.vue'
import { useAuth } from '../stores/auth'
import { ApiError } from '../api/client'
import type { UserRole } from '../api/types'

const emit = defineEmits<{ register: [] }>()

const { t } = useI18n()
const { signIn } = useAuth()

const selectedRole = ref<UserRole>('student')
const username = ref('')
const password = ref('')
const errorKey = ref('')
const submitting = ref(false)

const roles: Array<{ role: UserRole; icon: string }> = [
  { role: 'student', icon: '🎓' },
  { role: 'teacher', icon: '📚' },
  { role: 'admin', icon: '🛡️' },
]

const usernamePlaceholder = computed(() => {
  if (selectedRole.value === 'admin') return 'admin'
  if (selectedRole.value === 'teacher') return 'teacher1'
  return 'student1'
})

onMounted(() => {
  // Convenience hint for local demos: prefill the built-in admin login.
  if (selectedRole.value === 'admin') username.value = 'admin'
})

function errorMessage(key: string): string {
  switch (key) {
    case 'INVALID_CREDENTIALS':
      return t('auth.errors.invalidCredentials')
    case 'PENDING_APPROVAL':
      return t('auth.errors.pendingApproval')
    case 'BLOCKED':
      return t('auth.errors.blocked')
    case 'NETWORK':
      return t('auth.errors.network')
    default:
      return t('auth.errors.generic')
  }
}

async function submit() {
  errorKey.value = ''
  submitting.value = true
  try {
    await signIn(username.value.trim(), password.value)
  } catch (error) {
    errorKey.value = error instanceof ApiError ? error.code : ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main
    class="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10"
  >
    <header class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-lg font-bold text-slate-800">{{ t('app.name') }}</h1>
        <p class="text-xs text-slate-400">{{ t('app.tagline') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <ServerStatus />
        <LanguageSwitcher />
      </div>
    </header>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-slate-900">
        {{ t('auth.chooseRole') }}
      </h2>
      <p class="mt-1 text-sm text-slate-500">{{ t('auth.chooseRoleHint') }}</p>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <button
          v-for="{ role, icon } in roles"
          :key="role"
          type="button"
          @click="selectedRole = role"
          class="flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors"
          :class="
            selectedRole === role
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 text-slate-600 hover:border-slate-400'
          "
        >
          <span class="text-xl" aria-hidden="true">{{ icon }}</span>
          {{ t(`role.${role}`) }}
        </button>
      </div>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs font-medium text-slate-500">
            {{ t('auth.username') }}
          </span>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            :placeholder="usernamePlaceholder"
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </label>

        <label class="block">
          <span class="text-xs font-medium text-slate-500">
            {{ t('auth.password') }}
          </span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </label>

        <p
          v-if="errorKey"
          role="alert"
          class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {{ errorMessage(errorKey) }}
        </p>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
        >
          {{ submitting ? t('common.loading') : t('auth.signIn') }}
        </button>
      </form>

      <div
        v-if="selectedRole === 'student'"
        class="mt-4 border-t border-slate-100 pt-4 text-center text-sm"
      >
        <span class="text-slate-500">{{ t('auth.needAccount') }}</span>
        <button
          type="button"
          class="ml-1 font-semibold text-slate-900 underline underline-offset-2"
          @click="emit('register')"
        >
          {{ t('auth.register') }}
        </button>
      </div>
    </section>

    <p class="mt-6 text-center text-xs text-slate-400">
      {{ t('footer.message') }}
    </p>
  </main>
</template>