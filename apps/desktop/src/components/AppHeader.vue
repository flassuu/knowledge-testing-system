<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Server } from '@lucide/vue'
import ServerStatus from './ServerStatus.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import AccountMenu from './AccountMenu.vue'
import AppButton from './common/AppButton.vue'
import BrandMark from './BrandMark.vue'
import OfflineBanner from './common/OfflineBanner.vue'
import { useAuth } from '../stores/auth'

const props = defineProps<{
  /** Desktop only: the app hosts the server, and has no frame to drag. */
  hosted?: boolean
}>()
const emit = defineEmits<{ server: [] }>()

const { t } = useI18n()
const { user } = useAuth()

const roleLabel = computed(() => t(`role.${user.value?.role ?? 'student'}`))
</script>

<template>
  <!--
    On Linux the frame is off (`tauri.linux.conf.json`), so the empty space here
    is what drags the window: `data-tauri-drag-region` is the whole of it. On the
    other platforms the platform draws its own frame and this is a bar under it.
  -->
  <header class="sticky top-0 z-30 border-b border-outline-variant bg-surface-container">
    <div class="flex h-14 items-center gap-3 px-3 sm:px-4">
      <BrandMark :size="24" class="shrink-0" data-tauri-drag-region />
      <h1
        class="min-w-0 truncate text-base font-bold tracking-tight text-on-surface"
        data-tauri-drag-region
      >
        {{ t('app.name') }}
      </h1>
      <!-- Only for staff: a student does not need to be told what they are. -->
      <span
        v-if="user && user.role !== 'student'"
        class="hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold sm:inline"
        :class="
          user.role === 'admin'
            ? 'bg-primary-container text-on-primary-container'
            : 'bg-secondary-container text-on-secondary-container'
        "
      >
        {{ roleLabel }}
      </span>

      <!-- The empty space is the drag handle; the controls keep their own boxes. -->
      <div class="min-w-4 flex-1 self-stretch" data-tauri-drag-region />

      <div class="flex shrink-0 items-center gap-2">
        <ServerStatus />
        <LanguageSwitcher />
        <!-- Only somebody signed in has an account to show, and the button opens
             the theme, the language and signing out. -->
        <AccountMenu v-if="user" :hosted="props.hosted" @server="emit('server')" />
        <!-- Starting the server is a thing the teacher does here before signing
             in, so it stays a control of its own rather than a menu row. -->
        <AppButton
          v-if="props.hosted"
          variant="ghost"
          icon
          :aria-label="t('desktop.server.title')"
          :title="t('desktop.server.title')"
          @click="emit('server')"
        >
          <Server class="size-4" aria-hidden="true" />
        </AppButton>
      </div>
    </div>
    <OfflineBanner />
  </header>
</template>