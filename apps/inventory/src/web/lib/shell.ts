// The shell's own state that is not the content width's (that, with the sidebar's state, is in
// `@inventory/ui/ContentWidth`): the slot in the bar a page puts its own navigation in.
import * as Atom from "effect/reactivity/Atom"

/** The element in the bar where a page puts its own navigation (the import's steps); none until the bar is drawn. */
export const barSlot = Atom.make<HTMLElement | null>(null)
