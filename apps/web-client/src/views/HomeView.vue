<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'

const { t } = useI18n()

const serverOnline = ref<boolean | null>(null)

async function checkServer() {
  try {
    const res = await fetch('/api/health')
    serverOnline.value = res.ok
  } catch {
    serverOnline.value = false
  }
}

onMounted(checkServer)
</script>

<template>
  <main
    class="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-6 py-8"
  >
    <header class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-slate-800">{{ t('app.name') }}</h1>
      <LanguageSwitcher />
    </header>

    <section class="space-y-4 py-12 text-center">
      <h2 class="text-2xl font-semibold text-slate-900">
        {{ t('home.welcome') }}
      </h2>
      <p class="text-slate-500">{{ t('home.scaffoldNote') }}</p>
    </section>

    <footer class="space-y-3 text-center">
      <div
        class="inline-flex items-center gap-2 rounded-full px-4 py-1 text-sm"
        :class="
          serverOnline === null
            ? 'bg-slate-100 text-slate-500'
            : serverOnline
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
        "
      >
        <span class="relative flex size-2">
          <span
            class="absolute inline-flex size-full animate-ping rounded-full opacity-75"
            :class="
              serverOnline === null
                ? 'bg-slate-400'
                : serverOnline
                  ? 'bg-emerald-400'
                  : 'bg-rose-400'
            "
          />
          <span
            class="relative inline-flex size-2 rounded-full"
            :class="
              serverOnline === null
                ? 'bg-slate-400'
                : serverOnline
                  ? 'bg-emerald-500'
                  : 'bg-rose-500'
            "
          />
        </span>
        {{ t('home.server') }}:
        {{
          serverOnline === null
            ? t('common.loading')
            : serverOnline
              ? t('home.serverOnline')
              : t('home.serverOffline')
        }}
      </div>
      <p class="text-xs text-slate-400">{{ t('footer.message') }}</p>
    </footer>
  </main>
</template>