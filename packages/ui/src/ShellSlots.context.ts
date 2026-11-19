import { createContext } from "react"

/**
 * The place in the shell's top bar, between the breadcrumb and the theme button, where a page puts navigation of
 * its own (the import's steps). Null when the frame has no bar for it (nobody is signed in) or it is not drawn yet.
 */
export const BarSlotContext = createContext<HTMLElement | null>(null)

/** The place beside the import's steps where the showing step puts its own control (the review's Ask button). */
export const StepActionsContext = createContext<HTMLElement | null>(null)
