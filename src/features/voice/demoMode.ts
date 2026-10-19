import { useSyncExternalStore } from "react"

const KEY = "svach-voice-demo-mode"
const listeners = new Set<() => void>()

function read() {
  try {
    return localStorage.getItem(KEY) === "true"
  } catch {
    return false
  }
}

export function setDemoMode(on: boolean) {
  try {
    localStorage.setItem(KEY, String(on))
  } catch {
    // Storage can be blocked (private window); the toggle just won't persist.
  }
  listeners.forEach((l) => l())
}

/** Demo mode is a display filter on the Voice pages: ON shows only demo data
 * (synthetic calls and anything tagged demo), OFF shows only real data. It is
 * not a security boundary — Sales/Nexus still show real records. */
export function useDemoMode() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => false,
  )
}
