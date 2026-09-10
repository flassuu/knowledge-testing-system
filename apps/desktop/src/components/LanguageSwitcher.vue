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
    <span class="mr-1 hidden text-xs text-slate-400 sm:inline">
      {{ t('common.language') }}:
    </span>
    <button
      v-for="code in supportedLocales"
      :key="code"
      type="button"
      @click="setLocale(code)"
      class="rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors disabled:cursor-default"
      :disabled="locale === code"
      :class="
        locale === code
          ? 'bg-slate-900 text-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      "
    >
      {{ code }}
    </button>
  </div>
</template>