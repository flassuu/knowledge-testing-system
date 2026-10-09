<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from '@lucide/vue'
import { supportedLocales, syncDocumentLocale, type Locale } from '../i18n'
import { MENU_ITEM_ATTR, useMenu } from '../composables/menu'
import FlagIcon from './common/FlagIcon.vue'

/**
 * Language choice as a menu, the way M3 does it: one fixed-size control in the
 * header, the list on demand. Two text buttons were fine until a locale change
 * made their widths disagree - the header is the last place that should move.
 *
 * It opens on click and stays open until it is dismissed, the way every menu
 * behaves. It used to open on hover as well, which meant two handlers fighting
 * over one gesture - the pointer arrived and opened it, the click closed it
 * again - and a menu that opens before anything has been clicked is a menu that
 * is in the way of the rest of the header.
 */
const { t, locale } = useI18n()
/** Bound with `ref="root"` on the wrapper, so click-outside has a boundary. */
/** The menu wrapper. A ref object, because that is what a template ref wants;
 *  `useMenu` reads its `.value` to decide what counts as "inside". */
const root = ref<HTMLElement | null>(null)
const menu = useMenu(root)

const names: Record<Locale, string> = {
  en: 'English',
  uk: 'Українська',
}

const currentName = computed(() => names[locale.value as Locale] ?? locale.value)

function setLocale(next: Locale): void {
  locale.value = next
  syncDocumentLocale(next)
  localStorage.setItem('locale', next)
  // Closed, not left open: the menu's own labels are now in the new language and
  // re-rendering them under the cursor reads as a glitch.
  menu.close()
}
</script>

<template>
  <div ref="root" class="relative" @keydown="menu.onKeydown">
    <button
      type="button"
      class="state-layer inline-flex h-[var(--control-md)] items-center gap-1.5 rounded-full border border-outline-variant px-2.5 text-xs font-medium text-on-surface focus:outline-none"
      :class="{ 'tip-off': menu.open.value }"
      :aria-label="t('common.language')"
      :aria-expanded="menu.open.value"
      aria-haspopup="menu"
      @click="menu.toggle"
    >
      <FlagIcon :code="locale as 'en' | 'uk'" class="h-3 w-4 shrink-0" />
      <!-- The name appears from `sm` up. On a phone the row of header controls is
           already full, and a flag with a name is what makes it scroll sideways:
           the language is still in the account menu, one tap away. -->
      <span class="hidden max-w-24 truncate sm:inline">{{ currentName }}</span>
    </button>

    <!--
      Always rendered. `v-if` plus a <Transition> mounted the panel on open and
      destroyed it on close, and a panel created under a stationary pointer was
      immediately reported as hovered again - so it opened, closed and reopened in
      a loop. Here the panel is in the document from the first render and only
      its opacity, transform and visibility change.
    -->
    <div
      role="menu"
      :aria-label="t('common.language')"
      class="menu-panel absolute right-0 z-40 mt-1 min-w-44 origin-top-right overflow-hidden rounded-[var(--radius-card)] border border-outline-variant bg-surface-container py-1 shadow-lg"
      :data-open="menu.open.value"
    >
      <button
        v-for="code in supportedLocales"
        :key="code"
        :data-menu-item="MENU_ITEM_ATTR"
        type="button"
        role="menuitemradio"
        :aria-checked="locale === code"
        class="state-layer flex w-full items-center gap-2 px-3 py-2 text-left text-sm focus:outline-none"
        :class="locale === code ? 'text-on-surface' : 'text-on-surface-variant'"
        @click="setLocale(code)"
      >
        <FlagIcon :code="code" class="h-3 w-4 shrink-0" />
        <span class="min-w-0 flex-1 truncate">{{ names[code] }}</span>
        <Check v-if="locale === code" class="size-4 shrink-0" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>