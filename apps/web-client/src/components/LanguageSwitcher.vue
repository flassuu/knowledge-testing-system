<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { supportedLocales, syncDocumentLocale, type Locale } from '../i18n'

const { t, locale } = useI18n()

function setLocale(next: Locale) {
  locale.value = next
  syncDocumentLocale(next)
  localStorage.setItem('locale', next)
}
</script>

<template>
  <div class="flex items-center gap-1">
    <span class="mr-1 hidden text-xs text-on-surface-variant sm:inline">
      {{ t('common.language') }}:
    </span>
    <button
      v-for="code in supportedLocales"
      :key="code"
      type="button"
      @click="setLocale(code)"
      class="min-h-9 rounded-md px-3 text-xs font-semibold uppercase transition-colors disabled:cursor-default disabled:opacity-100"
      :disabled="locale === code"
      :aria-pressed="locale === code"
      :class="
        locale === code
          ? 'bg-primary text-on-primary'
          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
      "
    >
      {{ code }}
    </button>
  </div>
</template>