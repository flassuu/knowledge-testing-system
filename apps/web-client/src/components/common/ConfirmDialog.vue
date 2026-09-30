<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getConfirmState, settleConfirm } from '../../composables/confirm'

const { t } = useI18n()
const state = getConfirmState()
const cancelRef = ref<HTMLButtonElement | null>(null)

watch(
  () => state.open,
  async (open) => {
    if (open) {
      await nextTick()
      cancelRef.value?.focus()
    }
  },
)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && state.open) settleConfirm(false)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
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
      <div class="relative w-full max-w-sm rounded-xl bg-surface-container p-5 shadow-xl">
        <p class="text-sm text-on-surface">{{ state.message }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            ref="cancelRef"
            type="button"
            @click="settleConfirm(false)"
            class="rounded-lg border border-outline bg-surface px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            @click="settleConfirm(true)"
            class="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-on-error hover:opacity-90"
          >
            {{ state.confirmLabel || t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>