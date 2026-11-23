// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
// The timer is an atom of the component's own (`oneTimer`), cleared when the component leaves the screen. The function
// returned is the same from draw to draw while the delay is (batch 2; the grid's callers list it among what their own
// work depends on), and when it fires it runs the callback of the latest draw, as upstream's did: each draw hands its
// callback to the component's `latestCallback` atom, where upstream pointed a ref at it in a layout effect. Its callers
// each debounce what was typed, so the function takes text: one type the atoms hold and the caller gets back, where
// upstream's took any arguments.
import { useAtomValue } from "@effect/atom-react"
import * as Atom from "effect/reactivity/Atom"
import { useId } from "react"

import { atomRegistry, oneTimer } from "@inventory/ui/components/data-table/data-table-state"

/** What a debounced callback is called with: the text typed. */
type Typed = ReadonlyArray<string>

/** A callback that waits for a pause before it runs, and a way to drop the wait. */
type Debounced = ((...texts: Typed) => void) & { readonly cancel: () => void }

/** The callback one component on screen was last drawn with. */
export const latestCallback = Atom.family((_instance: string) =>
  Atom.make<{ readonly run: (...texts: Typed) => unknown } | null>(null)
)

/** One component's debounced function for a delay, made again only when the delay changes. */
export const debouncedFor = Atom.family((instance: string) =>
  Atom.readable((get) => {
    const registry = get.registry
    const timer = get(oneTimer(instance))
    get.mount(latestCallback(instance))
    let kept: { readonly delay: number; readonly debounced: Debounced } | null = null
    return (delay: number) => {
      if (kept !== null && kept.delay === delay) return kept.debounced
      const debounced = Object.assign(
        (...texts: Typed) => {
          timer.start(() => {
            registry.get(latestCallback(instance))?.run(...texts)
          }, delay)
        },
        { cancel: timer.cancel }
      )
      kept = { delay, debounced }
      return debounced
    }
  }).pipe(Atom.setIdleTTL(0))
)

export function useDebouncedCallback(callback: (...texts: Typed) => unknown, delay: number): Debounced {
  const instance = useId()
  const registry = useAtomValue(atomRegistry)
  const debounced = useAtomValue(debouncedFor(instance))
  registry.set(latestCallback(instance), { run: callback })
  return debounced(delay)
}
