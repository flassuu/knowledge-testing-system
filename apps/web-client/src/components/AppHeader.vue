<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ServerStatus from './ServerStatus.vue'
import ThemeSwitcher from './ThemeSwitcher.vue'
import { useAuth } from '../stores/auth'
import AppButton from '../components/common/AppButton.vue'
import BrandMark from '../components/BrandMark.vue'

const { t } = useI18n()
const { user, signOut } = useAuth()

const roleLabel = computed(() => t(`role.${user.value?.role ?? 'student'}`))

const roleBadgeClass: Record<string, string> = {
  admin: 'bg-primary-container text-on-primary-container',
  teacher: 'bg-secondary-container text-on-secondary-container',
  student: 'bg-warning-container text-on-warning-container',
}
</script>

<template>
  <header
    class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-outline-variant bg-surface-container px-4 py-2.5 sm:px-6"
  >
    <div class="flex min-w-0 items-center gap-2">
      <BrandMark :size="26" class="shrink-0" />
      <h1 class="truncate text-base font-bold tracking-tight text-on-surface">
        {{ t('app.name') }}
      </h1>
      <span
        v-if="user"
        class="hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold sm:inline"
        :class="roleBadgeClass[user.role] ?? 'bg-surface-container-high text-on-surface-variant'"
      >
        {{ roleLabel }}
      </span>
    </div>

    <!-- Controls keep their size whatever the labels say, so the header never
         reflows between locales. -->
    <div class="flex shrink-0 items-center gap-1">
      <ServerStatus />
      <span class="hidden max-w-40 truncate text-sm text-on-surface-variant lg:inline">
        {{ user?.fullName }}
      </span>
      <ThemeSwitcher />
      <LanguageSwitcher />
      <AppButton v-if="user" variant="secondaryMuted" size="sm" @click="signOut">
        {{ t('auth.signOut') }}
      </AppButton>
    </div>
  </header>
</template>