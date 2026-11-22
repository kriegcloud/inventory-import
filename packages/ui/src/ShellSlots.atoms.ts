// The places in the shell a page puts something of its own, as atoms: set by a ref callback where the shell draws
// the place, read by the page that portals into it.
import * as Atom from "effect/reactivity/Atom"

/**
 * The place in the shell's top bar, between the breadcrumb and the theme button, where a page puts navigation of its
 * own (the import's steps). None when the frame has no bar for it (nobody is signed in) or it is not drawn yet.
 */
export const barSlot = Atom.make<HTMLElement | null>(null)
