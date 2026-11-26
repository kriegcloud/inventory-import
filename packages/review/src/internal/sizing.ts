/**
 * How the review table shares its width out, as a pure rule so it can be tested without a browser. The one thing a
 * reader must not break: a `fit` column is never cut. When the room cannot hold every column, the `fit` column with
 * the lowest priority moves into the row's detail first, then, once no `fit` column is left to move, a `fill` column
 * other than the first (a second description, a note); only when the columns that must stay still do not fit does the
 * table scroll sideways, with its first column pinned. `fill` columns share what is left and end in an ellipsis.
 */
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Num from "effect/Number"
import type { ColumnSize } from "@inventory/review/ReviewTypes"

/** One column as the rule sees it, in the table's order, the record's own column first. */
export type SizedColumn = {
  id: string
  size: ColumnSize
  /** A `fit` column: the width its longest value and its header need. A `fill` column: the least it may take. */
  need: number
  /** Higher stays longer. */
  priority: number
  /**
   * Never moved into the detail: the first column, a column the person turned on themselves, the column the problems
   * on screen are about.
   */
  keep: boolean
}

export type ColumnPlan = {
  /** The columns left in the table, in order, each with its width. */
  shown: ReadonlyArray<{ id: string; width: number }>
  /** The column that takes whatever the others leave (drawn without a fixed width): the first `fill`, else the first. */
  flex: O.Option<string>
  /** The columns moved into each row's detail, in the table's order. */
  folded: ReadonlyArray<string>
  /** The table's least width: the room when it fits, more when it must scroll sideways. */
  minWidth: number
  scrolls: boolean
}

/**
 * Widths for the columns the person is showing, given the room the table has and what it takes beside them
 * (`fixed`: the status and actions columns).
 *
 * @example
 * planColumns({
 *   columns: [
 *     { id: "name", size: "fill", need: 200, priority: 9, keep: true },
 *     { id: "sku", size: "fit", need: 120, priority: 1, keep: false },
 *     { id: "note", size: "fit", need: 300, priority: 0, keep: false }
 *   ],
 *   fixed: 240,
 *   room: 700
 * }).folded // ["note"]: the lowest priority goes first, and the name keeps its 200
 */
export function planColumns(input: { columns: ReadonlyArray<SizedColumn>; fixed: number; room: number }): ColumnPlan {
  const { columns, fixed, room } = input
  const folded: Array<string> = []
  const isShown = (column: SizedColumn): boolean => !folded.includes(column.id)
  const total = (): number => columns.reduce((sum, column) => (isShown(column) ? sum + column.need : sum), fixed)

  // The lowest priority first; between equals, the one furthest right. `fit` columns go before any `fill` one.
  const next = (size: SizedColumn["size"]) =>
    A.head(
      A.sort(
        A.filter(
          A.map(columns, (column, index) => ({ column, index })),
          ({ column, index }) => index > 0 && column.size === size && !column.keep && isShown(column)
        ),
        (
          a: { readonly column: SizedColumn; readonly index: number },
          b: { readonly column: SizedColumn; readonly index: number }
        ) => Num.sign(a.column.priority - b.column.priority || b.index - a.index)
      )
    )
  while (total() > room) {
    const candidate = O.orElse(next("fit"), () => next("fill"))
    if (O.isNone(candidate)) break
    folded.push(candidate.value.column.id)
  }

  const shown = columns.filter(isShown)
  const used = total()
  const scrolls = used > room
  const fills = shown.filter((column) => column.size === "fill")
  // What is left over goes to the `fill` columns in equal parts; with none, the first column takes it.
  const extra = scrolls ? 0 : room - used
  const share = fills.length === 0 ? 0 : Math.floor(extra / fills.length)
  const flex = O.map(
    O.orElse(A.head(fills), () => A.head(shown)),
    (column) => column.id
  )
  return {
    shown: shown.map((column) => ({
      id: column.id,
      width:
        column.size === "fill"
          ? column.need + share
          : fills.length === 0 && O.contains(flex, column.id)
            ? column.need + extra
            : column.need
    })),
    flex,
    folded: columns.filter((column) => folded.includes(column.id)).map((column) => column.id),
    minWidth: used,
    scrolls
  }
}

/** A column's priority as the rule reads it: its own number, else 1 for a `core` column and 0 for the rest. */
export const priorityOf = (column: { priority: O.Option<number>; core: boolean }): number =>
  O.match(column.priority, { onNone: () => (column.core ? 1 : 0), onSome: (priority) => priority })
