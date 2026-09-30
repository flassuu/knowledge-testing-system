<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  File as FileIcon,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Music,
  Presentation,
} from '@lucide/vue'
import { fileKind, type FileKind } from '../../utils/fileType'

const props = defineProps<{
  title: string
  mimeType: string
}>()

const { t } = useI18n()

const KIND_ICONS: Record<FileKind, typeof FileIcon> = {
  pdf: FileText,
  document: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  image: ImageIcon,
  archive: FileArchive,
  video: FileIcon,
  audio: Music,
  text: FileText,
  file: FileIcon,
}

const KIND_CLASS: Record<FileKind, string> = {
  pdf: 'bg-error-container text-on-error-container',
  document: 'bg-primary-container text-on-primary-container',
  sheet: 'bg-success-container text-on-success-container',
  slides: 'bg-warning-container text-on-warning-container',
  image: 'bg-secondary-container text-on-secondary-container',
  archive: 'bg-surface-container-highest text-on-surface-variant',
  video: 'bg-secondary-container text-on-secondary-container',
  audio: 'bg-secondary-container text-on-secondary-container',
  text: 'bg-surface-container-highest text-on-surface-variant',
  file: 'bg-surface-container-highest text-on-surface-variant',
}

const kind = computed(() => fileKind(props.title, props.mimeType))
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
    :class="KIND_CLASS[kind]"
  >
    <component :is="KIND_ICONS[kind]" class="size-3" aria-hidden="true" />
    {{ t(`common.fileType.${kind}`) }}
  </span>
</template>