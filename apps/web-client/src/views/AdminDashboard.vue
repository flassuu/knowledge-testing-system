<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { UserCheck } from '@lucide/vue'
import AppHeader from '../components/AppHeader.vue'
import UsersTab from '../components/admin/UsersTab.vue'
import ParticipantsTab from '../components/admin/ParticipantsTab.vue'
import SystemTab from '../components/admin/SystemTab.vue'
import { listUsers } from '../api/users'
import type { UserStatus } from '../api/types'
import AppButton from '../components/common/AppButton.vue'

const { t } = useI18n()

type AdminTab = 'users' | 'participants' | 'system'
const activeTab = ref<AdminTab>('users')
const focusStatus = ref<UserStatus | ''>('')
const pendingCount = ref(0)

async function countPending(): Promise<void> {
  try {
    pendingCount.value = (await listUsers({ status: 'pending' })).length
  } catch {
    // The users tab surfaces its own error; a stale badge is not worth an alert.
    pendingCount.value = 0
  }
}

function reviewPending(): void {
  focusStatus.value = 'pending'
  activeTab.value = 'users'
}

onMounted(countPending)
</script>

<template>
  <div class="min-h-dvh bg-surface">
    <AppHeader />

    <main class="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h2 class="text-xl font-semibold text-on-surface">
        {{ t('admin.heading') }}
      </h2>
      <p class="mt-1 text-sm text-on-surface-variant">{{ t('admin.subheading') }}</p>

      <div
        v-if="pendingCount > 0"
        class="mt-4 flex flex-col gap-3 rounded-2xl border border-outline-variant bg-warning-container p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="flex items-center gap-2 text-sm font-semibold text-on-warning-container">
          <UserCheck class="size-4 shrink-0" aria-hidden="true" />
          {{ t('admin.pendingBanner', { count: pendingCount }) }}
        </p>
        <AppButton variant="warning" class="shrink-0 self-start sm:self-auto" @click="reviewPending">
          {{ t('admin.pendingReview') }}
        </AppButton>
      </div>

      <div class="mt-5 flex gap-1 rounded-xl border border-outline-variant bg-surface-container p-1 shadow-sm">
        <button
          v-for="tab in ['users', 'participants', 'system'] as AdminTab[]"
          :key="tab"
          type="button"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === tab ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'"
          @click="activeTab = tab"
        >
          {{ t(`admin.tabs.${tab}`) }}
          <span
            v-if="tab === 'users' && pendingCount > 0"
            class="rounded-full px-1.5 py-0.5 text-[11px] font-bold"
            :class="activeTab === tab ? 'bg-on-primary text-primary' : 'bg-warning-container text-on-warning-container'"
          >
            {{ pendingCount }}
          </span>
        </button>
      </div>

      <div class="mt-5">
        <UsersTab
          v-if="activeTab === 'users'"
          :focus-status="focusStatus"
          @changed="countPending"
        />
        <ParticipantsTab v-else-if="activeTab === 'participants'" />
        <SystemTab v-else />
      </div>

      <p class="mt-8 text-center text-xs text-on-surface-variant">
        {{ t('footer.message') }}
      </p>
    </main>
  </div>
</template>
