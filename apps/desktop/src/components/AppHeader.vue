<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info } from '@lucide/vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ServerStatus from './ServerStatus.vue'
import ThemeSwitcher from './ThemeSwitcher.vue'
import { useAuth } from '../stores/auth'
import AppButton from '../components/common/AppButton.vue'
import AboutDialog from '../components/common/AboutDialog.vue'
// Desktop-only, like the API base: the web client has no version to show.
import { isDesktop } from '../composables/desktop'

const { t } = useI18n()
const { user, signOut } = useAuth()

const aboutOpen = ref(false)
// The environment never changes at runtime, so this is decided once per mount
// instead of on every render.
const desktop = isDesktop()

const roleLabel = computed(() => t(`role.${user.value?.role ?? 'student'}`))

const roleBadgeClass: Record<string, string> = {
  admin: 'bg-primary-container text-on-primary-container',
  teacher: 'bg-secondary-container text-on-secondary-container',
  student: 'bg-warning-container text-on-warning-container',
}
</script>

<template>
  <header
    class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-outline-variant bg-surface-container px-4 py-3 sm:px-6"
  >
    <div class="flex min-w-0 items-center gap-2">
      <h1 class="truncate text-base font-bold text-on-surface">
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
    <div class="flex shrink-0 items-center gap-2 sm:gap-3">
      <ServerStatus />
      <span class="hidden max-w-40 truncate text-sm text-on-surface-variant md:inline">
        {{ user?.fullName }}
      </span>
      <ThemeSwitcher />
      <LanguageSwitcher />
      <AppButton
        v-if="desktop"
        variant="ghost"
        size="icon"
        :aria-label="t('common.about.title')"
        @click="aboutOpen = true"
      >
        <Info class="size-4" aria-hidden="true" />
      </AppButton>
      <AppButton
        v-if="user"
        @click="signOut"
        variant="secondaryMuted"
        size="sm"
      >
        {{ t('auth.signOut') }}
      </AppButton>
    </div>
  </header>

  <AboutDialog :open="aboutOpen" @close="aboutOpen = false" />
</template>