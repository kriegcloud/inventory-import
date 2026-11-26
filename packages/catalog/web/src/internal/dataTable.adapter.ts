import * as O from "effect/Option"

/** The vendored table hook requires a numeric page count before the first server answer. */
export const VendoredTable = { pageCount: (count: O.Option<number>): number => O.getOrElse(count, () => 0) }
