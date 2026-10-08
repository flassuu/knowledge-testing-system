<script setup lang="ts">
import { computed } from 'vue'
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
 * Opens on click *and* on hover: the header control is one of a row of controls,
 * so on a desktop pointer arriving at it should open it, the way every native menu
 * behaves. Hover is ignored on a touch device, where there is none.
 */
const { t, locale } = useI18n()
const menu = useMenu()

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
  <div
    class="relative"
    @keydown="menu.onKeydown"
    @mouseenter="menu.open.value = true"
    @mouseleave="menu.open.value = false"
  >
    <button
      type="button"
      class="inline-flex h-[var(--control-md)] items-center gap-1.5 rounded-full border border-outline-variant px-2.5 text-xs font-medium text-on-surface transition-colors duration-[var(--motion-short)] hover:bg-surface-container-high focus:outline-none"
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

    <Transition
      enter-active-class="transition-[opacity,transform] duration-[var(--motion-short)] ease-[var(--ease-decelerate)]"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      leave-active-class="transition-[opacity,transform] duration-[var(--motion-instant)] ease-[var(--ease-accelerate)]"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="menu.open.value"
        role="menu"
        :aria-label="t('common.language')"
        class="absolute right-0 z-40 mt-1 min-w-44 origin-top-right overflow-hidden rounded-[var(--radius-card)] border border-outline-variant bg-surface-container py-1 shadow-lg"
      >
        <button
          v-for="code in supportedLocales"
          :key="code"
          :data-menu-item="MENU_ITEM_ATTR"
          type="button"
          role="menuitemradio"
          :aria-checked="locale === code"
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-[var(--motion-instant)] hover:bg-surface-container-high focus:bg-surface-container-high focus:outline-none"
          :class="locale === code ? 'text-on-surface' : 'text-on-surface-variant'"
          @click="setLocale(code)"
        >
          <FlagIcon :code="code" class="h-3 w-4 shrink-0" />
          <span class="min-w-0 flex-1 truncate">{{ names[code] }}</span>
          <Check v-if="locale === code" class="size-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>