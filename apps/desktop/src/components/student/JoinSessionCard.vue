<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LogIn } from '@lucide/vue'
import JoinCodeInput from './JoinCodeInput.vue'
import AppButton from '../../components/common/AppButton.vue'
import AppCard from '../../components/common/AppCard.vue'

const emit = defineEmits<{ joined: [] }>()

const { t } = useI18n()

/** Only letters and digits reach the server, upper-cased as the teacher reads it out. */
const code = defineModel<string>({ required: true })

const busy = defineModel<boolean>('busy', { required: true })
const errorMessage = defineModel<string>('error', { required: true })

const canSubmit = computed(() => code.value.trim().length === 6 && !busy.value)

function submit(): void {
  if (!canSubmit.value) return
  emit('joined')
}
</script>

<template>
  <AppCard as="section" class="shadow-sm">
    <h3 class="text-sm font-semibold text-on-surface">{{ t('student.join.title') }}</h3>
    <p class="mt-1 text-xs text-on-surface-variant">{{ t('student.join.hint') }}</p>

    <form class="mt-4 flex flex-col gap-2 sm:flex-row" @submit.prevent="submit">
      <JoinCodeInput v-model="code" :disabled="busy" />
      <AppButton variant="primary" class="shrink-0 rounded-xl" type="submit" :disabled="!canSubmit">
        <LogIn class="size-4" aria-hidden="true" />
        {{ busy ? t('common.loading') : t('student.join.action') }}
      </AppButton>
    </form>

    <p
      v-if="errorMessage"
      role="alert"
      class="mt-3 rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container"
    >
      {{ errorMessage }}
    </p>
  </AppCard>
</template>
