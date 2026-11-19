// The rows a confirm did not import, as a file the person can open and fix: each with its reason.
import { Array as Arr, Option, Record as Rec, String as Str } from "effect"
import { StagedTable } from "@inventory/catalog-contract/Staged"
import { rowPlace } from "./Review.rules.ts"
import { shownText } from "./Mapping.rules.ts"

/** Maps and keeps the values that exist. Effect 4's `Arr.filterMap` takes a Result, not an Option. */
const keepSome = <A, B>(list: ReadonlyArray<A>, f: (a: A, index: number) => Option.Option<B>): Array<B> =>
  Arr.getSomes(Arr.map(list, f))

const csvCell = (cell: string): string => (/[",\r\n]/.test(cell) ? `"${Str.replaceAll('"', '""')(cell)}"` : cell)

/**
 * The rows that are not in the system, with the reason for each, as a CSV the person can open: the file's own
 * columns as the file has them, then Excel's row number (with the item's word when its row holds several,
 * "8 · Feb") and why. Rows whose SKU is already stored are not in it:
 * they are items, counted on screen as "Already there".
 *
 * @example
 * notImportedCsv({ table, rows: [{ rowNumber: 9, reason: "No name" }] })
 * // "sku,name,Row,Why it was not imported\r\nZZZ-0003,,9,Name is empty."
 */
export const notImportedCsv = (input: {
  readonly table: StagedTable
  readonly rows: ReadonlyArray<{ readonly rowNumber: number; readonly label?: string; readonly reason: string }>
}): string => {
  const head = [...Arr.map(input.table.columns, (column) => column.label), "Row", "Why it was not imported"]
  const byNumber = Rec.fromEntries(Arr.map(input.table.rows, (row) => [`${row.rowNumber}`, row] as const))
  const body = keepSome(input.rows, (held) =>
    Option.map(Rec.get(byNumber, `${held.rowNumber}`), (row) => [
      ...Arr.map(input.table.columns, (column) => shownText(row.cells[column.index])),
      rowPlace(held),
      held.reason
    ])
  )
  return Arr.join(
    Arr.map([head, ...body], (cells) => Arr.join(Arr.map(cells, csvCell), ",")),
    "\r\n"
  )
}
