import { getVersion } from '@tauri-apps/api/app'
import { getCurrentWindow, LogicalSize, PhysicalPosition } from '@tauri-apps/api/window'

const STATE_KEY = 'desktop.window'
const SAVE_DELAY_MS = 400

interface WindowState {
  width: number
  height: number
  x: number
  y: number
}

/** True inside the Tauri webview; false when the same code runs in a browser. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** The version comes from tauri.conf.json, which is what the bundles are built from. */
export async function appVersion(): Promise<string | null> {
  if (!isDesktop()) return null
  try {
    return await getVersion()
  } catch {
    return null
  }
}

/**
 * Reopens the window where the teacher left it. Tauri only remembers geometry
 * if the config asks it to, and that would also pin the size across displays
 * with different scaling, so the state is ours: applied once at startup, then
 * written back (debounced) whenever the window is moved or resized.
 */
export async function restoreWindowState(): Promise<void> {
  if (!isDesktop()) return
  const saved = readState()
  if (!saved) return

  const appWindow = getCurrentWindow()
  try {
    await appWindow.setSize(new LogicalSize(saved.width, saved.height))
    await appWindow.setPosition(new PhysicalPosition(saved.x, saved.y))
  } catch {
    // A monitor that is gone since last time: keep the default geometry.
  }
}

export async function watchWindowState(): Promise<void> {
  if (!isDesktop()) return
  const appWindow = getCurrentWindow()

  let timer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void persist(), SAVE_DELAY_MS)
  }

  const persist = async () => {
    try {
      const size = await appWindow.outerSize()
      const position = await appWindow.outerPosition()
      writeState({
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
      })
    } catch {
      // The window is going away; nothing worth saving.
    }
  }

  await appWindow.onResized(save)
  await appWindow.onMoved(save)
}

function readState(): WindowState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WindowState>
    const { width, height, x, y } = parsed
    if (
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      typeof x !== 'number' ||
      typeof y !== 'number'
    ) {
      return null
    }
    return { width, height, x, y }
  } catch {
    return null
  }
}

function writeState(state: WindowState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // Private mode or a full quota: the window just opens at the default size.
  }
}