// The rows a confirm did not import, as a file the person can open and fix: each with its reason.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { StagedTable } from "@inventory/catalog-contract/Staged"
import { rowPlace } from "./Review.rules.ts"
import { shownAt } from "./CellRules.rules.ts"
import { keepSome } from "./Mapping.rules.ts"

const csvCell = (cell: string): string => (/[",\r\n]/.test(cell) ? `"${Str.replaceAll('"', '""')(cell)}"` : cell)

/**
 * The rows that are not in the system, with the reason for each, as a CSV the person can open: the file's own
 * columns as the file has them, then Excel's row number (with the item's word when its row holds several,
 * "8 · Feb") and why. Rows whose SKU is already stored are not in it:
 * they are items, counted on screen as "Already there".
 *
 * @example
 * notImportedCsv({ table, rows: [{ rowNumber: 9, label: O.none(), reason: "No name" }] })
 * // "sku,name,Row,Why it was not imported\r\nZZZ-0003,,9,Name is empty."
 */
export const notImportedCsv = (input: {
  readonly table: StagedTable
  readonly rows: ReadonlyArray<{
    readonly rowNumber: number
    readonly label: O.Option<string>
    readonly reason: string
  }>
}): string => {
  const head = [...A.map(input.table.columns, (column) => column.label), "Row", "Why it was not imported"]
  const byNumber = R.fromEntries(A.map(input.table.rows, (row) => [`${row.rowNumber}`, row] as const))
  const body = keepSome(input.rows, (held) =>
    O.map(R.get(byNumber, `${held.rowNumber}`), (row) => [
      ...A.map(input.table.columns, (column) => shownAt(row, column.index)),
      rowPlace(held),
      held.reason
    ])
  )
  return A.join(
    A.map([head, ...body], (cells) => A.join(A.map(cells, csvCell), ",")),
    "\r\n"
  )
}
