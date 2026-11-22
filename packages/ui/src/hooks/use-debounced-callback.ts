// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
// The timer is an atom of the component's own (`oneTimer`), cleared when the component leaves the screen. The function
// returned is the same from draw to draw while the delay is (batch 2; the grid's callers list it among what their own
// work depends on), and when it fires it runs the callback of the latest draw, as upstream's did: each draw hands its
// callback to the component's `latestCallback` atom, where upstream pointed a ref at it in a layout effect.
import { useAtomValue } from "@effect/atom-react"
import * as Atom from "effect/reactivity/Atom"
import { useId } from "react"

import { atomRegistry, oneTimer } from "@inventory/ui/components/data-table/data-table-state"

type Debounced<T extends (...args: never[]) => unknown> = ((...args: Parameters<T>) => void) & { cancel: () => void }

/** The callback one component on screen was last drawn with. */
export const latestCallback = Atom.family((_instance: string) =>
  Atom.make<{ readonly run: (...args: never[]) => unknown } | null>(null)
)

/** One component's debounced function for a delay, made again only when the delay changes. */
export const debouncedFor = Atom.family((instance: string) =>
  Atom.readable((get) => {
    const registry = get.registry
    const timer = get(oneTimer(instance))
    get.mount(latestCallback(instance))
    let kept: { readonly delay: number; readonly debounced: Debounced<(...args: never[]) => unknown> } | null = null
    return (delay: number) => {
      if (kept !== null && kept.delay === delay) return kept.debounced
      const debounced = Object.assign(
        (...args: never[]) => {
          timer.start(() => {
            registry.get(latestCallback(instance))?.run(...args)
          }, delay)
        },
        { cancel: timer.cancel }
      )
      kept = { delay, debounced }
      return debounced
    }
  }).pipe(Atom.setIdleTTL(0))
)

export function useDebouncedCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number
): Debounced<T> {
  const instance = useId()
  const registry = useAtomValue(atomRegistry)
  const debounced = useAtomValue(debouncedFor(instance))
  registry.set(latestCallback(instance), { run: callback })
  return debounced(delay) as Debounced<T>
}
