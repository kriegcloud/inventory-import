// The column the data table's filter control is handed for one facet of the review. The one thing not to break: the
// column keeps its table. A column's `table` is not an own property, so a spread alone drops it, and the control,
// which follows the table's filters to redraw, then throws and the Review step draws nothing.
import type { Column, RowData, Table } from "@tanstack/react-table"
import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"

/**
 * A table's column as the filter control reads it, with the review's own filter state behind it: the control asks
 * the column which values are picked and tells it the next ones, and the region keeps them (`facetPicked`); the
 * rows are filtered by the region's atom, not by the table.
 */
export const facetColumn = <TData extends RowData>(input: {
  readonly table: Table<DataTableFeatures, TData>
  readonly column: Column<DataTableFeatures, TData, unknown>
  readonly picked: ReadonlyArray<string>
  readonly pick: (next: unknown) => void
}): Column<DataTableFeatures, TData, unknown> => ({
  ...input.column,
  table: input.table,
  getFilterValue: () => input.picked,
  setFilterValue: input.pick
})
