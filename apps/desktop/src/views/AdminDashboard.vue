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
  <div class="min-h-dvh bg-surface">
    <AppHeader />

    <main class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h2 class="text-xl font-semibold text-on-surface">
        {{ t('admin.heading') }}
      </h2>
      <p class="mt-1 text-sm text-on-surface-variant">{{ t('admin.subheading') }}</p>

      <div class="mt-5 flex gap-1 rounded-xl border border-outline-variant bg-surface-container p-1 shadow-sm">
        <button
          v-for="tab in ['users', 'participants', 'system'] as AdminTab[]"
          :key="tab"
          type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === tab ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'"
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

      <p class="mt-8 text-center text-xs text-on-surface-variant">
        {{ t('footer.message') }}
      </p>
    </main>
  </div>
</template>