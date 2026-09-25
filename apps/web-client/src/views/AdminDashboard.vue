<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppHeader from '../components/AppHeader.vue'
import UsersTab from '../components/admin/UsersTab.vue'
import ParticipantsTab from '../components/admin/ParticipantsTab.vue'
import SystemTab from '../components/admin/SystemTab.vue'

const { t } = useI18n()

type AdminTab = 'users' | 'participants' | 'system'
const activeTab = ref<AdminTab>('users')
</script>

<template>
  <div class="min-h-dvh bg-slate-50">
    <AppHeader />

    <main class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h2 class="text-xl font-semibold text-slate-900">
        {{ t('admin.heading') }}
      </h2>
      <p class="mt-1 text-sm text-slate-500">{{ t('admin.subheading') }}</p>

      <div class="mt-5 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          v-for="tab in ['users', 'participants', 'system'] as AdminTab[]"
          :key="tab"
          type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="activeTab = tab"
        >
          {{ t(`admin.tabs.${tab}`) }}
        </button>
      </div>

      <div class="mt-5">
        <UsersTab v-if="activeTab === 'users'" />
        <ParticipantsTab v-else-if="activeTab === 'participants'" />
        <SystemTab v-else />
      </div>

      <p class="mt-8 text-center text-xs text-slate-400">
        {{ t('footer.message') }}
      </p>
    </main>
  </div>
</template>