import { reactive } from 'vue'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'theme'

interface ThemeState {
  mode: ThemeMode
}

function storedMode(): ThemeMode | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

function preferredMode(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Light/dark theme state for the whole app. Two themes only: the choice is
 * persisted, defaults to the OS preference and mirrors onto <html class="dark">.
 */
const state = reactive<ThemeState>({ mode: storedMode() ?? preferredMode() })

export function getThemeState(): ThemeState {
  return state
}

export function applyTheme(): void {
  document.documentElement.classList.toggle('dark', state.mode === 'dark')
}

/**
 * The theme is applied by swapping a class on <html>.
 *
 * It used to go through the View Transition API, or a `.theme-switching` class
 * that muted transitions for a frame, so the page would cross-fade instead of
 * snapping. That went with the rest of the motion: a theme change now restyles
 * the page and does nothing else.
 */
export function setTheme(mode: ThemeMode): void {
  state.mode = mode
  localStorage.setItem(STORAGE_KEY, mode)
  applyTheme()
}

export function toggleTheme(): void {
  setTheme(state.mode === 'dark' ? 'light' : 'dark')
}
