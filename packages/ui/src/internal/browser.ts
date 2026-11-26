// Browser keyboard ownership is read once at the DOM boundary.
import * as O from "effect/Option"

/** The nearest matching ancestor, with absence converted at the actual closest read. */
export const closest =
  (selector: string) =>
  (node: Element): O.Option<Element> =>
    O.fromNullOr(node.closest(selector))
