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
        class="absolute inset-0 bg-slate-900/40"
        @click="settleConfirm(false)"
      />
      <div class="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <p class="text-sm text-slate-700">{{ state.message }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            ref="cancelRef"
            type="button"
            @click="settleConfirm(false)"
            class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            @click="settleConfirm(true)"
            class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            {{ state.confirmLabel || t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>