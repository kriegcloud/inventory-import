// Which file column fills which field: by its heading, ignoring case, spaces and punctuation, or as a person chose.
// The one thing not to break: a heading is matched by name only, never by what the column holds.
import * as A from "effect/Array"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as Str from "effect/String"
import { StagedTable, fields, StagedColumn, Field, StagedNote, StagedRow } from "@inventory/catalog-contract/Staged"
import { filledAt, isTotalCell } from "./CellRules.rules.ts"
import {
  MappingChoice,
  ColumnMatch,
  ColumnPick,
  MatchHow,
  matchedByPerson,
  notMatched,
  matchedByHeading
} from "@inventory/catalog-contract/Mapping"

/** Maps and keeps the values that exist. Effect 4's `A.filterMap` takes a Result, not an Option. */
export const keepSome: {
  <A, B>(f: (a: A, index: number) => O.Option<B>): (list: ReadonlyArray<A>) => Array<B>
  <A, B>(list: ReadonlyArray<A>, f: (a: A, index: number) => O.Option<B>): Array<B>
} = dual(2, <A, B>(list: ReadonlyArray<A>, f: (a: A, index: number) => O.Option<B>): Array<B> =>
  A.getSomes(A.map(list, f))
)

const headingKey = (heading: string): string => Str.toLowerCase(Str.replace(/[^a-z0-9]/gi, "")(heading))

/** The headings each field answers to, compared without case, spaces or punctuation ("Unit Cost ($)" is "unitcost"). */
export const headingWords: Record<Field, ReadonlyArray<string>> = {
  sku: ["sku", "code", "itemcode", "itemsku", "partnumber", "partno"],
  name: ["name", "itemname", "item", "title"],
  description: ["description", "desc", "details"],
  category: ["category", "cat", "itemcategory"],
  uom: ["uom", "unit", "unitofmeasure", "units"],
  unitCost: ["unitcost", "cost", "unitprice", "price"],
  quantityOnHand: ["quantityonhand", "qtyonhand", "quantity", "qty", "onhand", "stock"],
  reorderPoint: ["reorderpoint", "reorderpt", "reorder", "reorderlevel"],
  isActive: ["isactive", "active"],
  lotTracked: ["lottracked", "lottracking", "islottracked"],
  tags: ["tags", "tag", "labels"],
  firstReceivedOn: ["firstreceivedon", "firstreceived", "receivedon", "received"],
  discontinuedOn: ["discontinuedon", "discontinued"],
  dimensions: ["dimensions", "dimensionsjson", "dims", "size"],
  vendors: ["vendors", "vendorsjson", "vendor", "suppliers"]
}

/**
 * The rows that add the file up: the ones the reader named, and any row with a cell that says only "Total", and of
 * those only the rows with no SKU. A row with a SKU is an item, whatever its name: an item called "Total" is counted.
 * `skuColumn` is the column the SKU is read from; with none, no row has a SKU.
 */
export const totalRowNumbers = (input: {
  readonly table: StagedTable
  readonly skuColumn: O.Option<number>
}): ReadonlyArray<number> => {
  const { table, skuColumn } = input
  const noted = A.flatMap(table.notes, (note: StagedNote): ReadonlyArray<number> =>
    note.kind === "totalRow" ? note.rows : []
  )
  const noSku = (row: StagedRow): boolean => !O.exists(skuColumn, (index) => O.isSome(filledAt(row, index)))
  return A.map(
    A.filter(table.rows, (row) => noSku(row) && (A.contains(noted, row.rowNumber) || A.some(row.cells, isTotalCell))),
    (row) => row.rowNumber
  )
}

/**
 * Which file column fills which field. Headings are matched by name, ignoring case, spaces and punctuation; a
 * choice the person made overrides that. A field with no column stays empty and its rows say so, instead of the app
 * guessing from the data.
 */
export const matchColumns = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
}): ReadonlyArray<ColumnMatch> => {
  const { table } = input
  // A column a person gave to one field is not also matched to another by its heading.
  const taken = keepSome(input.choices, (choice) => choice.column)
  const picked = A.map(fields, (field) => {
    const choice = A.findLast(input.choices, (candidate) => candidate.field === field)
    const byName = A.findFirst(
      table.columns,
      (column) => A.contains(headingWords[field], headingKey(column.label)) && !A.contains(taken, column.index)
    )
    const column = O.isSome(choice)
      ? O.flatMap(choice.value.column, (index) => A.findFirst(table.columns, (candidate) => candidate.index === index))
      : byName
    const how = O.isSome(choice)
      ? O.isNone(column)
        ? ("none" as const)
        : choice.value.by
      : O.isSome(byName)
        ? ("heading" as const)
        : ("none" as const)
    return { field, column, how }
  })
  // Which rows are totals depends on the SKU's column, so the columns are picked before the examples are read.
  const skuColumn = O.flatMap(
    A.findFirst(picked, (match) => match.field === "sku"),
    (match) => O.map(match.column, (found) => found.index)
  )
  const totals = totalRowNumbers({ table, skuColumn })
  const itemRows = A.filter(table.rows, (row) => !A.contains(totals, row.rowNumber))
  const pick = (column: StagedColumn): ColumnPick => ({
    index: column.index,
    header: column.label,
    examples: A.take(A.dedupe(A.getSomes(A.map(itemRows, (row) => filledAt(row, column.index)))), 3)
  })
  return A.map(picked, ({ field, column, how }): ColumnMatch => {
    const found = O.map(column, pick)
    // A heading that named a column always has one; without it the field is simply not matched.
    return MatchHow.is.person(how)
      ? matchedByPerson({ field, column: found })
      : O.match(found, {
          onNone: (): ColumnMatch => notMatched({ field }),
          onSome: (chosen): ColumnMatch => matchedByHeading({ field, column: chosen })
        })
  })
}
