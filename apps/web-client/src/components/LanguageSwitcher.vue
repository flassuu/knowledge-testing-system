<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from '@lucide/vue'
import { supportedLocales, syncDocumentLocale, type Locale } from '../i18n'
import AppButton from './common/AppButton.vue'
import FlagIcon from './common/FlagIcon.vue'

/**
 * Language choice as a menu, the way M3 does it: one fixed-size control in the
 * header, the list on demand. Two text buttons were fine until a locale change
 * made their widths disagree - the header is the last place that should move.
 */
const { t, locale } = useI18n()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const items = ref<HTMLButtonElement[]>([])

const names: Record<Locale, string> = {
  en: 'English',
  uk: 'Українська',
}

const currentName = computed(() => names[locale.value as Locale] ?? locale.value)

function setLocale(next: Locale): void {
  locale.value = next
  syncDocumentLocale(next)
  localStorage.setItem('locale', next)
  close()
}

function openMenu(): void {
  open.value = !open.value
  if (!open.value) return
  void nextTick(() => {
    const index = supportedLocales.indexOf(locale.value as Locale)
    items.value[index >= 0 ? index : 0]?.focus()
  })
}

function close(): void {
  open.value = false
}

/** Roving focus, Escape and Tab-out: the three things a menu has to get right. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close()
    return
  }
  if (event.key === 'Tab') {
    close()
    return
  }
  const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  event.preventDefault()
  const current = items.value.findIndex((item) => item === document.activeElement)
  const next = (current + step + items.value.length) % items.value.length
  items.value[next]?.focus()
}

function onPointerDown(event: PointerEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) close()
}

// Escape is caught on the window, not on the menu: focus can end up anywhere,
// and a menu you cannot leave with Escape is a menu people stop opening.
function onWindowKeydown(event: KeyboardEvent): void {
  if (open.value && event.key === 'Escape') close()
}

document.addEventListener('pointerdown', onPointerDown)
window.addEventListener('keydown', onWindowKeydown)
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <div ref="root" class="relative" @keydown="onKeydown">
    <AppButton
      variant="ghost"
      :icon="true"
      size="md"
      :aria-label="t('common.language')"
      :title="currentName"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="openMenu"
    >
      <FlagIcon :code="locale as 'en' | 'uk'" class="h-3.5 w-[1.375rem]" />
    </AppButton>

    <Transition
      enter-active-class="transition-[opacity,transform] duration-[var(--motion-short)] ease-[var(--ease-decelerate)]"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      leave-active-class="transition-[opacity,transform] duration-[var(--motion-instant)] ease-[var(--ease-accelerate)]"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        role="menu"
        :aria-label="t('common.language')"
        class="absolute right-0 z-40 mt-1 min-w-44 origin-top-right overflow-hidden rounded-[var(--radius-card)] border border-outline-variant bg-surface-container py-1 shadow-lg"
      >
        <button
          v-for="code in supportedLocales"
          :key="code"
          ref="items"
          type="button"
          role="menuitemradio"
          :aria-checked="code === locale"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors duration-[var(--motion-instant)] hover:bg-surface-container-high"
          :class="code === locale ? 'font-semibold text-on-surface' : 'text-on-surface-variant'"
          @click="setLocale(code as Locale)"
        >
          <FlagIcon :code="code" />
          <span class="flex-1">{{ names[code] }}</span>
          <Check v-if="code === locale" class="size-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>