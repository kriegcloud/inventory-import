import { Option } from "effect"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createColumnHelper, type ReactTable } from "@tanstack/react-table"
import { ArrowDownUp, ListFilter } from "lucide-react"
import { type ComponentType, lazy, Suspense, useEffect, useMemo, useState } from "react"
import { Code } from "@inventory/ui/Code"
import { PageHeader } from "@inventory/ui/PageHeader"
import { NotSet } from "@inventory/ui/NotSet"
import { TableSkeleton } from "@inventory/ui/Skeletons"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import { Button } from "@inventory/ui/components/button"
import { DataTable } from "@inventory/ui/components/data-table/data-table"
import { DataTableCards } from "@inventory/ui/components/data-table/data-table-cards"
import { DataTableColumnHeader } from "@inventory/ui/components/data-table/data-table-column-header"
import { createDataTableConfig } from "@inventory/ui/components/data-table/data-table-config"
import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import { DataTablePagination } from "@inventory/ui/components/data-table/data-table-pagination"
import { DataTableToolbar } from "@inventory/ui/components/data-table/data-table-toolbar"
import { useDataTable } from "@inventory/ui/hooks/use-data-table"
import { useActor } from "@/lib/actor"
import { call } from "@/lib/api"
import { contentWidth, useIsNarrow } from "@inventory/ui/ContentWidth"
import { navigate, useLocation } from "@inventory/ui/Route"
import { hasRole } from "@inventory/kernel/Role"
import { discontinuedOn, isActive, type StoredItem } from "@inventory/catalog-contract/Item"
import { itemPageSizes } from "@inventory/catalog-contract/ItemQuery"
import { day, when } from "./import/format.tsx"
import { ItemEditor } from "./ItemEditor.tsx"
import { costOf, dimensionsText, vendorsText } from "./import/itemText.ts"
import { sayError } from "@inventory/client/SayError"
import { keptVisibility, TableAssistant } from "@/components/app/TableAssistant"
import { TableSearch } from "@inventory/ui/TableSearch"
import { queryKeys } from "@/lib/queries"
import { maxSearch, maxSearchWords, wordsLeftOut } from "@inventory/catalog-contract/ItemSearch"
import { type CatalogColumn, type ColumnCatalog, operatorsFor } from "@inventory/catalog-contract/TableView"
// The sort and filter menus carry a calendar, a date library and drag-and-drop for reordering: more code than the
// rest of the page. They are fetched after the table is drawn; until then each is its own button, the same size and
// words, switched off, so nothing moves when it arrives.
type MenuProps = { readonly table: ReactTable<DataTableFeatures, StoredItem, unknown>; readonly align: "end" }
const DataTableSortMenu = lazy(() =>
  import("@inventory/ui/components/data-table/data-table-sort-menu").then((module) => ({
    default: module.DataTableSortMenu as ComponentType<MenuProps>
  }))
)
const DataTableFilterMenu = lazy(() =>
  import("@inventory/ui/components/data-table/data-table-filter-menu").then((module) => ({
    default: module.DataTableFilterMenu as ComponentType<MenuProps>
  }))
)

/** The menus of the toolbar, with a stand-in for each while its code arrives. */
function TableMenus(props: { readonly table: ReactTable<DataTableFeatures, StoredItem, unknown> }) {
  return (
    <>
      <Suspense
        fallback={
          <Button variant="outline" disabled>
            <ArrowDownUp className="text-muted-foreground" />
            Sort
          </Button>
        }
      >
        <DataTableSortMenu table={props.table} align="end" />
      </Suspense>
      <Suspense
        fallback={
          <Button variant="outline" disabled>
            <ListFilter className="text-muted-foreground" />
            Filter
          </Button>
        }
      >
        <DataTableFilterMenu table={props.table} align="end" />
      </Suspense>
    </>
  )
}
const whole = new Intl.NumberFormat()

// Pixels, in the order the columns stand. The last number is the column's place in the queue to step aside when the
// page is short of room (lowest first); a column without one always shows.
const widths = {
  name: [200],
  sku: [104],
  category: [136],
  uom: [84],
  unitCost: [104],
  quantityOnHand: [136],
  reorderPoint: [116, 7],
  isActive: [76, 8],
  lotTracked: [100, 5],
  tags: [150, 3],
  firstReceivedOn: [124, 6],
  discontinuedOn: [124, 4],
  dimensions: [176, 2],
  vendors: [232, 9],
  createdAt: [180, 1]
} as const satisfies Record<string, readonly [number, number?]>
type ColumnId = keyof typeof widths
const columnIds = Object.keys(widths) as ReadonlyArray<ColumnId>
const editWidth = 48
/** The page's two gutters and the table's frame, beside the columns. */
const aroundTable = 74

/**
 * Which columns show when the table opens in `room` pixels: all of them when they fit, else the queue steps aside
 * one by one until the rest do, so the table opens without a sideways scroll. "View" brings any of them back.
 */
const fitting = (room: number): Partial<Record<ColumnId, boolean>> => {
  let needed = aroundTable + editWidth + columnIds.reduce((sum, id) => sum + widths[id][0], 0)
  const shown: Partial<Record<ColumnId, boolean>> = {}
  const queue = columnIds
    .filter((id) => widths[id].length === 2)
    .sort((a, b) => (widths[a][1] ?? 0) - (widths[b][1] ?? 0))
  for (const id of queue) {
    shown[id] = needed <= room
    if (needed > room) needed -= widths[id][0]
  }
  return shown
}

/**
 * What the Items table can be sorted and filtered by, and how its state reads in the address
 * (`?page=2&sort=...&category=...`). The ids are the server's (`src/domain/ItemQuery.ts`): a column listed here with a
 * `variant` can be filtered, and one with `enableSorting: false` gets no sort menu.
 */
const tableOptions = {
  columns: {
    name: { variant: "text" },
    sku: { variant: "text" },
    category: { variant: "select" },
    uom: { variant: "select" },
    unitCost: { variant: "number" },
    quantityOnHand: { variant: "number" },
    reorderPoint: {},
    isActive: { variant: "select", enableSorting: false },
    lotTracked: { variant: "select", enableSorting: false },
    tags: { enableSorting: false },
    firstReceivedOn: {},
    discontinuedOn: { enableSorting: false },
    dimensions: { enableSorting: false },
    vendors: { enableSorting: false },
    createdAt: {},
    edit: { enableSorting: false }
  },
  defaultPageSize: 20,
  pageSizeOptions: itemPageSizes,
  // The one search box: its words are in the address as `search`, like the filters.
  enableGlobalFilter: true
} as const
// The order the server gives when it is asked for none, said out loud so the SKU heading shows it.
const itemsTable = createDataTableConfig({ ...tableOptions, defaultSorting: [{ id: "sku", desc: false }] })
// While searching, no order chosen means best matches first: no heading claims an order the rows do not have.
const searchedTable = createDataTableConfig({ ...tableOptions, defaultSorting: [] })

// The list filters used all day sit in the toolbar, after the search box. Every column that can be filtered, with
// every comparison and "all of" or "any of", is in the Filter menu beside it: a search in one column (only the name,
// only the SKU) is a text filter there.
const quickFilters = ["category", "uom"] as const

const col = createColumnHelper<DataTableFeatures, StoredItem>()

// What the table assistant may use of this table: each column's heading, what it holds, and, for a list column, the
// values the organization has. The comparisons are the ones the server answers for that kind of column.
const catalogColumn = (
  id: string,
  label: string,
  type: CatalogColumn["type"] | null,
  options: { readonly sortable?: boolean; readonly hideable?: boolean; readonly values?: ReadonlyArray<string> } = {}
): CatalogColumn => ({
  id,
  label,
  type: type ?? "text",
  sortable: options.sortable ?? true,
  hideable: options.hideable ?? true,
  operators: type === null ? [] : operatorsFor[type],
  values: options.values ?? []
})
type Listed = ReadonlyArray<{ readonly value: string }> | undefined
const valuesOf = (listed: Listed) => (listed ?? []).map((entry) => entry.value).slice(0, 100)
const itemsCatalog = (facets: { readonly category: Listed; readonly uom: Listed } | undefined): ColumnCatalog => [
  catalogColumn("name", "Name", "text", { hideable: false }),
  catalogColumn("sku", "SKU", "text"),
  catalogColumn("category", "Category", "select", { values: valuesOf(facets?.category) }),
  catalogColumn("uom", "UoM", "select", { values: valuesOf(facets?.uom) }),
  catalogColumn("unitCost", "Unit cost", "number"),
  catalogColumn("quantityOnHand", "Qty on hand", "number"),
  catalogColumn("reorderPoint", "Reorder point", null),
  catalogColumn("isActive", "Active", null, { sortable: false }),
  catalogColumn("lotTracked", "Lot tracked", null, { sortable: false }),
  catalogColumn("tags", "Tags", null, { sortable: false }),
  catalogColumn("firstReceivedOn", "First received", null),
  catalogColumn("discontinuedOn", "Discontinued", null, { sortable: false }),
  catalogColumn("dimensions", "Dimensions", null, { sortable: false }),
  catalogColumn("vendors", "Vendors", null, { sortable: false }),
  catalogColumn("createdAt", "Added", null)
]

const labels: Record<ColumnId, string> = {
  name: "Name",
  sku: "SKU",
  category: "Category",
  uom: "UoM",
  unitCost: "Unit cost",
  quantityOnHand: "Qty on hand",
  reorderPoint: "Reorder point",
  isActive: "Active",
  lotTracked: "Lot tracked",
  tags: "Tags",
  firstReceivedOn: "First received",
  discontinuedOn: "Discontinued",
  dimensions: "Dimensions",
  vendors: "Vendors",
  createdAt: "Added"
}

const skeletonColumns = columnIds
  .filter((id) => widths[id].length === 1 || id === "reorderPoint" || id === "isActive" || id === "vendors")
  .map((id) => ({ id, label: labels[id], width: widths[id][0] }))

const none: ReadonlyArray<StoredItem> = []

const yesNo = (value: boolean) => (value ? "Yes" : "No")
/** A number of a range filter's ends, from the lowest and highest value there is. */
const range = (
  found: { readonly min: Option.Option<number>; readonly max: Option.Option<number> } | undefined
): { readonly min?: number; readonly max?: number } =>
  found === undefined
    ? {}
    : Option.match(found.min, {
        onNone: () => ({}),
        onSome: (min) => ({ min: Math.floor(min), max: Math.ceil(Option.getOrElse(found.max, () => min)) })
      })

/**
 * The items the organization has now, a page at a time. The server sorts and filters them (one question in the
 * address, one answer with a page of rows and the page count), so a long list is never sent whole to be sorted
 * here. Items are created by confirming an import.
 */
export function ItemsPage() {
  const narrow = useIsNarrow()
  const { actor } = useActor()
  const canImport = actor !== undefined && hasRole(actor.role, "editor")
  const { params } = useLocation()
  // The table writes its state into the address and the question for the server is read from the same address,
  // so the two cannot disagree.
  const address = params.toString()
  const searching = (params.get(itemsTable.urlKeys.search) ?? "").trim() !== ""
  const config = searching ? searchedTable : itemsTable
  const query = useMemo(() => config.parse(address), [config, address])
  const page = useQuery({
    queryKey: queryKeys.itemsPage({ ...query, search: query.globalFilter }),
    queryFn: () =>
      call((api) =>
        api.items.page({
          query: {
            page: query.page,
            perPage: query.perPage,
            sort: query.sorting,
            filters: query.filters,
            joinOperator: query.joinOperator,
            search: query.globalFilter
          }
        })
      ),
    // The rows on screen stay while the next page or the next filter is fetched: nothing blinks or jumps.
    placeholderData: keepPreviousData
  })
  const facets = useQuery({ queryKey: queryKeys.itemFacets, queryFn: () => call((api) => api.items.facets()) })

  // An address somebody typed or kept from before: a page size that is not offered goes back to the usual one,
  // and a page past the last goes to the last, instead of "Page 999 of 8" over an empty table.
  const pageCount = page.isPlaceholderData ? undefined : page.data?.pageCount
  useEffect(() => {
    const next = new URLSearchParams(window.location.search)
    const before = next.toString()
    if (!itemPageSizes.some((size) => size === query.perPage)) next.delete("perPage")
    if (pageCount !== undefined && query.page > Math.max(1, pageCount)) {
      if (pageCount <= 1) next.delete("page")
      else next.set("page", `${pageCount}`)
    }
    const after = next.toString()
    if (after !== before) navigate(`${window.location.pathname}${after === "" ? "" : `?${after}`}`, { replace: true })
  }, [query.perPage, query.page, pageCount])

  const found = facets.data
  const columns = useMemo(() => {
    // An editor can change an item, from the pencil at the end of its row. A changed item stays if the import
    // that created it is taken back.
    const edit = canImport
      ? [
          col.display({
            id: "edit",
            header: () => <span className="sr-only">Edit</span>,
            cell: ({ row }) => <ItemEditor item={row.original} trigger="icon" />,
            meta: { label: "Edit" },
            enableHiding: false,
            size: editWidth
          })
        ]
      : []
    const options = (listed: ReadonlyArray<{ readonly value: string; readonly count: number }> | undefined) =>
      (listed ?? []).map((entry) => ({ label: entry.value, value: entry.value, count: entry.count }))
    // A flag is stored as "true" or "false" and read as Yes or No, as its cells say.
    const flagOptions = (listed: ReadonlyArray<{ readonly value: string; readonly count: number }> | undefined) =>
      (listed ?? []).map((entry) => ({
        label: entry.value === "true" ? "Yes" : "No",
        value: entry.value,
        count: entry.count
      }))
    return col.columns([
      col.accessor("name", {
        id: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} />,
        // A long name ends in an ellipsis, with the whole name on hover, instead of being cut by the next column.
        cell: ({ row }) => (
          <span className="block truncate font-semibold" title={row.original.name}>
            {row.original.name}
          </span>
        ),
        meta: { label: labels.name },
        enableHiding: false,
        size: widths.name[0]
      }),
      col.accessor("sku", {
        id: "sku",
        header: ({ column }) => <DataTableColumnHeader column={column} />,
        cell: ({ row }) => <Code>{row.original.sku}</Code>,
        meta: { label: labels.sku },
        size: widths.sku[0]
      }),
      col.accessor("category", {
        id: "category",
        header: ({ column }) => <DataTableColumnHeader column={column} />,
        meta: { label: labels.category, options: options(found?.category) },
        size: widths.category[0]
      }),
      col.accessor("uom", {
        id: "uom",
        header: ({ column }) => <DataTableColumnHeader column={column} />,
        meta: { label: labels.uom, options: options(found?.uom) },
        size: widths.uom[0]
      }),
      col.accessor("unitCost", {
        id: "unitCost",
        header: ({ column }) => <DataTableColumnHeader column={column} className="justify-end" />,
        cell: ({ row }) => <div className="text-right tabular-nums">{costOf(row.original.unitCost)}</div>,
        // A range in whole dollars, wide enough to hold the lowest and the highest cost there is.
        meta: { label: labels.unitCost, ...range(found?.unitCost) },
        size: widths.unitCost[0]
      }),
      col.accessor("quantityOnHand", {
        id: "quantityOnHand",
        header: ({ column }) => <DataTableColumnHeader column={column} className="justify-end" />,
        // The quantity carries its unit of measure: "3,911 BX".
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {whole.format(row.original.quantityOnHand)} {row.original.uom}
          </div>
        ),
        meta: { label: labels.quantityOnHand, ...range(found?.quantityOnHand) },
        size: widths.quantityOnHand[0]
      }),
      col.accessor("reorderPoint", {
        id: "reorderPoint",
        header: ({ column }) => <DataTableColumnHeader column={column} className="justify-end" />,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {Option.match(row.original.reorderPoint, {
              onNone: () => <NotSet />,
              onSome: (point) => <>{`${whole.format(point)} ${row.original.uom}`}</>
            })}
          </div>
        ),
        meta: { label: labels.reorderPoint },
        size: widths.reorderPoint[0]
      }),
      col.accessor((item) => isActive(item.stocking), {
        id: "isActive",
        header: labels.isActive,
        cell: ({ row }) => yesNo(isActive(row.original.stocking)),
        meta: { label: labels.isActive, options: flagOptions(found?.isActive) },
        size: widths.isActive[0]
      }),
      col.accessor("lotTracked", {
        id: "lotTracked",
        header: labels.lotTracked,
        cell: ({ row }) => yesNo(row.original.lotTracked),
        meta: { label: labels.lotTracked, options: flagOptions(found?.lotTracked) },
        size: widths.lotTracked[0]
      }),
      col.accessor((item) => item.tags.join(", "), {
        id: "tags",
        header: labels.tags,
        cell: ({ row }) =>
          row.original.tags.length === 0 ? (
            <NotSet />
          ) : (
            <span className="block truncate" title={row.original.tags.join(", ")}>
              {row.original.tags.join(", ")}
            </span>
          ),
        meta: { label: labels.tags },
        size: widths.tags[0]
      }),
      col.accessor("firstReceivedOn", {
        id: "firstReceivedOn",
        header: ({ column }) => <DataTableColumnHeader column={column} />,
        cell: ({ row }) =>
          Option.match(row.original.firstReceivedOn, {
            onNone: () => <NotSet />,
            onSome: (day) => <span className="tabular-nums">{day}</span>
          }),
        meta: { label: labels.firstReceivedOn },
        size: widths.firstReceivedOn[0]
      }),
      col.accessor((item) => Option.getOrElse(discontinuedOn(item.stocking), () => ""), {
        id: "discontinuedOn",
        header: labels.discontinuedOn,
        cell: ({ row }) =>
          Option.match(discontinuedOn(row.original.stocking), {
            onNone: () => <NotSet />,
            onSome: (day) => <span className="tabular-nums">{day}</span>
          }),
        meta: { label: labels.discontinuedOn },
        size: widths.discontinuedOn[0]
      }),
      col.accessor((item) => Option.match(item.dimensions, { onNone: () => "", onSome: dimensionsText }), {
        id: "dimensions",
        header: labels.dimensions,
        cell: ({ row }) =>
          Option.match(row.original.dimensions, {
            onNone: () => <NotSet />,
            onSome: (size) => <span className="tabular-nums">{dimensionsText(size)}</span>
          }),
        meta: { label: labels.dimensions },
        size: widths.dimensions[0]
      }),
      col.accessor((item) => item.vendors.length, {
        id: "vendors",
        header: labels.vendors,
        // How many, and the preferred one by name; every vendor with its cost and lead time is in the editor.
        cell: ({ row }) => {
          const vendors = row.original.vendors.map((vendor) => ({
            name: vendor.vendorName,
            preferred: vendor.isPreferred
          }))
          if (vendors.length === 0) return <NotSet />
          return (
            <span className="block truncate" title={vendors.map((vendor) => vendor.name).join(", ")}>
              {vendorsText(vendors)}
            </span>
          )
        },
        meta: { label: labels.vendors },
        size: widths.vendors[0]
      }),
      col.accessor("createdAt", {
        id: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} />,
        cell: ({ row }) => (
          <span title={`${when(row.original.createdAt)} · ${row.original.createdBy}`}>
            {day(row.original.createdAt)} · {row.original.createdBy}
          </span>
        ),
        meta: { label: labels.createdAt },
        size: widths.createdAt[0]
      }),
      ...edit
    ])
  }, [found, canImport])

  const rows = page.data?.data ?? none
  // The columns shown at first are the ones the page has room for (`fitting`). On a phone the rows are cards, one
  // line a value: there is room for all of them.
  const [fits] = useState(() => (narrow ? {} : fitting(contentWidth())))
  // Columns the assistant hid or showed come back after a refresh; the address keeps the sort and the filters.
  const [kept] = useState(() => keptVisibility("Items", actor?.organizationId, actor?.id))
  const catalog = useMemo(() => itemsCatalog(found), [found])
  const { table } = useDataTable({
    data: rows as Array<StoredItem>,
    columns,
    config,
    pageCount: page.data?.pageCount ?? 0,
    urlState: true,
    initialState: { columnVisibility: { ...fits, ...kept } },
    // Items are read here, never acted on in bulk: no row can be selected.
    enableRowSelection: false,
    getRowId: (item) => item.id
  })

  const total = page.data?.total
  const all = found?.total
  const searched = query.globalFilter
  const leftOut = wordsLeftOut(searched)
  // While searching with no order chosen, the line says how the rows are ordered: no heading shows it.
  const order = searching && query.sorting.length === 0 ? ", best matches first" : ""
  const counted =
    all !== undefined && total !== undefined && total !== all
      ? `${whole.format(total)} of ${whole.format(all)} items`
      : `${whole.format(total ?? 0)} ${total === 1 ? "item" : "items"}`
  const line =
    total === undefined
      ? page.error === null
        ? ("loading" as const)
        : undefined
      : `${counted}${total > 0 ? order : ""}${leftOut > 0 ? `; searched by the first ${maxSearchWords} words` : ""}`

  const clearSearch = () => table.setGlobalFilter("")
  const filtered = query.filters.length > 0
  // The table stays with its header; one row says what found nothing and offers the way back.
  const empty = searching ? (
    <span>
      No items match “{searched}”{filtered ? " with these filters" : ""}.{" "}
      <Button variant="link" size="sm" onClick={clearSearch}>
        Clear the search
      </Button>
    </span>
  ) : (
    "No items match these filters."
  )
  const toolbar = (
    <DataTableToolbar
      table={table}
      quick={quickFilters}
      search={
        <TableSearch
          value={searched}
          onSearch={(text) => table.setGlobalFilter(text)}
          placeholder="Search items"
          working={page.isFetching && page.isPlaceholderData}
          maxLength={maxSearch}
          shortcutHint={!narrow}
          className={narrow ? "w-auto min-w-0 flex-1" : "w-80"}
        />
      }
    >
      <TableMenus table={table} />
      <TableAssistant
        table={table}
        name="Items"
        columns={catalog}
        searchable
        opened={{ sorting: [], filters: [], visibility: fits, search: "" }}
      />
    </DataTableToolbar>
  )
  // A card has no empty lines: a value the item does not have is left off it.
  const blank = (columnId: string, item: StoredItem) =>
    (columnId === "reorderPoint" && Option.isNone(item.reorderPoint)) ||
    (columnId === "tags" && item.tags.length === 0) ||
    (columnId === "firstReceivedOn" && Option.isNone(item.firstReceivedOn)) ||
    (columnId === "discontinuedOn" && Option.isNone(discontinuedOn(item.stocking))) ||
    (columnId === "dimensions" && Option.isNone(item.dimensions)) ||
    (columnId === "vendors" && item.vendors.length === 0)

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Items"
        line={line}
        // A viewer cannot import: the button would lead to a screen that says so.
        {...(canImport ? { actions: <Button onClick={() => navigate("/")}>Import a file</Button> } : {})}
      />
      {page.error !== null ? (
        <div className="px-4 sm:px-9">
          <Alert variant="destructive">
            <AlertTitle>The items could not be loaded</AlertTitle>
            <AlertDescription>
              {sayError(page.error).sentence}
              <Button variant="outline" size="sm" onClick={() => void page.refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : page.data === undefined ? (
        <TableSkeleton caption="Items" columns={skeletonColumns} />
      ) : all === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-9">
          {canImport ? "No items yet. Import a file to create them." : "No items yet. An editor imports them."}
        </p>
      ) : narrow ? (
        // As narrow as a phone: the same page of rows as cards, with the table's own search and filters above and
        // its paging under them, so nothing is wider than the screen. Cards have no headings to sort by, so on a
        // phone the Sort menu is the way to order them.
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-3 pb-2">{toolbar}</div>
          <DataTableCards
            table={table}
            label="Items"
            empty={empty}
            blank={blank}
            hide={["edit"]}
            {...(canImport ? { actions: (item: StoredItem) => <ItemEditor item={item} trigger="button" /> } : {})}
          />
          <div className="px-4 py-2">
            <DataTablePagination table={table} />
          </div>
        </div>
      ) : (
        // The gutters are the page's; the table fills what is left and scrolls inside its own frame.
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 sm:px-9">
          <DataTable table={table} stickyHeader aria-label="Items" className="min-h-0 flex-1" empty={empty}>
            {toolbar}
          </DataTable>
        </div>
      )}
    </div>
  )
}
