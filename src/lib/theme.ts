import { useState } from "react"

/** Light / dark theme. Dark is the default (the measured design); the choice is a
 * per-browser preference kept in localStorage and applied as data-theme on <html>
 * — index.html applies it before first paint, globals.css holds the light palette. */
export type Theme = "dark" | "light"

const STORAGE_KEY = "hq-theme"

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark"
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(currentTheme)

  function setTheme(next: Theme) {
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode / blocked storage: the theme still applies for this visit.
    }
    setThemeState(next)
  }

  return { theme, setTheme, toggle: () => setTheme(theme === "light" ? "dark" : "light") }
}
