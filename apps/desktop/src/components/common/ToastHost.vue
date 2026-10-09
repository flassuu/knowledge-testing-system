<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { X } from '@lucide/vue'
import { dismissToast, getToastState, type ToastKind } from '../../composables/toast'
import AppButton from '../../components/common/AppButton.vue'

const { t } = useI18n()
const state = getToastState()

const kindClass: Record<ToastKind, string> = {
  success: 'border-l-success',
  error: 'border-l-error',
  info: 'border-l-outline',
}
</script>

<template>
  <Teleport to="body">
    <!-- Bottom right: a message reports, it does not block. At the top it sits
         over the header, which is the one row a teacher must be able to read at
         a glance while a session is running. -->
    <div
      aria-live="polite"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-4 sm:items-end sm:pr-6"
    >
      <div class="flex w-full max-w-sm flex-col items-stretch gap-2">
        <div
          v-for="item in state.items"
          :key="item.id"
          role="status"
          class="pointer-events-auto flex w-full items-start gap-2 rounded-[var(--radius-control)] border border-outline-variant border-l-4 bg-surface-container px-3 py-2.5 shadow-lg"
          :class="kindClass[item.kind]"
        >
          <p class="min-w-0 flex-1 text-sm text-on-surface">{{ item.message }}</p>
          <AppButton
  variant="ghost"
  class="shrink-0"
  :aria-label="t('common.dismiss')"
  @click="dismissToast(item.id)"
>
            <X class="size-3.5" aria-hidden="true" />
          </AppButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
