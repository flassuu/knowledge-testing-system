<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Moon, Sun } from '@lucide/vue'
import { getThemeState, setTheme } from '../../composables/theme'

/**
 * The theme as a switch, not a button that swaps two icons.
 *
 * A button showing "the other mode" makes the teacher work out what they are
 * looking at now. A switch states it: the label reads Dark, the track is in the
 * on position, and the sun on the thumb is the mode a tap goes back to. That
 * inversion is the M3 pattern - the thumb carries the icon of the *other* state,
 * so the switch itself carries the current one.
 */
const { t } = useI18n()
const theme = getThemeState()

const dark = computed(() => theme.mode === 'dark')
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="dark"
    :aria-label="t('theme.darkMode')"
    :title="dark ? t('theme.switchToLight') : t('theme.switchToDark')"
    class="inline-flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left transition-colors duration-[var(--motion-instant)] hover:bg-surface-container-high focus:bg-surface-container-high focus:outline-none"
    @click="setTheme(dark ? 'light' : 'dark')"
  >
    <span class="min-w-0 flex-1 text-sm text-on-surface">{{ t('theme.darkMode') }}</span>

    <!-- The track: 40x24 per M3, with a 20px thumb on a 2px inset. -->
    <span
      class="relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border-2 transition-colors duration-[var(--motion-medium)] ease-[var(--ease-standard)]"
      :class="dark ? 'border-primary bg-primary' : 'border-outline bg-surface-container-highest'"
    >
      <span
        class="absolute flex size-4 items-center justify-center rounded-full transition-all duration-[var(--motion-medium)] ease-[var(--ease-emphasized)]"
        :class="dark ? 'left-[18px] text-on-primary' : 'left-[2px] text-on-surface-variant'"
      >
        <!-- The thumb carries the mode a tap goes to, not the current one. -->
        <Moon v-if="dark" class="size-3" aria-hidden="true" />
        <Sun v-else class="size-3" aria-hidden="true" />
      </span>
    </span>
  </button>
</template>