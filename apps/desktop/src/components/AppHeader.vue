<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ServerStatus from './ServerStatus.vue'
import { useAuth } from '../stores/auth'

const { t } = useI18n()
const { user, signOut } = useAuth()

const roleLabel = computed(() => t(`role.${user.value?.role ?? 'student'}`))

const roleBadgeClass: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700',
  teacher: 'bg-sky-100 text-sky-700',
  student: 'bg-amber-100 text-amber-700',
}
</script>

<template>
  <header
    class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6"
  >
    <div class="flex min-w-0 items-center gap-2">
      <h1 class="truncate text-base font-bold text-slate-800">
        {{ t('app.name') }}
      </h1>
      <span
        v-if="user"
        class="hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold sm:inline"
        :class="roleBadgeClass[user.role] ?? 'bg-slate-100 text-slate-600'"
      >
        {{ roleLabel }}
      </span>
    </div>
    <div class="flex shrink-0 items-center gap-2 sm:gap-3">
      <ServerStatus />
      <span class="hidden max-w-40 truncate text-sm text-slate-500 md:inline">
        {{ user?.fullName }}
      </span>
      <LanguageSwitcher />
      <button
        v-if="user"
        type="button"
        @click="signOut"
        class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        {{ t('auth.signOut') }}
      </button>
    </div>
  </header>
</template>