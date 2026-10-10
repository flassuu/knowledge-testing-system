import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

/**
 * The behaviour every drop-down menu in the app has to get right.
 *
 * It was written out once inside a single menu component, and the second menu
 * that needed it would have been a second copy — a copy that quietly misses the
 * Escape handler, and then the menu people stop opening. Extracted before the
 * second user, not after.
 *
 * The items are found by attribute rather than collected into a ref array: an
 * index a template has to keep in step with `v-for` is an index that breaks the
 * moment someone adds a row.
 */
export interface MenuBehaviour {
  open: Ref<boolean>
  /** Toggle, and put focus on the first item when it opens. */
  toggle: () => void
  close: () => void
  /** Bind to the menu element: roving focus and Tab-out. */
  onKeydown: (event: KeyboardEvent) => void
}

/** Marks a button as one of the menu's rows. `useMenu` finds these by name. */
export const MENU_ITEM_ATTR = 'data-menu-item'

/**
 * The rows a menu can move focus to: the ones that are actually on screen.
 *
 * A nested list is in the document even when it is closed - it is hidden with
 * `opacity` and `visibility`, not unmounted, for the same reason the panel is -
 * so its rows are in the query too. Focus cannot go to a `visibility: hidden`
 * element, and arrow keys that try land nowhere, which reads as the keyboard
 * having stopped a row before the visible end. Closed panels are filtered out
 * here, once, for every menu in the app.
 */
export function menuItems(root: HTMLElement | null): HTMLButtonElement[] {
  if (!root) return []
  return [...root.querySelectorAll<HTMLButtonElement>(`[${MENU_ITEM_ATTR}]`)].filter(
    (item) => !item.closest('[role=menu][data-open="false"]'),
  )
}

/**
 * `root` is the element the menu lives in, and it is passed in rather than
 * returned for binding.
 *
 * The first version returned its own ref and the templates bound it as
 * `ref="menu.root"`. That does not work: a dotted template ref is resolved
 * against the setup bindings, and this one never bound, so `root` stayed null and
 * the click-outside handler returned early every time. A menu that ignores clicks
 * anywhere else on the page is not something anyone reports - they just stop
 * opening it - so it survived a while. Handing the ref over makes it impossible
 * to forget.
 */
export function useMenu(root: Ref<HTMLElement | null>): MenuBehaviour {
  const open = ref(false)

  function close(): void {
    open.value = false
  }

  function toggle(): void {
    open.value = !open.value
    if (!open.value) return
    void nextTick(() => initialItem()?.focus())
  }

  /**
   * Where the arrow keys and an opening menu put focus: the first row, unless it
   * opts out with `data-menu-item-skip`.
   *
   * The account row's sign-out button is such a row. It is first in the document
   * - it sits in the account block, beside the name - and a menu that focuses its
   * first row put the keyboard straight on "Sign out", where Enter leaves. It is
   * still a row: the arrow keys reach it, and Tab closes the menu as before.
   */
  function initialItem(): HTMLButtonElement | undefined {
    const items = menuItems(root.value)
    return items.find((item) => item.dataset.menuItemSkip !== 'true') ?? items[0]
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
    if (!open.value || !root.value) return
    if (!root.value.contains(event.target as Node)) close()
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

  return { open, toggle, close, onKeydown }
}