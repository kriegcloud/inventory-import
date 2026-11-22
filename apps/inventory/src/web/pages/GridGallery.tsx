import { useAtom } from "@effect/atom-react"
import { createColumnHelper } from "@tanstack/react-table"
import * as A from "effect/Array"
import * as R from "effect/Record"
import * as Atom from "effect/reactivity/Atom"
import { DataGrid } from "@inventory/ui/components/data-grid/data-grid"
import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import { useDataGrid } from "@inventory/ui/components/data-grid/use-data-grid"

// Development only, at /gallery/grid: the data grid with each editor that takes typing (text, number, url, long text),
// once as a plain column and once as a column with its own `cell`, which shows that cell until the person edits.
// `bun run grid:keys` (scripts/grid-keys.mjs) types on every one of them in a real browser and reads what the grid
// stored from the list under it. No screen uses the grid today; this page is what holds its typing to what is typed.

/** One row: the same four values twice, the second set for the columns with their own `cell`. */
interface GridRow {
  readonly id: string
  readonly text: string
  readonly number: number | null
  readonly url: string
  readonly long: string
  readonly textShown: string
  readonly numberShown: number | null
  readonly urlShown: string
  readonly longShown: string
}

const row = (id: string): GridRow => ({
  id,
  text: "ab",
  number: 12,
  url: "https://a.example",
  long: "ab",
  textShown: "ab",
  numberShown: 12,
  urlShown: "https://a.example",
  longShown: "ab"
})

const rows = Atom.make<ReadonlyArray<GridRow>>(A.map(["r1", "r2", "r3", "r4", "r5", "r6"], row))

const col = createColumnHelper<DataGridFeatures, GridRow>()

/** What a column with its own `cell` shows while nobody edits it. */
const shown = (value: unknown) => <span data-shown>{`${String(value)} (shown)`}</span>

const columns = col.columns([
  col.accessor("text", { id: "text", header: "Text", meta: { label: "Text", variant: "text" } }),
  col.accessor("number", { id: "number", header: "Number", meta: { label: "Number", variant: "number" } }),
  col.accessor("url", { id: "url", header: "Url", meta: { label: "Url", variant: "url" } }),
  col.accessor("long", { id: "long", header: "Long text", meta: { label: "Long text", variant: "long-text" } }),
  col.accessor("textShown", {
    id: "textShown",
    header: "Text, own cell",
    meta: { label: "Text, own cell", variant: "text" },
    cell: ({ row: { original } }) => shown(original.textShown)
  }),
  col.accessor("numberShown", {
    id: "numberShown",
    header: "Number, own cell",
    meta: { label: "Number, own cell", variant: "number" },
    cell: ({ row: { original } }) => shown(original.numberShown)
  }),
  col.accessor("urlShown", {
    id: "urlShown",
    header: "Url, own cell",
    meta: { label: "Url, own cell", variant: "url" },
    cell: ({ row: { original } }) => shown(original.urlShown)
  }),
  col.accessor("longShown", {
    id: "longShown",
    header: "Long text, own cell",
    meta: { label: "Long text, own cell", variant: "long-text" },
    cell: ({ row: { original } }) => shown(original.longShown)
  })
])

const rowId = (each: GridRow) => each.id

/** The grid, and under it every value it holds, each as its type and its text in quotes. */
export default function GridGallery() {
  const [data, setData] = useAtom(rows)
  const { table, ...grid } = useDataGrid({
    data: A.copy(data),
    columns,
    getRowId: rowId,
    onDataChange: setData
  })
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Data grid: typing on a cell</h1>
      <DataGrid {...grid} table={table} height={320} />
      <ul className="grid grid-cols-4 gap-1 font-mono text-xs">
        {A.flatMap(data, (each) =>
          A.map(
            A.filter(R.toEntries(each), ([key]) => key !== "id"),
            ([key, value]) => (
              <li key={`${each.id}.${key}`} data-stored={`${each.id}.${key}`}>
                {`${each.id}.${key} ${typeof value} "${String(value)}"`}
              </li>
            )
          )
        )}
      </ul>
    </main>
  )
}
