<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, Info, Languages, LogOut, User } from '@lucide/vue'
import { useAuth } from '../stores/auth'
import { MENU_ITEM_ATTR, useMenu } from '../composables/menu'
import { syncDocumentLocale, type Locale } from '../i18n'
import AppButton from './common/AppButton.vue'
import FlagIcon from './common/FlagIcon.vue'
import LocaleList from './common/LocaleList.vue'
import ThemeSwitch from './common/ThemeSwitch.vue'
import AboutDialog from './common/AboutDialog.vue'

/**
 * One menu for everything that is not a status: the server, the language, the
 * theme, About, and the account itself.
 *
 * There were two. The account menu, opened by the avatar, held the theme, the
 * language, the server and signing out - and the sign-in screen had no account to
 * open it with, so a second menu was written for exactly the settings rows, and
 * the header grew a third control to reach them. Two menus over one list is one
 * list to forget: the settings copy did not have signing out, and the account
 * copy did not have the server until this commit.
 *
 * The difference between signed in and signed out is one block - the name - and
 * that is the only difference. The avatar is there either way, because it is the
 * button that opens the menu, and a menu with no button is a menu nobody finds.
 *
 * The locale list opens to the *left* as a panel of its own, the way a nested
 * menu opens beside its parent. It used to open in place, pushing the rows under
 * it down the panel - a list that moves the thing it belongs to is harder to read
 * than one that floats beside it.
 */
const { t, locale } = useI18n()
const { user, signOut } = useAuth()

/** The menu wrapper, bound with `ref="root"`: click-outside needs a boundary. */
const root = ref<HTMLElement | null>(null)
const menu = useMenu(root)

const aboutOpen = ref(false)
/** The locale panel: opened by its row, not a second menu. */
const languageOpen = ref(false)

const roleLabel = computed(() => t(`role.${user.value?.role ?? 'student'}`))

/** The first letter of the name, or of the username - never empty. */
const initial = computed(() => {
  const source = user.value?.fullName?.trim() || user.value?.username || '?'
  return [...source][0]?.toUpperCase() ?? '?'
})

/** A locale list left open behind a closed menu is a list nobody can dismiss. */
watch(menu.open, (open) => {
  if (!open) languageOpen.value = false
})

function setLocale(next: Locale): void {
  locale.value = next
  syncDocumentLocale(next)
  localStorage.setItem('locale', next)
  languageOpen.value = false
  menu.close()
}

function openAbout(): void {
  menu.close()
  aboutOpen.value = true
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
  <!--
    Deliberately not `relative`: the panel below anchors to the header - the
    nearest positioned ancestor, the sticky bar - not to this button. The menu
    is a card floating at the screen corner with equal insets from the top bar
    and from the screen edge, and it is the header block's 12px margin
    (AppHeader) that puts the avatar over the sign-out button; a `relative`
    here would glue the panel back to the button and undo both.
  -->
  <div ref="root" @keydown="menu.onKeydown">
    <button
      type="button"
      class="state-layer inline-flex size-[var(--control-md)] shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container"
      :class="{ 'tip-end': true, 'tip-off': menu.open.value }"
      :aria-label="user ? t('menu.account') : t('menu.settings')"
      v-tip="user ? `${user.fullName} · ${user.username}` : t('menu.settings')"
      :aria-expanded="menu.open.value"
      aria-haspopup="menu"
      @click="menu.toggle"
    >
      <!-- Signed out there is no name to take a letter from, so it is the
           standard silhouette rather than a question mark. -->
      <span v-if="user" class="text-sm font-semibold" aria-hidden="true">{{ initial }}</span>
      <User v-else class="size-4" aria-hidden="true" />
    </button>

    <!--
      Always rendered: a menu created on open is a menu the pointer can re-enter
      by arriving on the node that just appeared. Only opacity and visibility
      change here.

      Anchored to the header, not to the button (the root above carries no
      `relative`): the insets repeat the header's own `px-3 sm:px-4`, so the
      card recedes from the screen edge by as much as it hangs below the bar -
      12px on a phone-narrow screen, 16px from `sm` up. `top` counts from the
      header's top edge: the 56px bar plus the same inset.
    -->
    <div
      role="menu"
      :aria-label="user ? t('menu.account') : t('menu.settings')"
      class="menu-panel absolute right-3 top-[68px] z-40 w-64 origin-top-right rounded-[var(--radius-card)] border border-outline-variant bg-surface-container py-1 shadow-lg sm:right-4 sm:top-[72px]"
      :data-open="menu.open.value"
    >
      <!-- Who you are: the reason an account menu is opened, and where signing
           out lives. Past the language list and the server entry was a row about
           leaving, several steps from the account it acts on. -->
      <div v-if="user" class="flex items-center gap-3 px-3 pb-2 pt-2">
        <span
          aria-hidden="true"
          class="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-sm font-semibold text-on-secondary-container"
        >
          {{ initial }}
        </span>
        <div class="min-w-0 flex-1">
          <!--
            `onlyIfTruncated`: the column is one line wide and the name is not.
            On a wide window it fits, and a tooltip repeating text that is already
            whole is noise - so this one measures and stays quiet unless it has
            something the column could not show.
          -->
          <p
            class="truncate text-sm font-medium text-on-surface"
            v-tip="{ label: `${user.fullName} · ${user.username}`, onlyIfTruncated: true }"
          >
            {{ user.fullName }}
          </p>
          <p class="truncate text-xs text-on-surface-variant">
            {{ user.username }} · {{ roleLabel }}
          </p>
        </div>
        <!--
          `data-menu-item-skip`: the arrow keys reach this row, but it is not
          where the menu puts the keyboard when it opens. A menu that focuses its
          first row would put Enter one keystroke from signing out.
        -->
        <AppButton
          :data-menu-item="MENU_ITEM_ATTR"
          data-menu-item-skip
          variant="dangerTonal"
          icon
          :aria-label="t('auth.signOut')"
          v-tip="t('auth.signOut')"
          @click="leave"
        >
          <LogOut class="size-4" aria-hidden="true" />
        </AppButton>
      </div>

      <div v-if="user" class="my-1 h-px bg-outline-variant" role="separator" />

      <div :data-menu-item="MENU_ITEM_ATTR" role="none">
        <ThemeSwitch />
      </div>

      <!--
        `min-h-10`: a row whose tallest child is a 24px switch is 40px and a row
        of icon + text is 36px - four pixels the eye reads as a row out of line.
        The height is stated rather than left to whatever the row happens to
        contain, so a row added later does not silently pick its own.
      -->
      <!--
        The locale list hangs off *this row*, not off the panel: positioned against
        the panel it opened level with the account block, which is two rows above
        the control that opened it. Against the row it opens level with the row.
      -->
      <div class="menu-anchor">
        <button
          :data-menu-item="MENU_ITEM_ATTR"
          type="button"
          role="menuitem"
          :aria-expanded="languageOpen"
          class="state-layer flex w-full min-h-10 items-center gap-3 px-3 py-2 text-left text-sm text-on-surface focus:outline-none"
          @click="languageOpen = !languageOpen"
        >
          <!--
            The row's icon becomes the arrow while its list is open, in the slot
            the icon was in: the list goes that way, so the control says so where
            the eye already is. A second chevron on the far right gave a row about
            the language two directions on it.
          -->
          <ChevronLeft v-if="languageOpen" class="size-4 shrink-0" aria-hidden="true" />
          <Languages v-else class="size-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ t('common.language') }}</span>
          <FlagIcon :code="locale as 'en' | 'uk'" class="size-4 shrink-0" />
        </button>
        <!--
          Always in the document, like the panel above: under a `<Transition>`
          a list closed while it was still opening kept both sets of classes at
          once and was never removed, leaving a panel that stayed open over the
          page and swallowed the next click anywhere. `data-open` is the state,
          the same state the rest of the menu reads.
        -->
        <div
          role="menu"
          :aria-label="t('common.language')"
          class="menu-panel menu-nested absolute z-40 w-52 origin-top-right overflow-hidden rounded-[var(--radius-card)] border border-outline-variant bg-surface-container py-1 shadow-lg"
          :data-open="languageOpen"
        >
          <LocaleList @pick="setLocale" />
        </div>
      </div>


      <!--
        Not gated on hosting: what this app is and which version it is does not
        depend on whether the machine happens to be running the server. It was
        `hosted`-only, which is why it was missing from the sign-in screen on the
        phone client and from anywhere the teacher had not signed in yet.
      -->

      <div class="my-1 h-px bg-outline-variant" role="separator" />

      <div class="my-1 h-px bg-outline-variant" role="separator" />

      <button
        :data-menu-item="MENU_ITEM_ATTR"
        type="button"
        role="menuitem"
        class="state-layer flex w-full min-h-10 items-center gap-3 px-3 py-2 text-left text-sm text-on-surface focus:outline-none"
        @click="openAbout"
      >
        <Info class="size-4 shrink-0" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate">{{ t('common.about.title') }}</span>
      </button>

    </div>
  </div>

  <AboutDialog :open="aboutOpen" @close="aboutOpen = false" />
</template>
