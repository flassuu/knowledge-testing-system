<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Moon, Sun } from '@lucide/vue'
import { getThemeState, toggleTheme } from '../composables/theme'

const { t } = useI18n()
const theme = getThemeState()
</script>

<template>
  <button
    type="button"
    :aria-label="theme.mode === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')"
    :title="theme.mode === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')"
    class="inline-flex size-8 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
    @click="toggleTheme"
  >
    <Sun v-if="theme.mode === 'dark'" class="size-4" aria-hidden="true" />
    <Moon v-else class="size-4" aria-hidden="true" />
  </button>
</template>