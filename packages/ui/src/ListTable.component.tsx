import { createColumnHelper, type ColumnDef, type FilterFn, type RowData } from "@tanstack/react-table"
import { type ReactNode, useMemo } from "react"
import { TableSearch } from "@inventory/ui/TableSearch"
import { Button } from "@inventory/ui/components/button"
import { DataTable } from "@inventory/ui/components/data-table/data-table"
import { DataTableCards } from "@inventory/ui/components/data-table/data-table-cards"
import { DataTableColumnHeader } from "@inventory/ui/components/data-table/data-table-column-header"
import { createDataTableConfig } from "@inventory/ui/components/data-table/data-table-config"
import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import { DataTablePagination } from "@inventory/ui/components/data-table/data-table-pagination"
import { DataTableToolbar } from "@inventory/ui/components/data-table/data-table-toolbar"
import type { ColumnSelectOption, DataTableColumnConfig } from "@inventory/ui/components/data-table/data-table-types"
import { useDataTable } from "@inventory/ui/hooks/use-data-table"
import { useContentWidth, useIsNarrow } from "@inventory/ui/ContentWidth"

// A list the page already holds whole (the activity, the people), on the same data table as the Items page: sortable
// headings, the column toggle, the one search box and the quick filters. The Items page asks the server for each
// page; these lists are small, so the table sorts, filters, searches and pages them here, with its own row models.

/** One column of a held list. The first column is the record's name: semibold, and the card's heading on a phone. */
export type ListColumn<Row> = {
  readonly id: string
  readonly label: string
  /** Pixels. Leave it out on one column to give it the room that is left. */
  readonly width?: number
  readonly align?: "right"
  /**
   * What the column sorts, filters and is searched by. Left out, the column only shows its cells (a column of row
   * buttons): it does not sort, filter, hide or take part in the search.
   */
  readonly value?: (row: Row) => string | number
  /** What the cell shows. Left out, the value as text. */
  readonly cell?: (row: Row) => ReactNode
  /** Shown on hover. Left out, a cell that is plain text shows its own text: the column may be too narrow for it. */
  readonly title?: (row: Row) => string
  /** True when this row has nothing in this column: a phone card then leaves the line out. */
  readonly blank?: (row: Row) => boolean
  /** False for a column whose heading does not sort (a pair of values, a sentence). */
  readonly sortable?: boolean
  /** False for a column the search box does not look in (a time, a row number). */
  readonly searchable?: boolean
  /** A quick filter in the toolbar listing every value the rows have, with its count. For a column of few values. */
  readonly facet?: boolean
  /** Pinned at the end, so its buttons stay in reach when the table scrolls sideways. */
  readonly end?: boolean
  /** A column of sentences (a basis, a detail): shown whole, on as many lines as it takes, never cut to one. */
  readonly wrap?: boolean
}

const pageSizes = [25, 50, 100, 200] as const
/** Long enough for any words a person searches a list for. */
const maxSearch = 200

// The page's gutters on a desk (sm:px-9) and the frame's border: what the table's columns cannot use of the page.
const chrome = 36 * 2 + 2
// The least a column without a width gets when the others take the room: a sentence still shows a few words.
const leastFlexible = 160

// Each row's searchable text, kept while the visible columns stay the same: the search tests a row once per column.
const searchText = new WeakMap<object, { readonly columns: string; readonly text: string }>()

/**
 * The search box's rule for a held list: every word typed, in any order, is somewhere in the row's visible columns
 * that are searched, ignoring case. "rule cost" finds a cost decided by a rule.
 */
const everyWord: FilterFn<DataTableFeatures, RowData> = (row, _columnId, filterValue) => {
  const words = (typeof filterValue === "string" ? filterValue : "")
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "")
  if (words.length === 0) return true
  const columns = row.table.getVisibleLeafColumns().filter((column) => column.getCanGlobalFilter())
  const key = columns.map((column) => column.id).join("|")
  const original = row.original
  const holder = typeof original === "object" && original !== null ? original : undefined
  const kept = holder === undefined ? undefined : searchText.get(holder)
  let text = kept?.columns === key ? kept.text : undefined
  if (text === undefined) {
    text = columns
      .map((column) => {
        const value = row.getValue(column.id)
        return typeof value === "string" || typeof value === "number" ? String(value) : ""
      })
      .join(" ")
      .toLowerCase()
    if (holder !== undefined) searchText.set(holder, { columns: key, text })
  }
  const found = text
  return words.every((word) => found.includes(word))
}

/** Every value a column has in these rows, with how many rows have it, for its quick filter. */
const optionsOf = <Row,>(rows: ReadonlyArray<Row>, value: (row: Row) => string | number): ColumnSelectOption[] => {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const text = String(value(row))
    counts[text] = (Object.hasOwn(counts, text) ? (counts[text] ?? 0) : 0) + 1
  }
  return Object.keys(counts)
    .sort((a, b) => a.localeCompare(b))
    .map((text) => ({ label: text === "" ? "Not set" : text, value: text, count: counts[text] ?? 0 }))
}

/**
 * A list the page already holds, as a data table the person sorts from its headings, searches, filters by the
 * values a column has, and narrows to the columns they want; on a page as narrow as a phone, the same rows as cards.
 */
export function ListTable<Row extends RowData>(props: {
  /** What the table holds, for the scroll region and the screen reader ("People in the organization"). */
  readonly caption: string
  readonly columns: ReadonlyArray<ListColumn<Row>>
  readonly rows: ReadonlyArray<Row>
  readonly rowKey: (row: Row) => string
  /** Shown in place of rows when the list has none at all. */
  readonly empty: ReactNode
  /** The search box's label and placeholder ("Search people"). */
  readonly searchLabel: string
  /** The widest the table's column of the page can be, in pixels, when it sits in a narrow column of its own. */
  readonly maxWidth?: number
}) {
  const narrow = useIsNarrow()
  const room = Math.min(useContentWidth(), props.maxWidth ?? Number.POSITIVE_INFINITY)
  const { columns, rows } = props
  // The column without a width takes the room the others leave, never less than `leastFlexible`: only then does
  // the table scroll sideways inside its frame.
  const fixed = columns.reduce((total, column) => total + (column.width ?? 0), 0)
  const flexible = Math.max(leastFlexible, room - chrome - fixed)
  // The config follows the columns' ids and what each does, not the array itself: a page that builds its columns on
  // every render (their cells close over its state) keeps its order, its filters and its page.
  const shape = columns
    .map(
      (column) =>
        `${column.id}:${column.value !== undefined && column.sortable !== false ? "sort" : ""}:${column.value !== undefined && column.facet === true ? "facet" : ""}`
    )
    .join("|")
  const config = useMemo(
    () =>
      createDataTableConfig({
        columns: Object.fromEntries(
          shape.split("|").map((entry): [string, DataTableColumnConfig] => {
            const [id = "", sorts, facet] = entry.split(":")
            return [
              id,
              { ...(sorts === "" ? { enableSorting: false } : {}), ...(facet === "" ? {} : { variant: "select" }) }
            ]
          })
        ),
        defaultPageSize: pageSizes[1],
        pageSizeOptions: pageSizes,
        enableGlobalFilter: true
      }),
    [shape]
  )
  const tableColumns = useMemo(() => {
    const col = createColumnHelper<DataTableFeatures, Row>()
    const first = columns[0]?.id
    return columns.map((column): ColumnDef<DataTableFeatures, Row, unknown> => {
      const size = column.width ?? flexible
      const show = column.cell ?? ((row: Row) => (column.value === undefined ? null : String(column.value(row))))
      const value = column.value
      if (value === undefined) {
        return col.display({
          id: column.id,
          header: column.label,
          cell: ({ row }) => show(row.original),
          meta: { label: column.label },
          enableHiding: false,
          size
        }) as ColumnDef<DataTableFeatures, Row, unknown>
      }
      return col.accessor((row) => value(row), {
        id: column.id,
        header: ({ column: header }) => (
          <DataTableColumnHeader column={header} className={column.align === "right" ? "justify-end" : undefined} />
        ),
        cell: ({ row }) => {
          const content = show(row.original)
          const hover = column.title?.(row.original) ?? (typeof content === "string" ? content : undefined)
          // The record's name, first, in semibold; numbers at the right in tabular figures.
          const face =
            column.align === "right"
              ? "block truncate text-right tabular-nums"
              : column.id === first
                ? "block truncate font-semibold"
                : column.wrap === true
                  ? "block py-1 leading-snug whitespace-normal"
                  : "block truncate"
          return (
            <span className={face} title={hover}>
              {content}
            </span>
          )
        },
        meta: {
          label: column.label,
          ...(column.facet === true ? { options: optionsOf(rows, value) } : {})
        },
        enableHiding: column.id !== first,
        enableGlobalFilter: column.searchable !== false,
        size
      }) as ColumnDef<DataTableFeatures, Row, unknown>
    })
  }, [columns, flexible, rows])
  const first = columns[0]?.id
  const ends = columns.filter((column) => column.end === true).map((column) => column.id)
  const { table } = useDataTable({
    mode: "client",
    data: rows as Array<Row>,
    columns: tableColumns,
    config,
    getRowId: props.rowKey,
    globalFilterFn: everyWord as FilterFn<DataTableFeatures, Row>,
    enableRowSelection: false,
    initialState: { columnPinning: { start: first === undefined ? [] : [first], end: ends } }
  })

  const searched = typeof table.state.globalFilter === "string" ? table.state.globalFilter : ""
  const showAll = () => {
    table.resetColumnFilters(true)
    table.resetGlobalFilter(true)
  }
  // A list with rows that a search or a filter emptied keeps its table; one row says so and offers the way back.
  const empty =
    rows.length === 0 ? (
      props.empty
    ) : (
      <span>
        Nothing matches {searched === "" ? "these filters" : `“${searched}”`}.{" "}
        <Button variant="link" size="sm" onClick={showAll}>
          Show all
        </Button>
      </span>
    )
  const paged = rows.length > pageSizes[0]
  const toolbar =
    rows.length === 0 ? null : (
      <DataTableToolbar
        table={table}
        quick={columns.filter((column) => column.facet === true).map((column) => column.id)}
        search={
          <TableSearch
            value={searched}
            onSearch={(text) => table.setGlobalFilter(text)}
            placeholder={props.searchLabel}
            working={false}
            maxLength={maxSearch}
            shortcutHint={!narrow}
            className={narrow ? "w-auto min-w-0 flex-1" : "w-80"}
          />
        }
      />
    )

  if (narrow) {
    const blanks = Object.fromEntries(columns.map((column) => [column.id, column.blank]))
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {toolbar === null ? null : <div className="px-3 pb-2">{toolbar}</div>}
        <DataTableCards
          table={table}
          label={props.caption}
          empty={empty}
          blank={(columnId, row) => (Object.hasOwn(blanks, columnId) ? blanks[columnId]?.(row) === true : false)}
        />
        {paged ? (
          <div className="px-4 py-2">
            <DataTablePagination table={table} />
          </div>
        ) : null}
      </div>
    )
  }
  // The gutters are the page's; the table fills what is left and scrolls inside its own frame.
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 sm:px-9">
      <DataTable
        table={table}
        stickyHeader
        aria-label={props.caption}
        className="min-h-0 flex-1"
        empty={empty}
        withPagination={paged}
      >
        {toolbar}
      </DataTable>
    </div>
  )
}
