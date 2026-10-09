import type { Directive } from 'vue'

/**
 * Styled tooltips, replacing the `title` attribute.
 *
 * `title` draws a tooltip the browser owns: grey, square, its own font, its own
 * delay, and on Linux over WebKit a box that looks like nothing else in the app.
 * Nineteen of them were scattered over the interface, and each one is a place
 * where the app stops looking like itself.
 *
 * `v-tip` builds the tooltip out of the app's own tokens: the M3 plain tooltip,
 * which is the inverse surface precisely because it has to sit on top of
 * anything. It appears after a delay rather than the instant the pointer lands,
 * disappears at once, and shows on keyboard focus as well as on hover - a tooltip
 * only a mouse can reach is not an accessible one.
 *
 * Position is fixed rather than absolute so a tooltip inside a scrolling panel
 * or a sticky header is not clipped by it, and it flips above the trigger when
 * there is no room below.
 */
const SHOW_AFTER = 600
const LEAVE_GRACE = 150
const EDGE_GAP = 8

interface TipState {
  node: HTMLElement | null
  timer: number | null
  hideTimer: number | null
}

const states = new WeakMap<HTMLElement, TipState>()

function tipFor(el: HTMLElement): TipState {
  let tip = states.get(el)
  if (!tip) {
    tip = { node: null, timer: null, hideTimer: null }
    states.set(el, tip)
  }
  return tip
}

function clearTimers(tip: TipState): void {
  if (tip.timer !== null) window.clearTimeout(tip.timer)
  if (tip.hideTimer !== null) window.clearTimeout(tip.hideTimer)
  tip.timer = null
  tip.hideTimer = null
}

/** Places the node under the trigger, or above it when the screen ends first. */
function place(el: HTMLElement, node: HTMLElement): void {
  const anchor = el.getBoundingClientRect()
  const box = node.getBoundingClientRect()

  // Clamped rather than centred blind: a tooltip near the right edge would hang
  // off the screen otherwise, which is the one thing a tooltip must not do.
  const left = Math.min(
    Math.max(EDGE_GAP, anchor.left + anchor.width / 2 - box.width / 2),
    Math.max(EDGE_GAP, window.innerWidth - box.width - EDGE_GAP),
  )
  const below = anchor.bottom + 6
  const above = anchor.top - box.height - 6
  const fitsBelow = below + box.height + EDGE_GAP <= window.innerHeight
  const top = fitsBelow || above < EDGE_GAP ? below : above

  node.style.left = `${Math.round(left)}px`
  node.style.top = `${Math.round(top)}px`
}

function show(el: HTMLElement, text: string): void {
  const tip = tipFor(el)
  const node = tip.node ?? document.createElement('div')
  // The same box the rest of the app draws: a surface fill, an outline border
  // and the on-surface text, at the control radius. The M3 plain tooltip is the
  // inverse surface, which on a dark theme is a near-white box - and a light box
  // in a dark window reads as a hole in the interface, not as a hint.
  node.className = [
    'pointer-events-none fixed z-[70] max-w-xs rounded-[var(--radius-control)]',
    'border border-outline-variant bg-surface-container-high px-2.5 py-1.5',
    'text-xs leading-snug text-on-surface shadow-lg',
    'opacity-0 transition-opacity duration-[var(--motion-instant)]',
  ].join(' ')
  node.setAttribute('role', 'tooltip')
  node.textContent = text
  if (!node.isConnected) document.body.appendChild(node)
  tip.node = node

  // Measured after it is in the DOM and before it fades in: opacity is the only
  // thing animated, so the box has to have a real size before that starts.
  place(el, node)
  requestAnimationFrame(() => node.classList.remove('opacity-0'))
}

function hide(el: HTMLElement): void {
  const tip = tipFor(el)
  clearTimers(tip)
  const node = tip.node
  if (!node) return
  tip.node = null
  node.classList.add('opacity-0')
  window.setTimeout(() => node.remove(), 200)
}

export const vTip: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    if (!binding.value) return
    el.dataset.tip = binding.value

    const open = () => {
      const tip = tipFor(el)
      clearTimers(tip)
      tip.timer = window.setTimeout(() => show(el, el.dataset.tip ?? ''), SHOW_AFTER)
    }

    const schedule = () => {
      const tip = tipFor(el)
      if (tip.hideTimer !== null) window.clearTimeout(tip.hideTimer)
      // A short grace period, because the pointer crossing the gap between the
      // trigger and the box should not make it blink. The box is
      // pointer-events-none, so without this it flickers on any small drift.
      tip.hideTimer = window.setTimeout(() => hide(el), LEAVE_GRACE)
    }

    el.addEventListener('mouseenter', open)
    el.addEventListener('mouseleave', schedule)
    el.addEventListener('focus', open)
    el.addEventListener('blur', schedule)
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hide(el)
    })
    // A scroll moves the trigger out from under a fixed box, so the box goes too.
    el.addEventListener('pointerdown', () => hide(el))
  },
  // The label is an i18n key, so switching the language changes it. The tooltip
  // is built on hover out of the stored text, so it has to be restated.
  updated(el, binding) {
    if (typeof binding.value === 'string') el.dataset.tip = binding.value
  },
  unmounted(el) {
    hide(el)
  },
}