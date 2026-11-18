import { Subscribe, flexRender, type Row, type RowData, type Table } from "@tanstack/react-table"
import { HashSet } from "effect"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { DataGridFeatures } from "@/components/ui/data-grid/data-grid-features"

// A card leaves out empty cells (a Ready row has no reason); the grid shows them as blank cells.
const isEmpty = (value: unknown) => value === undefined || value === null || value === ""

/**
 * The phone layout of the review grid: each row as a short card, built from the same column definitions and the
 * same table instance as `DataGrid`, so selection, the action bar and proposals keep working. Shows the first
 * `pageSize` rows and a button for more, so a 5,000-row file stays fast on a phone.
 */
export function RowCards<TData extends RowData>(props: {
  table: Table<DataGridFeatures, TData>
  /** The column whose cell is the card title: the record's name. */
  titleColumnId: string
  /** Columns left out of the card body, for example a line number already in the title. */
  hideColumnIds?: ReadonlyArray<string>
  /** The row's own buttons, shown at the foot of the card in reach of a thumb. */
  actions?: (row: Row<DataGridFeatures, TData>) => ReactNode
  pageSize?: number
}) {
  const pageSize = props.pageSize ?? 50
  const [shown, setShown] = useState(pageSize)
  const hidden = HashSet.make("select", props.titleColumnId, ...(props.hideColumnIds ?? []))
  return (
    <Subscribe source={props.table.store} selector={(state) => state.rowSelection}>
      {() => {
        const rows = props.table.getRowModel().rows
        return (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y border-y">
              {rows.slice(0, shown).map((row) => {
                const cells = row.getVisibleCells()
                const title = cells.find((cell) => cell.column.id === props.titleColumnId)
                return (
                  <li key={row.id} className="flex cv-auto flex-col gap-2 py-3">
                    <div className="flex items-start gap-3">
                      {row.getCanSelect() ? (
                        <Checkbox
                          className="mt-0.5"
                          checked={row.getIsSelected()}
                          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
                          aria-label={`Select ${String(title?.getValue() ?? row.id)}`}
                        />
                      ) : null}
                      <div className="min-w-0 flex-1 text-sm">
                        {title === undefined ? null : flexRender(title.column.columnDef.cell, title.getContext())}
                      </div>
                    </div>
                    <dl className="grid grid-cols-field-value gap-x-3 gap-y-1 text-sm tabular-nums">
                      {cells
                        .filter((cell) => !HashSet.has(hidden, cell.column.id) && !isEmpty(cell.getValue()))
                        .map((cell) => (
                          <div key={cell.id} className="contents">
                            <dt className="text-muted-foreground">
                              {cell.column.columnDef.meta?.label ?? cell.column.id}
                            </dt>
                            <dd className="min-w-0 break-words">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </dd>
                          </div>
                        ))}
                    </dl>
                    {props.actions === undefined ? null : (
                      <div className="flex flex-wrap gap-2">{props.actions(row)}</div>
                    )}
                  </li>
                )
              })}
            </ul>
            {rows.length > shown ? (
              <Button variant="outline" className="self-start" onClick={() => setShown(shown + pageSize)}>
                Show {Math.min(pageSize, rows.length - shown)} more of {rows.length.toLocaleString()}
              </Button>
            ) : null}
          </div>
        )
      }}
    </Subscribe>
  )
}
