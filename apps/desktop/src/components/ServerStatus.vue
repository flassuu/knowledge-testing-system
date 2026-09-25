<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const state = ref<'checking' | 'online' | 'offline'>('checking')

async function check() {
  state.value = 'checking'
  try {
    const res = await fetch('/api/health', { cache: 'no-store' })
    state.value = res.ok ? 'online' : 'offline'
  } catch {
    state.value = 'offline'
  }
}

onMounted(check)
</script>

<template>
  <button
    type="button"
    @click="check"
    title="Server status — click to re-check"
    class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors"
    :class="
      state === 'checking'
        ? 'bg-slate-100 text-slate-500'
        : state === 'online'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-rose-50 text-rose-700'
    "
  >
    <span
      class="size-2 rounded-full"
      :class="
        state === 'checking'
          ? 'bg-slate-400'
          : state === 'online'
            ? 'bg-emerald-500'
            : 'bg-rose-500'
      "
    />
    {{ t(`server.${state}`) }}
  </button>
</template>