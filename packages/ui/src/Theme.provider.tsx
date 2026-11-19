import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react"

/** What the person chose: light, dark, or whatever their device is set to. */
export type Theme = "light" | "dark" | "system"
type Resolved = "light" | "dark"

const storageKey = "theme"
const media = () => window.matchMedia("(prefers-color-scheme: dark)")
// --background of each theme in index.css, for the browser's own bar on a phone. Constants on purpose: reading it with
// getComputedStyle here forces a style pass inside the first render and made that task 70 ms longer (Lighthouse TBT).
const pageColour = { light: "#ffffff", dark: "#09090b" } as const

const readStored = (): Theme => {
  try {
    const value = window.localStorage.getItem(storageKey)
    // Light unless the person has chosen otherwise.
    return value === "dark" || value === "system" ? value : "light"
  } catch {
    return "light"
  }
}

const ThemeContext = createContext<{ theme: Theme; resolvedTheme: Resolved; setTheme: (theme: Theme) => void } | null>(
  null
)

/** Light by default, dark or system by choice. The class on <html> is set before first paint by the script in index.html. */
export function ThemeProvider(props: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored)
  const [systemDark, setSystemDark] = useState(() => media().matches)

  useEffect(() => {
    const query = media()
    const onChange = () => setSystemDark(query.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  const resolvedTheme: Resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", pageColour[resolvedTheme])
  }, [resolvedTheme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next: Theme) => {
        setThemeState(next)
        try {
          window.localStorage.setItem(storageKey, next)
        } catch {
          // Storage can be refused in private windows. The choice then lasts until reload.
        }
      }
    }),
    [theme, resolvedTheme]
  )

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>
}

/** Outside a provider (or mid hot-reload) this answers "light" instead of throwing: a theme hook must never blank the page. */
const fallback = { theme: "light" as Theme, resolvedTheme: "light" as Resolved, setTheme: (_theme: Theme) => {} }

export function useTheme() {
  return useContext(ThemeContext) ?? fallback
}
