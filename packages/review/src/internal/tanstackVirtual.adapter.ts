import type { VirtualItem } from "@tanstack/react-virtual"
import * as O from "effect/Option"

/** TanStack can name an index while the corresponding owned list is changing and requires a nullable scroller. */
export const TanStackVirtual = {
  entry: <T>(entries: ReadonlyArray<T>, index: number): O.Option<T> => O.fromUndefinedOr(entries[index]),
  scroller: <T>(element: O.Option<T>): T | null => O.getOrNull(element),
  padding: (items: ReadonlyArray<VirtualItem>, total: number) => ({
    top: items[0]?.start ?? 0,
    bottom: total - (items[items.length - 1]?.end ?? 0)
  })
}
