<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { supportedLocales } from '../i18n'

const { t, locale } = useI18n()

function setLocale(next: (typeof supportedLocales)[number]) {
  locale.value = next
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
      class="rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors disabled:cursor-default disabled:opacity-100"
      :disabled="locale === code"
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