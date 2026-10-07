<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getConfirmState, settleConfirm } from '../../composables/confirm'
import { useDialogFocus } from '../../composables/focusTrap'
import AppButton from '../../components/common/AppButton.vue'
import AppDialog from './AppDialog.vue'

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
  <AppDialog v-if="state.open" :label="state.message" @close="settleConfirm(false)">
    <div ref="panelRef" class="p-5">
      <p class="text-base text-on-surface">{{ state.message }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <AppButton variant="secondary" ref="cancelRef" @click="settleConfirm(false)">
          {{ t('common.cancel') }}
        </AppButton>
        <AppButton variant="danger" @click="settleConfirm(true)">
          {{ t('common.confirm') }}
        </AppButton>
      </div>
    </div>
  </AppDialog>
</template>
