import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import type { Table, Column, RowData } from "@tanstack/react-table"
import * as O from "effect/Option"

/** The hook copies a TanStack table; its first leaf belongs to the original, when any leaf exists. */
export const TanStackTable = {
  core: <T extends RowData>(table: Table<DataTableFeatures, T>): Table<DataTableFeatures, T> =>
    table.getAllLeafColumns()[0]?.table ?? table,
  column: <T extends RowData>(table: Table<DataTableFeatures, T>, id: string): O.Option<Column<DataTableFeatures, T>> =>
    O.fromUndefinedOr(table.getColumn(id))
}
