import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

/**
 * The behaviour every drop-down menu in the app has to get right.
 *
 * It was written out once inside LanguageSwitcher, and the second menu that
 * needed it would have been a second copy — a copy that quietly misses the
 * Escape handler, and then the menu people stop opening. Extracted before the
 * second user, not after.
 *
 * The items are found by attribute rather than collected into a ref array: an
 * index a template has to keep in step with `v-for` is an index that breaks the
 * moment someone adds a row.
 */
export interface MenuBehaviour {
  open: Ref<boolean>
  root: Ref<HTMLElement | null>
  /** Toggle, and put focus on the first item when it opens. */
  toggle: () => void
  close: () => void
  /** Bind to the menu element: roving focus and Tab-out. */
  onKeydown: (event: KeyboardEvent) => void
}

/** Marks a button as one of the menu's rows. `useMenu` finds these by name. */
export const MENU_ITEM_ATTR = 'data-menu-item'

export function menuItems(root: HTMLElement | null): HTMLButtonElement[] {
  if (!root) return []
  return [...root.querySelectorAll<HTMLButtonElement>(`[${MENU_ITEM_ATTR}]`)]
}

export function useMenu(): MenuBehaviour {
  const open = ref(false)
  const root = ref<HTMLElement | null>(null)

  function close(): void {
    open.value = false
  }

  function toggle(): void {
    open.value = !open.value
    if (!open.value) return
    void nextTick(() => menuItems(root.value)[0]?.focus())
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Tab') {
      close()
      return
    }
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const items = menuItems(root.value)
    const current = items.findIndex((item) => item === document.activeElement)
    const next = (current + step + items.length) % items.length
    items[next]?.focus()
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

  return { open, root, toggle, close, onKeydown }
}