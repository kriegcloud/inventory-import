// The shell's own state, as atoms: whether the sidebar is open, whether the window is narrow enough for it to be a
// drawer, the room it takes beside the page, and the slot in the bar a page puts its own navigation in. The rule this
// file protects: the room the sidebar takes is derived from the sidebar's state and the window, never written from a
// render, so a page reads one value that is always true.
import * as Atom from "effect/reactivity/Atom"
import { setContentInset, sidebarFolded, sidebarOpen, sidebarWasOpen } from "@inventory/ui/ContentWidth"

/** Whether the sidebar is open (not folded to its icons). The sidebar itself keeps the cookie that remembers it. */
export const sidebarExpanded = Atom.make(sidebarWasOpen()).pipe(Atom.keepAlive)

/** Below this width the sidebar is a drawer that takes no room: the vendored sidebar's own breakpoint (768 px). */
const drawerQuery = "(max-width: 767px)"

/** Whether the window is narrow enough for the sidebar to be a drawer; follows the window as it is resized. */
export const sidebarIsDrawer: Atom.Atom<boolean> = Atom.readable((get) => {
  const media = window.matchMedia(drawerQuery)
  const follow = () => get.setSelf(media.matches)
  media.addEventListener("change", follow)
  get.addFinalizer(() => media.removeEventListener("change", follow))
  return media.matches
})

/** How many pixels beside the page the sidebar takes: its width, folded or open, and none as a drawer. */
export const sidebarTakes: Atom.Atom<number> = Atom.readable((get) =>
  get(sidebarIsDrawer) ? 0 : get(sidebarExpanded) ? sidebarOpen : sidebarFolded
)

/**
 * Tells the content-width store (`@inventory/ui/ContentWidth`) the room the sidebar takes, while the shell with a
 * sidebar is mounted, and none once it is gone. A bridge until that store is itself an atom over `sidebarTakes`
 * (goals/atoms, step 5): it follows the atom by subscription, never from a render.
 */
export const contentInsetFollower: Atom.Atom<void> = Atom.readable((get) => {
  get.subscribe(sidebarTakes, setContentInset, { immediate: true })
  get.addFinalizer(() => setContentInset(0))
})

/** The element in the bar where a page puts its own navigation (the import's steps); none until the bar is drawn. */
export const barSlot = Atom.make<HTMLElement | null>(null)
