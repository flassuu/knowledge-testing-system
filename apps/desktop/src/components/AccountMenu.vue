<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronRight, Info, Languages, LogOut, Server } from '@lucide/vue'
import { useAuth } from '../stores/auth'
import { MENU_ITEM_ATTR, useMenu } from '../composables/menu'
import { supportedLocales, syncDocumentLocale, type Locale } from '../i18n'
import FlagIcon from './common/FlagIcon.vue'
import ThemeSwitch from './common/ThemeSwitch.vue'
import AboutDialog from './common/AboutDialog.vue'

/**
 * The account, and the settings that are not worth a row of buttons.
 *
 * The header used to hold nine controls side by side: status, name, theme,
 * language, server, about, sign out. At the 800px minimum window width that is
 * already wrapping, and it was still growing. Everything except the status
 * belongs on demand instead — the header then keeps one fixed box whatever the
 * locale or the theme, which is the only reason it can be this simple.
 *
 * The account block is at the top and not behind another click because "who am I
 * signed in as" is the question that makes somebody open this at all.
 */
const props = defineProps<{ /** Desktop only: the app hosts the server. */ hosted?: boolean }>()
const emit = defineEmits<{ server: [] }>()

const { t, locale } = useI18n()
const { user, signOut } = useAuth()
const menu = useMenu()

const aboutOpen = ref(false)
/** The language sub-panel: opened by its row, not a second menu. */
const languageOpen = ref(false)

const roleLabel = computed(() => t(`role.${user.value?.role ?? 'student'}`))

/** The first letter of the name, or of the username — never empty. */
const initial = computed(() => {
  const source = user.value?.fullName?.trim() || user.value?.username || '?'
  return [...source][0]?.toUpperCase() ?? '?'
})

const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  uk: 'Українська',
}

function setLocale(next: Locale): void {
  locale.value = next
  syncDocumentLocale(next)
  localStorage.setItem('locale', next)
  languageOpen.value = false
  menu.close()
}

function goToServer(): void {
  menu.close()
  emit('server')
}

function openAbout(): void {
  menu.close()
  aboutOpen.value = true
}

function leave(): void {
  menu.close()
  void signOut()
}
</script>

<template>
  <div ref="menu.root" class="relative" @keydown="menu.onKeydown">
    <button
      type="button"
      class="inline-flex size-[var(--control-md)] shrink-0 items-center justify-center rounded-full bg-secondary-container text-sm font-semibold text-on-secondary-container transition-transform duration-[var(--motion-short)] ease-[var(--ease-standard)] hover:brightness-105 active:scale-95 motion-reduce:active:scale-100"
      :aria-label="t('menu.account')"
      :title="user?.fullName ?? t('menu.account')"
      :aria-expanded="menu.open.value"
      aria-haspopup="menu"
      @click="menu.toggle"
    >
      <span aria-hidden="true">{{ initial }}</span>
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
        :aria-label="t('menu.account')"
        class="absolute right-0 z-40 mt-1 w-64 origin-top-right overflow-hidden rounded-[var(--radius-card)] border border-outline-variant bg-surface-container py-1 shadow-lg"
      >
        <!-- Who you are: the reason this menu was opened. -->
        <div class="flex items-center gap-3 px-3 pb-2 pt-2">
          <span
            aria-hidden="true"
            class="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-sm font-semibold text-on-secondary-container"
          >
            {{ initial }}
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-on-surface">
              {{ user?.fullName }}
            </p>
            <p class="truncate text-xs text-on-surface-variant">
              {{ user?.username }} · {{ roleLabel }}
            </p>
          </div>
        </div>
        <div class="my-1 h-px bg-outline-variant" role="separator" />

        <div :data-menu-item="MENU_ITEM_ATTR" role="none">
          <ThemeSwitch />
        </div>

        <!-- Language is a row that opens its own list, the way a nested menu
             does everywhere else: a locale needs a name in its own script, so
             there is always more to it than a switch position. -->
        <button
          :data-menu-item="MENU_ITEM_ATTR"
          type="button"
          role="menuitem"
          :aria-expanded="languageOpen"
          class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-on-surface transition-colors duration-[var(--motion-instant)] hover:bg-surface-container-high focus:bg-surface-container-high focus:outline-none"
          @click="languageOpen = !languageOpen"
          @mouseenter="languageOpen = true"
        >
          <Languages class="size-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ t('common.language') }}</span>
          <span class="flex shrink-0 items-center gap-1.5 text-xs text-on-surface-variant">
            <FlagIcon :code="locale as 'en' | 'uk'" class="h-3 w-4" />
            <ChevronRight
              class="size-3.5 transition-transform duration-[var(--motion-short)]"
              :class="languageOpen ? 'rotate-90' : ''"
              aria-hidden="true"
            />
          </span>
        </button>
        <div
          v-if="languageOpen"
          class="bg-surface-container-high/60 py-1"
          role="group"
          :aria-label="t('common.language')"
        >
          <button
            v-for="code in supportedLocales"
            :key="code"
            :data-menu-item="MENU_ITEM_ATTR"
            type="button"
            role="menuitemradio"
            :aria-checked="locale === code"
            class="flex w-full items-center gap-3 py-2 pl-8 pr-3 text-left text-sm transition-colors duration-[var(--motion-instant)] hover:bg-surface-container-highest focus:bg-surface-container-highest focus:outline-none"
            :class="locale === code ? 'text-on-surface' : 'text-on-surface-variant'"
            @click="setLocale(code)"
          >
            <FlagIcon :code="code" class="h-3 w-4 shrink-0" />
            <span class="min-w-0 flex-1 truncate">{{ LOCALE_NAMES[code] }}</span>
            <Check v-if="locale === code" class="size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>

        <template v-if="props.hosted">
          <div class="my-1 h-px bg-outline-variant" role="separator" />
          <button
            :data-menu-item="MENU_ITEM_ATTR"
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-on-surface transition-colors duration-[var(--motion-instant)] hover:bg-surface-container-high focus:bg-surface-container-high focus:outline-none"
            @click="goToServer"
          >
            <Server class="size-4 shrink-0" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate">{{ t('desktop.server.title') }}</span>
          </button>
        </template>

        <div class="my-1 h-px bg-outline-variant" role="separator" />

        <button
          :data-menu-item="MENU_ITEM_ATTR"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-on-surface transition-colors duration-[var(--motion-instant)] hover:bg-surface-container-high focus:bg-surface-container-high focus:outline-none"
          @click="openAbout"
        >
          <Info class="size-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ t('common.about.title') }}</span>
        </button>

        <div class="my-1 h-px bg-outline-variant" role="separator" />

        <button
          :data-menu-item="MENU_ITEM_ATTR"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-on-surface transition-colors duration-[var(--motion-instant)] hover:bg-error-container focus:bg-error-container focus:outline-none"
          @click="leave"
        >
          <LogOut class="size-4 shrink-0 text-error" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ t('auth.signOut') }}</span>
        </button>
      </div>
    </Transition>
  </div>

  <AboutDialog v-if="props.hosted" :open="aboutOpen" @close="aboutOpen = false" />
</template>