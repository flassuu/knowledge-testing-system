import type { Directive } from 'vue'

/**
 * Styled tooltips, replacing the `title` attribute.
 *
 * `title` draws a tooltip the browser owns: grey, square, its own font, its own
 * delay. Nineteen of them were scattered over the interface, and each one was a
 * place where the app stopped looking like itself.
 *
 * This builds the M3 plain tooltip out of the app's own tokens and then gets out
 * of the way completely: the panel is appended once, as a child of its trigger,
 * and everything after that is CSS - `:hover` and `:focus-within` in
 * theme.css. There is no timer, no open flag and no show/hide function.
 *
 * That is the whole design. The previous version listened for `mouseenter` and
 * `mouseleave` and opened the panel from JavaScript, which produced this:
 *
 *   0 -> 1 -> 0 -> 1 -> 0    while the pointer rested on the button
 *
 * A panel created *under a stationary pointer* is reported as newly entered the
 * moment it reaches the document, so the next event closed it again and the next
 * one opened it. It flickered at the rate the events arrived, on every animated
 * surface in the app, because they were all built that way. Nothing here can
 * fire twice: there is nothing to fire.
 *
 * The delay between arriving and appearing is a `transition-delay` in CSS for
 * the same reason. A `setTimeout` can be cancelled, restarted or land twice
 * under load; a transition delay is evaluated once per state change.
 */
export const vTip: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    const label = binding.value
    if (!label) return

    const panel = document.createElement('span')
    panel.className = [
      'pointer-events-none block w-max max-w-56 rounded-[var(--radius-control)]',
      'border border-outline-variant bg-surface-container-high px-2.5 py-1.5',
      'text-xs leading-snug text-on-surface shadow-lg',
    ].join(' ')
    panel.setAttribute('role', 'tooltip')
    panel.dataset.tipPanel = ''
    panel.textContent = label

    el.dataset.tipHost = ''
    el.appendChild(panel)
  },
  // The label is an i18n key, so switching the language changes it. The panel is
  // written once and lives in the trigger's DOM, so it is restated here.
  updated(el, binding) {
    const panel = el.querySelector<HTMLElement>('[data-tip-panel]')
    if (panel && typeof binding.value === 'string') panel.textContent = binding.value
  },
}