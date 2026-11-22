// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
// The timer is an atom of the component's own (`oneTimer`), cleared when the component leaves the screen. Upstream
// kept the latest callback in a ref that a layout effect pointed anew after every draw; here a call runs the callback
// of the draw it was made in, which for a typed value is the draw that showed it.
import { useAtomValue } from "@effect/atom-react"
import { useId } from "react"

import { oneTimer } from "@inventory/ui/components/data-table/data-table-state"

export function useDebouncedCallback<T extends (...args: never[]) => unknown>(callback: T, delay: number) {
  const timer = useAtomValue(oneTimer(useId()))

  function debounced(...args: Parameters<T>) {
    timer.start(() => callback(...args), delay)
  }

  debounced.cancel = timer.cancel
  return debounced
}
