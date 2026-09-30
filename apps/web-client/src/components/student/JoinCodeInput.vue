<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const code = defineModel<string>({ required: true })
const disabled = defineModel<boolean>('disabled', { default: false })

const { t } = useI18n()

function onInput(event: Event): void {
  const input = event.target as HTMLInputElement
  code.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}
</script>

<template>
  <label
    class="flex w-full items-center gap-3 rounded-xl border border-outline bg-surface px-3 py-2.5 focus-within:border-primary sm:max-w-56"
  >
    <span class="sr-only">{{ t('student.join.codeLabel') }}</span>
    <input
      :value="code"
      type="text"
      inputmode="text"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      :disabled="disabled"
      :placeholder="t('student.join.codePlaceholder')"
      class="w-full bg-transparent font-mono text-lg font-bold tracking-[0.35em] text-on-surface placeholder:tracking-[0.2em] placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-on-surface-variant focus:outline-none"
      @input="onInput"
    />
  </label>
</template>
