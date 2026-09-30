import { reactive } from 'vue'

export interface ConfirmRequest {
  message: string
  /** Overrides the default "Confirm" button label, e.g. "Delete". */
  confirmLabel?: string
}

interface ConfirmState {
  open: boolean
  message: string
  confirmLabel: string
  resolve: ((ok: boolean) => void) | null
}

const state = reactive<ConfirmState>({
  open: false,
  message: '',
  confirmLabel: '',
  resolve: null,
})

/**
 * Module-level confirm dialog, driven by the single <ConfirmDialog/> host.
 * Resolves with the user's choice; the dialog auto-closes either way.
 */
export function useConfirm() {
  return function confirm(request: ConfirmRequest): Promise<boolean> {
    state.message = request.message
    state.confirmLabel = request.confirmLabel ?? ''
    state.open = true
    return new Promise((resolve) => {
      state.resolve = resolve
    })
  }
}

/** Shared state for <ConfirmDialog/> to render. */
export function getConfirmState(): ConfirmState {
  return state
}

export function settleConfirm(ok: boolean): void {
  state.open = false
  const resolve = state.resolve
  state.resolve = null
  resolve?.(ok)
}