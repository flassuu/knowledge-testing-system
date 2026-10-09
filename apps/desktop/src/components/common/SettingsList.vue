<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PanelTop } from '@lucide/vue'
import { MENU_ITEM_ATTR } from '../../composables/menu'
import { readDecorations, setDecorations } from '../../composables/desktop'

/**
 * The rows of the settings list: preferences of the *window*, as opposed to the
 * account rows and the locale list around it.
 *
 * It exists only in the desktop app. A browser tab has no title bar of its own
 * to take away, and importing the Tauri API from the shared menu would drag it
 * into the web build - so the list is a component of this app alone, and the
 * menu renders it only where it can work.
 *
 * One row so far. It is written as a list for the same reason the locale list
 * is: the second setting must not have to invent what a row looks like.
 */
const { t } = useI18n()

const decorated = ref(readDecorations())

async function toggleTitleBar(): Promise<void> {
  // The switch flips first, the window follows: a control that waits for the
  // platform to answer reads as broken when the answer is slow.
  decorated.value = !decorated.value
  await setDecorations(decorated.value)
}
</script>

<template>
  <button
    :data-menu-item="MENU_ITEM_ATTR"
    type="button"
    role="switch"
    :aria-checked="decorated"
    class="state-layer flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-on-surface focus:outline-none"
    @click="toggleTitleBar"
  >
    <PanelTop class="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
    <span class="min-w-0 flex-1 truncate">{{ t('menu.titleBar') }}</span>

    <!-- The same track the theme switch uses: 40x24 with a 20px thumb. -->
    <span
      class="relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border-2"
      :class="decorated ? 'border-primary bg-primary' : 'border-outline bg-surface-container-highest'"
    >
      <span
        class="switch-thumb absolute left-[2px] size-4 rounded-full"
        :class="decorated ? 'translate-x-4 bg-on-primary' : 'translate-x-0 bg-outline'"
      />
    </span>
  </button>
</template>
