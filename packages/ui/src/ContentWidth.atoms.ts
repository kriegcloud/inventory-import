// How wide the page's own area is: the window less what the shell beside it takes (the sidebar, open or folded), as
// atoms. Screens choose a table, a shorter table or cards from this, not from the window, so a tablet with the sidebar
// open gets the layout that fits what is left. Worked out from the window's width and the sidebar's state, never by
// measuring an element: reading an element's size forces a layout pass in the middle of a render. The rule this file
// protects: the room the sidebar takes is derived from its state and the window, never written from a render.
import { useAtomValue } from "@effect/atom-react"
import * as Atom from "effect/reactivity/Atom"

// The sidebar's two widths in `components/sidebar.tsx` (16rem open, 3rem folded), in pixels, and the window width below
// which it is a drawer that takes no room (`hooks/use-mobile.ts`).
export const sidebarOpen = 256
export const sidebarFolded = 48
const drawerBelow = 768

/** Whether the sidebar was left open last time. The sidebar writes this cookie itself when it is toggled. */
export const sidebarWasOpen = (): boolean => !document.cookie.split("; ").includes("sidebar_state=false")

/** The window's width, following it as it is resized. */
export const windowWidth: Atom.Atom<number> = Atom.readable((get) => {
  const follow = () => get.setSelf(window.innerWidth)
  window.addEventListener("resize", follow)
  get.addFinalizer(() => window.removeEventListener("resize", follow))
  return window.innerWidth
})

/** Whether the sidebar is open (not folded to its icons): the shell's sidebar is controlled by this atom. */
export const sidebarExpanded = Atom.make(sidebarWasOpen()).pipe(Atom.keepAlive)

/** Whether the window is narrow enough for the sidebar to be a drawer that takes no room. */
export const sidebarIsDrawer: Atom.Atom<boolean> = Atom.map(windowWidth, (width) => width < drawerBelow)

/** How many pixels beside the page the sidebar takes: its width, folded or open, and none as a drawer. */
export const sidebarTakes: Atom.Atom<number> = Atom.readable((get) =>
  get(sidebarIsDrawer) ? 0 : get(sidebarExpanded) ? sidebarOpen : sidebarFolded
)

/** The width left for the page, in pixels. */
export const contentWidth: Atom.Atom<number> = Atom.readable((get) => get(windowWidth) - get(sidebarTakes))

/** Whether the page's own area is narrower than `pixels`. */
export const contentBelow = Atom.family((pixels: number) => Atom.map(contentWidth, (width) => width < pixels))

/** Below this the page's area is a phone's: tables become cards and the review is one decision at a time. */
export const narrowBelow = 768

/** Whether the page's area is as narrow as a phone's. */
export const isNarrow: Atom.Atom<boolean> = contentBelow(narrowBelow)

/** `contentBelow`, read: for the screens that have not moved to reading the atom themselves (goals/atoms). */
export const useContentBelow = (pixels: number): boolean => useAtomValue(contentBelow(pixels))

/** `contentWidth`, read: for the screens that have not moved to reading the atom themselves (goals/atoms). */
export const useContentWidth = (): number => useAtomValue(contentWidth)

/** `isNarrow`, read: for the screens that have not moved to reading the atom themselves (goals/atoms). */
export const useIsNarrow = (): boolean => useAtomValue(isNarrow)
