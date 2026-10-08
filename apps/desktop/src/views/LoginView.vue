<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  Server,
  ShieldCheck,
} from '@lucide/vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import ServerStatus from '../components/ServerStatus.vue'
import ThemeSwitcher from '../components/ThemeSwitcher.vue'
import { useAuth } from '../stores/auth'
import { isDesktop } from '../composables/desktop'
import { ApiError } from '../api/client'
import type { UserRole } from '../api/types'
import AppButton from '../components/common/AppButton.vue'
import AppCard from '../components/common/AppCard.vue'
import AppInput from '../components/common/AppInput.vue'
import BrandMark from '../components/BrandMark.vue'

const emit = defineEmits<{ register: []; server: [] }>()

const { t } = useI18n()
const { signIn } = useAuth()

const selectedRole = ref<UserRole>('student')
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const errorKey = ref('')
const submitting = ref(false)

const LAST_USERNAME_KEY = 'auth.lastUsername'
const LAST_ROLE_KEY = 'auth.lastRole'

const roles: Array<{ role: UserRole; icon: typeof GraduationCap }> = [
  { role: 'student', icon: GraduationCap },
  { role: 'teacher', icon: BookOpen },
  { role: 'admin', icon: ShieldCheck },
]

const usernamePlaceholder = computed(() => {
  if (selectedRole.value === 'admin') return 'admin'
  if (selectedRole.value === 'teacher') return 'teacher1'
  return 'student1'
})

function selectRole(role: UserRole) {
  selectedRole.value = role
  localStorage.setItem(LAST_ROLE_KEY, role)
}

onMounted(() => {
  // Restore the last successful sign-in (role + username) so returning
  // users only type the password.
  const savedRole = localStorage.getItem(LAST_ROLE_KEY)
  if (savedRole && roles.some((entry) => entry.role === savedRole)) {
    selectedRole.value = savedRole as UserRole
  }
  const savedUsername = localStorage.getItem(LAST_USERNAME_KEY)
  if (savedUsername) {
    username.value = savedUsername
  } else if (selectedRole.value === 'teacher') {
    // Convenience for a first sign-in: the first account seeded is the teacher.
    username.value = 'teacher'
  }
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
    localStorage.setItem(LAST_ROLE_KEY, selectedRole.value)
  } catch (error) {
    errorKey.value = error instanceof ApiError ? error.code : ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-6 sm:pt-10">
    <header class="flex shrink-0 items-center justify-between gap-3 pb-6">
      <div class="flex min-w-0 items-center gap-2.5">
        <BrandMark :size="30" class="shrink-0" />
        <div class="min-w-0">
          <h1 class="truncate text-lg font-bold tracking-tight text-on-surface">
            {{ t('app.name') }}
          </h1>
          <p class="hidden truncate text-xs text-on-surface-variant sm:block">{{ t('app.tagline') }}</p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <ServerStatus />
        <ThemeSwitcher />
        <LanguageSwitcher />
        <!-- Desktop only: there the app hosts the server, so starting it is a
             thing the teacher does here rather than on another machine. -->
        <AppButton
          v-if="isDesktop()"
          variant="ghost"
          icon
          size="md"
          :aria-label="t('desktop.server.title')"
          :title="t('desktop.server.title')"
          @click="emit('server')"
        >
          <Server class="size-4" aria-hidden="true" />
        </AppButton>
      </div>
    </header>

    <div class="flex flex-1 flex-col justify-center py-4">
    <AppCard as="section" padding="lg" class="shadow-sm">
      <h2 class="text-lg font-semibold text-balance text-on-surface">
        {{ t('auth.chooseRole') }}
      </h2>
      <p class="mt-1 text-sm text-balance text-on-surface-variant">
        {{ t('auth.chooseRoleHint') }}
      </p>

      <!-- min-w-0 on the grid cells: without it a long label ("Адміністратор")
           becomes the column's minimum width and pushes the card wider than the
           screen. M3 says a label never wraps - so the labels stay short and the
           layout stays still. -->
      <div class="mt-5 grid grid-cols-3 gap-2">
        <button
          v-for="{ role, icon } in roles"
          :key="role"
          type="button"
          :aria-pressed="selectedRole === role"
          @click="selectRole(role)"
          class="flex min-w-0 flex-col items-center gap-1.5 rounded-[var(--radius-control)] border px-1 py-3 text-xs font-semibold transition-[background-color,border-color,color,transform] duration-[var(--motion-short)] ease-[var(--ease-standard)] active:scale-[0.97] motion-reduce:active:scale-100"
          :class="
            selectedRole === role
              ? 'border-transparent bg-primary text-on-primary'
              : 'border-outline-variant text-on-surface-variant hover:border-outline hover:bg-surface-container-high'
          "
        >
          <component :is="icon" class="size-5 shrink-0" aria-hidden="true" />
          <span class="max-w-full truncate">{{ t(`role.${role}`) }}</span>
        </button>
      </div>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs font-medium text-on-surface-variant">
            {{ t('auth.username') }}
          </span>
          <AppInput
            v-model="username"
            type="text"
            autocomplete="username"
            :placeholder="usernamePlaceholder"
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
        <template v-if="selectedRole === 'student'">
          <span class="text-on-surface-variant">{{ t('auth.needAccount') }}</span>
          <button
            type="button"
            class="ml-1 font-semibold text-on-surface underline underline-offset-2"
            @click="emit('register')"
          >
            {{ t('auth.register') }}
          </button>
        </template>
        <span v-else class="text-on-surface-variant">{{ t('auth.accountHint') }}</span>
      </div>
    </AppCard>

    <p class="mt-6 text-center text-xs text-on-surface-variant">
      {{ t('footer.message') }}
    </p>
    </div>
  </main>
</template>