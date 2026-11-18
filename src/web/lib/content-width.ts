import { useSyncExternalStore } from "react"

// How wide the page's own area is: the window less what the shell beside it takes (the sidebar, open or folded).
// Screens choose a table, a shorter table or cards from this, not from the window, so a tablet with the sidebar
// open gets the layout that fits what is left. Worked out from two numbers, never by measuring an element: reading
// an element's size forces a layout pass in the middle of a render.

// The sidebar's two widths in `components/ui/sidebar.tsx` (16rem open, 3rem folded), in pixels, and the window width
// below which it is a drawer that takes no room (`hooks/use-mobile.ts`).
export const sidebarOpen = 256
export const sidebarFolded = 48
const drawerBelow = 768

/** Whether the sidebar was left open last time. The sidebar writes this cookie itself when it is toggled. */
export const sidebarWasOpen = (): boolean => !document.cookie.split("; ").includes("sidebar_state=false")

// What the shell takes, known before it says so: a page whose code arrived with the shell's renders in the same pass,
// before the shell's layout effect (`setContentInset`), and must already see the room it will have. The shell then
// keeps it true as the sidebar opens, folds or becomes a drawer.
let inset = window.innerWidth < drawerBelow ? 0 : sidebarWasOpen() ? sidebarOpen : sidebarFolded
// A plain list, not Effect's MutableHashSet: this module is in the sign-in screen's first download, which holds no
// Effect code, and MutableHashSet would add 16.6 kB (6.0 kB gzipped) to it.
let listeners: ReadonlyArray<() => void> = []

const subscribe = (notify: () => void) => {
  listeners = [...listeners, notify]
  window.addEventListener("resize", notify)
  return () => {
    listeners = listeners.filter((entry) => entry !== notify)
    window.removeEventListener("resize", notify)
  }
}

/** Told by the shell how many pixels beside the page it takes: the sidebar's width, 0 when it is a drawer. */
export const setContentInset = (pixels: number) => {
  if (pixels === inset) return
  inset = pixels
  for (const notify of listeners) notify()
}

/** The width left for the page, in pixels. */
export const contentWidth = (): number => window.innerWidth - inset

/** Whether the page's own area is narrower than `pixels`, re-rendering when that changes. */
export function useContentBelow(pixels: number): boolean {
  return useSyncExternalStore(
    subscribe,
    () => contentWidth() < pixels,
    () => false
  )
}

/** The width left for the page, re-rendering when the window or the sidebar changes it. */
export function useContentWidth(): number {
  return useSyncExternalStore(subscribe, contentWidth, () => 1280)
}

/** Below this the page's area is a phone's: tables become cards and the review is one decision at a time. */
export const narrowBelow = 768

/** Whether the page's area is as narrow as a phone's. */
export function useIsNarrow(): boolean {
  return useContentBelow(narrowBelow)
}
