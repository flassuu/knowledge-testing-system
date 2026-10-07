<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleCheck } from '@lucide/vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import ThemeSwitcher from '../components/ThemeSwitcher.vue'
import { register } from '../api/auth'
import { previewClassKey } from '../api/classrooms'
import { ApiError } from '../api/client'
import type { ClassPreview } from '../api/types'
import AppButton from '../components/common/AppButton.vue'
import AppCard from '../components/common/AppCard.vue'
import AppInput from '../components/common/AppInput.vue'

/**
 * Creating a student account, with an optional class key.
 *
 * The key is the whole reason a teacher can run a class alone: it approves the
 * account without an admin in the room. It is optional and it is checked before
 * the password is typed, so a student learns "Class 9A · Olena M." - or that
 * the code is wrong - before they have committed to anything.
 */
const emit = defineEmits<{ back: [] }>()

const { t } = useI18n()

const fullName = ref('')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const classKey = ref('')
const errorKey = ref('')
const submitting = ref(false)

/** null = nothing typed yet; false = the code is not usable. */
const classPreview = ref<ClassPreview | null>(null)
const classChecked = ref(false)
const classErrorKey = ref('')
const checkingClass = ref(false)

/** What happened to the account: approved through a key, or waiting for an admin. */
const created = ref<{ approved: boolean; className?: string } | null>(null)

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
    case 'INVALID_CLASS_KEY':
      return t('auth.errors.classKeyWrong')
    case 'VALIDATION':
      return t('auth.errors.validation')
    case 'NETWORK':
      return t('auth.errors.network')
    default:
      return t('auth.errors.generic')
  }
}

/**
 * Asks the server what the code leads to. Runs on blur rather than on every
 * keystroke: a lookup per character would be both rude to the server and
 * useless, since nobody finishes typing a six-character code in under a second.
 */
async function checkClass(): Promise<void> {
  const key = classKey.value.trim()
  if (key === '') {
    classChecked.value = false
    classPreview.value = null
    classErrorKey.value = ''
    return
  }
  checkingClass.value = true
  classErrorKey.value = ''
  try {
    classPreview.value = await previewClassKey(key)
    classChecked.value = true
  } catch (error) {
    classPreview.value = null
    classChecked.value = true
    classErrorKey.value = error instanceof ApiError && error.code === 'NETWORK' ? 'network' : 'wrong'
  } finally {
    checkingClass.value = false
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
    const result = await register({
      fullName: fullName.value.trim(),
      username: username.value.trim(),
      password: password.value,
      ...(classKey.value.trim() === '' ? {} : { classKey: classKey.value.trim() }),
    })
    created.value = {
      approved: result.user.status === 'approved',
      className: result.viaClass?.className,
    }
  } catch (error) {
    errorKey.value = error instanceof ApiError ? error.code : ''
  } finally {
    submitting.value = false
  }
}

function back() {
  created.value = null
  emit('back')
}

// A QR code of the class link carries the key in the URL; pick it up on arrival.
onMounted(() => {
  const key = new URLSearchParams(window.location.search).get('class')
  if (!key) return
  classKey.value = key.trim().toUpperCase()
  void checkClass()
})
</script>

<template>
  <main
    class="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10"
  >
    <header class="mb-8 flex items-center justify-between">
      <h1 class="text-lg font-bold text-on-surface">{{ t('app.name') }}</h1>
      <div class="flex items-center gap-2">
        <ThemeSwitcher />
        <LanguageSwitcher />
        <AppButton
          type="button"
          @click="back"
          variant="secondaryMuted" size="sm"
        >
          {{ t('auth.backToLogin') }}
        </AppButton>
      </div>
    </header>

    <section
      v-if="created"
      class="rounded-2xl border border-outline-variant bg-success-container p-6 text-center shadow-sm"
    >
      <p class="text-lg font-semibold text-success">
        {{ created.approved ? t('auth.readyTitle') : t('auth.pendingTitle') }}
      </p>
      <p class="mt-2 text-sm text-success">
        <template v-if="created.approved">
          {{ t('auth.readyNote', { className: created.className ?? '' }) }}
        </template>
        <template v-else>{{ t('auth.pendingNote') }}</template>
      </p>
      <AppButton variant="success" class="mt-5" @click="back">
        {{ t('auth.backToLogin') }}
      </AppButton>
    </section>

    <AppCard as="section" padding="lg" v-else class="shadow-sm">
      <h2 class="text-lg font-semibold text-on-surface">
        {{ t('auth.registerHeading') }}
      </h2>
      <p class="mt-1 text-sm text-on-surface-variant">
        {{ t('auth.registerHint') }}
      </p>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs font-medium text-on-surface-variant">
            {{ t('auth.fullName') }}
          </span>
          <AppInput v-model="fullName" type="text" autocomplete="name" class="mt-1" />
        </label>

        <label class="block">
          <span class="text-xs font-medium text-on-surface-variant">
            {{ t('auth.username') }}
          </span>
          <AppInput v-model="username" type="text" autocomplete="username" class="mt-1" />
        </label>

        <!--
          Optional on purpose: a student without a code registers exactly as
          before and waits for an admin. A student with one is in immediately.
        -->
        <div>
          <label class="block">
            <span class="flex items-baseline gap-2 text-xs font-medium text-on-surface-variant">
              {{ t('auth.classKey') }}
              <span class="font-normal text-on-surface-variant/80">{{ t('auth.classKeyOptional') }}</span>
            </span>
            <AppInput
              v-model="classKey"
              type="text"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              maxlength="7"
              placeholder="ABC234"
              class="mt-1 font-mono uppercase tracking-[0.2em]"
              @blur="checkClass"
            />
          </label>

          <p
            v-if="checkingClass"
            class="mt-1.5 text-xs text-on-surface-variant"
          >
            {{ t('common.loading') }}
          </p>
          <p
            v-else-if="classPreview"
            class="mt-1.5 flex items-start gap-2 rounded-[var(--radius-control)] bg-success-container px-3 py-2 text-xs text-on-success-container"
          >
            <CircleCheck class="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>
              {{ t('auth.classKeyFound') }}
              <span class="font-semibold">{{ classPreview.className }}</span>
              <template v-if="classPreview.teacherName">
                · {{ classPreview.teacherName }}
              </template>
            </span>
          </p>
          <p
            v-else-if="classErrorKey"
            class="mt-1.5 rounded-[var(--radius-control)] bg-error-container px-3 py-2 text-xs text-on-error-container"
          >
            {{
              classErrorKey === 'network'
                ? t('auth.errors.network')
                : t('auth.errors.classKeyWrong')
            }}
          </p>
        </div>

        <label class="block">
          <span class="text-xs font-medium text-on-surface-variant">
            {{ t('auth.password') }}
          </span>
          <AppInput v-model="password" type="password" autocomplete="new-password" class="mt-1" />
        </label>

        <label class="block">
          <span class="text-xs font-medium text-on-surface-variant">
            {{ t('auth.confirmPassword') }}
          </span>
          <AppInput v-model="confirmPassword" type="password" autocomplete="new-password" class="mt-1" />
        </label>

        <p
          v-if="errorKey"
          role="alert"
          class="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
        >
          {{ errorMessage(errorKey) }}
        </p>

        <AppButton variant="primary" type="submit" :disabled="submitting" class="w-full">
          {{ submitting ? t('common.loading') : t('auth.register') }}
        </AppButton>
      </form>
    </AppCard>
  </main>
</template>