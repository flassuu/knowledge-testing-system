<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Moon, Sun } from '@lucide/vue'
import { getThemeState, toggleTheme } from '../composables/theme'
import AppButton from '../components/common/AppButton.vue'

const { t } = useI18n()
const theme = getThemeState()
</script>

<template>
  <!-- Fixed square, like every other header control: 40px whatever the mode. -->
  <AppButton
    variant="ghost"
    icon
    :aria-label="theme.mode === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')"
    :title="theme.mode === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')"
    @click="toggleTheme"
  >
    <Sun v-if="theme.mode === 'dark'" class="size-4" aria-hidden="true" />
    <Moon v-else class="size-4" aria-hidden="true" />
  </AppButton>
</template>