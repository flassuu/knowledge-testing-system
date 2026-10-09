<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronRight, Languages, LogOut } from '@lucide/vue'
import { useAuth } from '../stores/auth'
import { MENU_ITEM_ATTR, useMenu } from '../composables/menu'
import { supportedLocales, syncDocumentLocale, type Locale } from '../i18n'
import FlagIcon from './common/FlagIcon.vue'
import ThemeSwitch from './common/ThemeSwitch.vue'

/**
 * The account, and the settings that are not worth a row of buttons.
 *
 * The header used to hold the name, the theme, the language and sign-out side by
 * side. On a phone that is a second toolbar competing with the first one. The
 * account block is at the top and not behind another click because "who am I
 * signed in as" is the question that makes somebody open this at all.
 */

const { t, locale } = useI18n()
const { user, signOut } = useAuth()
const menu = useMenu()

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

function leave(): void {
  menu.close()
  // Signing out is the one moment where "keep me signed in" must stop applying.
  // The credential is kept so the next launch can sign in without typing, and
  // somebody who signs out to hand the device to the next person would otherwise
  // find the next person already inside.
  localStorage.removeItem('auth.remember')
  void signOut()
}
</script>

<template>
  <div ref="menu.root" class="relative" @keydown="menu.onKeydown">
    <button
      type="button"
      class="inline-flex size-[var(--control-md)] shrink-0 items-center justify-center rounded-full bg-secondary-container text-sm font-semibold text-on-secondary-container transition-[background-color,color] duration-[var(--motion-short)] ease-[var(--ease-standard)] hover:brightness-105"
      :aria-label="t('menu.account')"
      v-tip="user?.fullName ?? t('menu.account')"
      :aria-expanded="menu.open.value"
      aria-haspopup="menu"
      @click="menu.toggle"
    >
      <span aria-hidden="true">{{ initial }}</span>
    </button>

    <!--
      Always rendered, like the language control's panel. It used to be `v-if`
      inside a <Transition>, which mounted it on open: a panel created under a
      stationary pointer is reported as entered the moment it is in the document,
      so it opened, the next event closed it, and it opened again. Only opacity,
      transform and visibility change here.
    -->
      <div
        role="menu"
        :aria-label="t('menu.account')"
        class="menu-panel absolute right-0 z-40 mt-1 w-64 origin-top-right overflow-hidden rounded-[var(--radius-card)] border border-outline-variant bg-surface-container py-1 shadow-lg"
        :data-open="menu.open.value"
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
  </div>
</template>