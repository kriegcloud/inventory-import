// The theme, as atoms: what the person chose (kept in localStorage under "theme", as the script in index.html reads it
// before the first paint), whether the device is set to dark, and the theme that follows from the two. The rule this
// file protects: the class on <html> and the browser's bar colour are written by the atom that derives the theme,
// mounted once at the root, never from a render.
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import * as Atom from "effect/reactivity/Atom"
import type { ReactNode } from "react"

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

/**
 * What the person chose, kept in localStorage as the bare word. Not `Atom.kvs`: it stores JSON (`"dark"` in quotes),
 * which the pre-paint script (`public/theme-init.js`) does not read, and every choice already stored would be lost.
 */
export const theme: Atom.Writable<Theme> = Atom.writable(
  () => readStored(),
  (ctx, next: Theme) => {
    try {
      window.localStorage.setItem(storageKey, next)
    } catch {
      // Storage can be refused in private windows. The choice then lasts until reload.
    }
    ctx.setSelf(next)
  }
).pipe(Atom.keepAlive)

/** Whether the device is set to dark, following it when it changes. */
const deviceDark: Atom.Atom<boolean> = Atom.readable((get) => {
  const query = media()
  const follow = () => get.setSelf(query.matches)
  query.addEventListener("change", follow)
  get.addFinalizer(() => query.removeEventListener("change", follow))
  return query.matches
})

/** The theme the page shows: the person's choice, or the device's when they chose "system". */
export const resolvedTheme: Atom.Atom<Resolved> = Atom.readable((get) => {
  const chosen = get(theme)
  return chosen === "system" ? (get(deviceDark) ? "dark" : "light") : chosen
})

/** Puts the theme on the page (the class on <html>, the bar colour) whenever it changes, while mounted. */
const themeOnPage: Atom.Atom<void> = Atom.readable((get) => {
  get.subscribe(
    resolvedTheme,
    (shown) => {
      document.documentElement.classList.toggle("dark", shown === "dark")
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", pageColour[shown])
    },
    { immediate: true }
  )
})

/**
 * Light by default, dark or system by choice: keeps the page in the theme while it is drawn. The class is set before
 * first paint by index.html. It reads the atom registry, so it sits inside `RegistryProvider`.
 */
export function ThemeProvider(props: { children: ReactNode }) {
  useAtomMount(themeOnPage)
  return props.children
}

/** The theme as the vendored toaster and the menus read it: the choice, the theme shown, and how to choose. */
export function useTheme(): { theme: Theme; resolvedTheme: Resolved; setTheme: (theme: Theme) => void } {
  return { theme: useAtomValue(theme), resolvedTheme: useAtomValue(resolvedTheme), setTheme: useAtomSet(theme) }
}
