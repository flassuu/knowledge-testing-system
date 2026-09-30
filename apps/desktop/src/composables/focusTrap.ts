import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog keyboard behaviour: Escape closes, Tab cycles inside the panel and
 * focus returns to the element that opened the dialog.
 */
export function useDialogFocus(
  open: () => boolean,
  close: () => void,
  panel: Ref<HTMLElement | null>,
  initialFocus?: Ref<HTMLElement | null>,
): void {
  let opener: HTMLElement | null = null

  function onKeydown(event: KeyboardEvent) {
    if (!open()) return
    if (event.key === 'Escape') {
      close()
      return
    }
    if (event.key !== 'Tab') return

    const root = panel.value
    if (!root) return
    const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) {
      event.preventDefault()
      return
    }

    const active = document.activeElement
    const outside = !active || !root.contains(active)
    if (event.shiftKey && (active === first || outside)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || outside)) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(
    open,
    async (isOpen) => {
      if (isOpen) {
        opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
        await nextTick()
        const target = initialFocus?.value ?? panel.value?.querySelector<HTMLElement>(FOCUSABLE)
        target?.focus()
        return
      }
      opener?.focus()
      opener = null
    },
    { immediate: true },
  )

  window.addEventListener('keydown', onKeydown)
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
