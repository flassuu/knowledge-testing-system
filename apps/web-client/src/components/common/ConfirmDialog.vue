<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getConfirmState, settleConfirm } from '../../composables/confirm'
import { useDialogFocus } from '../../composables/focusTrap'
import AppButton from '../../components/common/AppButton.vue'

const { t } = useI18n()
const state = getConfirmState()
const panelRef = ref<HTMLElement | null>(null)
const cancelRef = ref<HTMLButtonElement | null>(null)

useDialogFocus(
  () => state.open,
  () => settleConfirm(false),
  panelRef,
  cancelRef,
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="state.message"
    >
      <div
        class="absolute inset-0 bg-scrim"
        @click="settleConfirm(false)"
      />
      <div
        ref="panelRef"
        class="relative w-full max-w-sm rounded-xl bg-surface-container p-5 shadow-xl"
      >
        <p class="text-sm text-on-surface">{{ state.message }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <AppButton variant="secondary" ref="cancelRef" @click="settleConfirm(false)">
            {{ t('common.cancel') }}
          </AppButton>
          <AppButton variant="danger" @click="settleConfirm(true)">
            {{ state.confirmLabel || t('common.confirm') }}
          </AppButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>