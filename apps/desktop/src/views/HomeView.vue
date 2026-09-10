<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'

const { t } = useI18n()

const serverOnline = ref<boolean | null>(null)
const name = ref('')
const greetMsg = ref('')

async function checkServer() {
  try {
    const res = await fetch('/api/health')
    serverOnline.value = res.ok
  } catch {
    serverOnline.value = false
  }
}

async function greet() {
  greetMsg.value = await invoke<string>('greet', { name: name.value || 'World' })
}

onMounted(() => {
  void checkServer()
})
</script>

<template>
  <main class="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-6 py-8">
    <header class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-slate-800">{{ t('app.name') }}</h1>
      <LanguageSwitcher />
    </header>

    <section class="py-10 text-center">
      <h2 class="text-2xl font-semibold text-slate-900">{{ t('home.title') }}</h2>
      <p class="mt-2 text-slate-500">{{ t('home.scaffoldNote') }}</p>
    </section>

    <div class="grid gap-4">
      <div
        class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div>
          <h3 class="text-sm font-semibold text-slate-800">
            {{ t('home.rustBridge.label') }}
          </h3>
          <p class="text-xs text-slate-400">
            {{ t('home.rustBridge.description') }}
          </p>
        </div>
        <form @submit.prevent="greet" class="flex items-center gap-2">
          <input
            v-model="name"
            :placeholder="t('home.rustBridge.placeholder')"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <button
            type="submit"
            class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            {{ t('home.rustBridge.button') }}
          </button>
        </form>
      </div>
      <p v-if="greetMsg" class="text-center text-sm text-slate-600">
        {{ t('home.rustBridge.result', { message: greetMsg }) }}
      </p>

      <div
        class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h3 class="text-sm font-semibold text-slate-800">
          {{ t('home.server.label') }}
        </h3>
        <span
          class="inline-flex items-center gap-2 rounded-full px-4 py-1 text-sm"
          :class="
            serverOnline === null
              ? 'bg-slate-100 text-slate-500'
              : serverOnline
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
          "
        >
          <span
            class="size-2 rounded-full"
            :class="
              serverOnline === null
                ? 'bg-slate-400'
                : serverOnline
                  ? 'bg-emerald-500'
                  : 'bg-rose-500'
            "
          />
          {{
            serverOnline === null
              ? t('home.server.checking')
              : serverOnline
                ? t('home.server.online')
                : t('home.server.offline')
          }}
        </span>
      </div>
    </div>

    <p class="mt-auto pt-8 text-center text-xs text-slate-400">
      {{ t('home.nextPhase') }}
    </p>
  </main>
</template>