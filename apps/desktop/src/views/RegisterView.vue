<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import { register } from '../api/auth'
import { ApiError } from '../api/client'

const emit = defineEmits<{ back: [] }>()

const { t } = useI18n()

const fullName = ref('')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorKey = ref('')
const submitting = ref(false)
const created = ref(false)

function validate(): string {
  if (!fullName.value.trim()) return 'fullNameRequired'
  if (username.value.trim().length < 3) return 'usernameTooShort'
  if (password.value.length < 8) return 'passwordMin'
  if (password.value !== confirmPassword.value) return 'passwordMismatch'
  return ''
}

const FORM_ERROR_KEYS = ['fullNameRequired', 'usernameTooShort', 'passwordMin', 'passwordMismatch'] as const

function errorMessage(key: string): string {
  if ((FORM_ERROR_KEYS as readonly string[]).includes(key)) {
    return t(`auth.form.${key}`)
  }
  switch (key) {
    case 'CONFLICT':
      return t('auth.errors.usernameTaken')
    case 'VALIDATION':
      return t('auth.errors.validation')
    case 'NETWORK':
      return t('auth.errors.network')
    default:
      return t('auth.errors.generic')
  }
}

async function submit() {
  errorKey.value = ''
  const invalid = validate()
  if (invalid) {
    errorKey.value = invalid
    return
  }
  submitting.value = true
  try {
    await register({
      fullName: fullName.value.trim(),
      username: username.value.trim(),
      password: password.value,
    })
    created.value = true
  } catch (error) {
    errorKey.value = error instanceof ApiError ? error.code : ''
  } finally {
    submitting.value = false
  }
}

function back() {
  created.value = false
  emit('back')
}
</script>

<template>
  <main
    class="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10"
  >
    <header class="mb-8 flex items-center justify-between">
      <h1 class="text-lg font-bold text-slate-800">{{ t('app.name') }}</h1>
      <div class="flex items-center gap-2">
        <LanguageSwitcher />
        <button
          type="button"
          @click="back"
          class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {{ t('auth.backToLogin') }}
        </button>
      </div>
    </header>

    <section
      v-if="created"
      class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm"
    >
      <p class="text-lg font-semibold text-emerald-800">
        {{ t('auth.pendingTitle') }}
      </p>
      <p class="mt-2 text-sm text-emerald-700">{{ t('auth.pendingNote') }}</p>
      <button
        type="button"
        @click="back"
        class="mt-5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
      >
        {{ t('auth.backToLogin') }}
      </button>
    </section>

    <section
      v-else
      class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 class="text-lg font-semibold text-slate-900">
        {{ t('auth.registerHeading') }}
      </h2>
      <p class="mt-1 text-sm text-slate-500">
        {{ t('auth.registerHint') }}
      </p>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs font-medium text-slate-500">
            {{ t('auth.fullName') }}
          </span>
          <input
            v-model="fullName"
            type="text"
            autocomplete="name"
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </label>

        <label class="block">
          <span class="text-xs font-medium text-slate-500">
            {{ t('auth.username') }}
          </span>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
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
            autocomplete="new-password"
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </label>

        <label class="block">
          <span class="text-xs font-medium text-slate-500">
            {{ t('auth.confirmPassword') }}
          </span>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
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
          {{ submitting ? t('common.loading') : t('auth.register') }}
        </button>
      </form>
    </section>
  </main>
</template>