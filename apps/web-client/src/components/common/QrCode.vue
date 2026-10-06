<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { qrSvg } from '../../utils/qr'

const props = defineProps<{
  /** The encoded payload - a join link, a session URL. */
  text: string
  /** Visible caption under the code. */
  caption?: string
}>()

const { t } = useI18n()

const svg = computed(() => qrSvg(props.text))
</script>

<template>
  <figure
    v-if="svg"
    class="flex w-fit flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-lg"
  >
    <div
      class="size-40 [&>svg]:size-full sm:size-48"
      role="img"
      :aria-label="t('common.qr.for', { target: caption ?? text })"
      v-html="svg"
    />
    <figcaption
      v-if="caption"
      class="max-w-40 text-center text-[11px] font-semibold text-neutral-800"
    >
      {{ caption }}
    </figcaption>
  </figure>
</template>
