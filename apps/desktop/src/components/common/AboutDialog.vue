<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info, X } from '@lucide/vue'
import { apiUrl } from '../../api/client'
import { appVersion } from '../../composables/desktop'
import AppButton from './AppButton.vue'
import { useDialogFocus } from '../../composables/focusTrap'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const panelRef = ref<HTMLElement | null>(null)
const closeRef = ref<HTMLButtonElement | null>(null)
const version = ref('')

useDialogFocus(
  () => props.open,
  () => emit('close'),
  panelRef,
  closeRef,
)

onMounted(async () => {
  version.value = (await appVersion()) ?? t('common.about.versionUnknown')
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="t('common.about.title')"
    >
      <div class="absolute inset-0 bg-scrim" @click="emit('close')" />
      <div
        ref="panelRef"
        class="relative w-full max-w-sm overflow-hidden rounded-2xl bg-surface-container shadow-xl"
      >
        <header class="flex items-start justify-between gap-3 border-b border-outline-variant p-4">
          <div class="min-w-0">
            <h3 class="flex items-center gap-2 text-base font-semibold text-on-surface">
              <Info class="size-4 shrink-0" aria-hidden="true" />
              {{ t('app.name') }}
            </h3>
            <p class="mt-0.5 text-xs text-on-surface-variant">
              {{ t('common.about.tagline') }}
            </p>
          </div>
          <AppButton variant="ghost" size="icon" ref="closeRef" :aria-label="t('common.close')" @click="emit('close')">
            <X class="size-4" aria-hidden="true" />
          </AppButton>
        </header>

        <dl class="space-y-3 p-4 text-sm">
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-on-surface-variant">{{ t('common.about.version') }}</dt>
            <dd class="font-semibold tabular-nums text-on-surface">{{ version }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-on-surface-variant">{{ t('common.about.server') }}</dt>
            <dd class="min-w-0 truncate font-mono text-xs text-on-surface">{{ apiUrl('') }}</dd>
          </div>
        </dl>

        <footer class="border-t border-outline-variant p-4">
          <p class="mb-3 text-xs text-on-surface-variant">
            {{ t('common.about.offline') }}
          </p>
          <AppButton variant="primary" class="sm:w-auto" @click="emit('close')">
            {{ t('common.close') }}
          </AppButton>
        </footer>
      </div>
    </div>
  </Teleport>
</template>