<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import { useAuth } from '../stores/auth'
import { ApiError } from '../api/client'
import AppButton from '../components/common/AppButton.vue'
import AppCard from '../components/common/AppCard.vue'
import AppInput from '../components/common/AppInput.vue'

/**
 * Sign in with a name and a password. Nothing else.
 *
 * This screen used to ask which role you were before you typed anything. That
 * control sent nothing to the server - `POST /api/auth/login` takes a username and
 * a password and rejects any other field - so the three buttons were decoration
 * that looked like a choice. Worse, one of them said "Admin", which is how a
 * student comes to believe the system is about administrators.
 *
 * The account carries its own role and the screen after sign-in follows it. So
 * the honest form is two fields, and it also fits a phone without shrinking.
 */
const emit = defineEmits<{ register: [] }>()

const { t } = useI18n()
const { signIn } = useAuth()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const errorKey = ref('')
const submitting = ref(false)

const LAST_USERNAME_KEY = 'auth.lastUsername'

onMounted(() => {
  // Restore the last successful sign-in so a returning user only types a
  // password. A first run pre-fills nothing: the seeded name is on the card.
  const savedUsername = localStorage.getItem(LAST_USERNAME_KEY)
  if (savedUsername) username.value = savedUsername
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
    // Only persist on success so typos never overwrite the saved username.
    localStorage.setItem(LAST_USERNAME_KEY, username.value.trim())
  } catch (error) {
    errorKey.value = error instanceof ApiError ? error.code : ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-surface">
    <AppHeader />
    <main class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-10">

    <div class="flex flex-1 flex-col justify-center py-4">
    <AppCard as="section" padding="lg" class="shadow-sm">
      <h2 class="text-lg font-semibold text-balance text-on-surface">
        {{ t('auth.signIn') }}
      </h2>
      <p class="mt-1 text-sm text-balance text-on-surface-variant">
        {{ t('auth.signInHint') }}
      </p>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs font-medium text-on-surface-variant">
            {{ t('auth.username') }}
          </span>
          <AppInput
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="teacher"
            class="mt-1"
          />
        </label>

        <label class="block">
          <span class="text-xs font-medium text-on-surface-variant">
            {{ t('auth.password') }}
          </span>
          <div class="relative mt-1.5">
            <AppInput
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              class="pr-12"
            />
            <AppButton
              variant="ghost"
              icon
              class="absolute inset-y-0 right-0 my-0.5 mr-0.5"
              :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
              :title="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" class="size-4" aria-hidden="true" />
              <Eye v-else class="size-4" aria-hidden="true" />
            </AppButton>
          </div>
        </label>

        <p
          v-if="errorKey"
          role="alert"
          class="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
        >
          {{ errorMessage(errorKey) }}
        </p>

        <AppButton variant="primary" size="lg" type="submit" class="mt-1 w-full" :disabled="submitting">
          {{ submitting ? t('common.loading') : t('auth.signIn') }}
        </AppButton>
      </form>

      <div
        class="mt-4 flex min-h-11 items-center justify-center border-t border-outline-variant pt-4 text-center text-sm"
      >
        <span class="text-on-surface-variant">{{ t('auth.needAccount') }}</span>
          <button
            type="button"
            class="ml-1 font-semibold text-on-surface underline underline-offset-2"
            @click="emit('register')"
          >
            {{ t('auth.register') }}
          </button>
      </div>
    </AppCard>

    </div>
    </main>
  </div>
</template>