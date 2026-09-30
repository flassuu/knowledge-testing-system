<script setup lang="ts">
import type { Component } from 'vue'
import { Plus } from '@lucide/vue'

withDefaults(
  defineProps<{
    icon: Component
    title: string
    description?: string
    actionLabel?: string
    actionIcon?: Component
  }>(),
  // Never default a component to a Lucide icon here: Vue treats a function
  // default as a factory and calls it, which breaks these functional components.
  // The `actionIcon ?? Plus` fallback in the template does the same job safely.
  { description: '', actionLabel: '' },
)

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container px-6 py-8 text-center"
  >
    <span
      class="flex size-11 items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant"
    >
      <component :is="icon" class="size-5" aria-hidden="true" />
    </span>
    <div class="space-y-1">
      <p class="text-sm font-semibold text-on-surface">{{ title }}</p>
      <p v-if="description" class="text-xs text-on-surface-variant">{{ description }}</p>
    </div>
    <button
      v-if="actionLabel"
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90"
      @click="emit('action')"
    >
      <component :is="actionIcon ?? Plus" class="size-3.5" aria-hidden="true" />
      {{ actionLabel }}
    </button>
  </div>
</template>