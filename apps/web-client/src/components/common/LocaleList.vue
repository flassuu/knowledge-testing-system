<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Check } from '@lucide/vue'
import { supportedLocales, type Locale } from '../../i18n'
import { MENU_ITEM_ATTR } from '../../composables/menu'
import FlagIcon from './FlagIcon.vue'

/**
 * The rows of a locale list, shared by the two places a locale can be chosen.
 *
 * It was written out twice - once in the header control, once in the account
 * menu - and the two copies had already drifted in width and in which flag they
 * drew. A locale list is a thing with one answer to "what does a row look
 * like", so it is one component and the panels around it decide where to sit.
 */
const emit = defineEmits<{ pick: [next: Locale] }>()

const { locale } = useI18n()

const NAMES: Record<Locale, string> = {
  en: 'English',
  uk: 'Українська',
}
</script>

<template>
  <button
    v-for="code in supportedLocales"
    :key="code"
    :data-menu-item="MENU_ITEM_ATTR"
    type="button"
    role="menuitemradio"
    :aria-checked="locale === code"
    class="state-layer flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm focus:outline-none"
    :class="locale === code ? 'text-on-surface' : 'text-on-surface-variant'"
    @click="emit('pick', code)"
  >
    <FlagIcon :code="code" class="size-4 shrink-0" />
    <span class="min-w-0 flex-1 truncate">{{ NAMES[code] }}</span>
    <Check v-if="locale === code" class="size-4 shrink-0" aria-hidden="true" />
  </button>
</template>
