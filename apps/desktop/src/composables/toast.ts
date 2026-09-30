import { reactive } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastState {
  items: ToastItem[]
}

const TOAST_DURATION_MS = 4000

/**
 * App-wide toast stack, rendered by the single <ToastHost/>. Actions report
 * outcomes here instead of painting one-off inline alerts all over the UI.
 */
const state = reactive<ToastState>({ items: [] })
let nextId = 1

export function getToastState(): ToastState {
  return state
}

export function dismissToast(id: number): void {
  state.items = state.items.filter((item) => item.id !== id)
}

export function useToast() {
  function push(kind: ToastKind, message: string): void {
    const id = nextId++
    state.items.push({ id, kind, message })
    window.setTimeout(() => dismissToast(id), TOAST_DURATION_MS)
  }

  return {
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
  }
}