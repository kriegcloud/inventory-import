"use client";

import { createColumnHelper, type RowData } from "@tanstack/react-table";
import * as React from "react";

import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableCards } from "@/components/ui/data-table/data-table-cards";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { createDataTableConfig } from "@/components/ui/data-table/data-table-config";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import type { DataTableColumnConfig } from "@/components/ui/data-table/data-table-types";
import { useDataTable } from "@/hooks/use-data-table";
import { useContentWidth, useIsNarrow } from "@/lib/content-width";

/*
 * Local addition: a list of records the page already holds, as tablecn's data table. Every column can be sorted
 * from its heading when it gives a `sort` value, the rows come a page at a time, the first column stays in view when
 * the table scrolls sideways, and on a page as narrow as a phone the same table is a list of cards with the same
 * paging. For a list the server pages, sorts and filters (the Items page), build the table with `useDataTable` in
 * server mode instead; its cards are `DataTableCards`.
 */

/** One column of a record table. The first column is the record's name: the card's heading on a phone. */
export type RecordColumn<Row> = {
  id: string;
  label: string;
  /** Pixels. Leave it out on one column to give it the space that is left. */
  width?: number;
  align?: "right";
  cell: (row: Row) => React.ReactNode;
  /** Shown on hover. Left out, a cell that is plain text shows its own text: the column may be too narrow for it. */
  title?: (row: Row) => string;
  /** True when this row has nothing in this column: a phone card then leaves the line out. */
  blank?: (row: Row) => boolean;
  /** What the column sorts by. Left out, the heading is a plain label. */
  sort?: (row: Row) => string | number;
};

const pageSizes = [25, 50, 100, 200] as const;

// The page's gutters on a desk (sm:px-9) and the frame's border: what the table's columns cannot use of the page.
const chrome = 36 * 2 + 2;
// The least a column without a width gets when the others take the room: a sentence still shows a few words.
const leastFlexible = 160;

export function RecordsTable<Row extends RowData>(props: {
  /** What the table holds, for the scroll region and the screen reader ("Items in the system"). */
  caption: string;
  columns: ReadonlyArray<RecordColumn<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row) => string;
  /** Shown in place of rows when there are none. */
  empty: React.ReactNode;
}) {
  const narrow = useIsNarrow();
  const room = useContentWidth();
  const { columns } = props;
  // The column without a width takes the room the others leave, as a table's free column does, never less than
  // `leastFlexible`: only then does the table scroll sideways inside its frame.
  const fixed = columns.reduce((total, column) => total + (column.width ?? 0), 0);
  const flexible = Math.max(leastFlexible, room - chrome - fixed);
  // The table's config follows the columns' ids and which of them sort, not the array itself: a page that builds its
  // columns on every render (their cells close over its state) keeps its sorting and its page.
  const shape = columns.map((column) => `${column.id}${column.sort === undefined ? "" : ":sort"}`).join("|");
  const config = React.useMemo(
    () =>
      createDataTableConfig({
        columns: Object.fromEntries(
          shape.split("|").map((entry): [string, DataTableColumnConfig] => {
            const [id = "", sorts] = entry.split(":");
            return [id, sorts === undefined ? { enableSorting: false } : {}];
          }),
        ),
        defaultPageSize: pageSizes[1],
        pageSizeOptions: pageSizes,
        enableGlobalFilter: false,
      }),
    [shape],
  );
  const tableColumns = React.useMemo(() => {
    const col = createColumnHelper<DataTableFeatures, Row>();
    return col.columns(
      columns.map((column) =>
        col.accessor((row) => column.sort?.(row) ?? "", {
          id: column.id,
          header: ({ column: header }) => (
            <DataTableColumnHeader
              column={header}
              className={column.align === "right" ? "justify-end" : undefined}
            />
          ),
          cell: ({ row }) => {
            const content = column.cell(row.original);
            const hover = column.title?.(row.original) ?? (typeof content === "string" ? content : undefined);
            // The record's name, first, in semibold; numbers at the right in tabular figures.
            const face =
              column.align === "right"
                ? "block truncate text-right tabular-nums"
                : column.id === columns[0]?.id
                  ? "block truncate font-semibold"
                  : "block truncate";
            return (
              <span className={face} title={hover}>
                {content}
              </span>
            );
          },
          meta: { label: column.label },
          enableHiding: false,
          size: column.width ?? flexible,
        }),
      ),
    );
  }, [columns, flexible]);
  const first = columns[0]?.id;
  const { table } = useDataTable({
    mode: "client",
    data: props.rows as Array<Row>,
    columns: tableColumns,
    config,
    getRowId: props.rowKey,
    enableRowSelection: false,
    initialState: { columnPinning: { start: first === undefined ? [] : [first], end: [] } },
  });

  if (narrow) {
    const blanks = new Map(columns.map((column) => [column.id, column.blank]));
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DataTableCards
          table={table}
          label={props.caption}
          empty={props.empty}
          blank={(columnId, row) => blanks.get(columnId)?.(row) === true}
        />
        {props.rows.length > pageSizes[0] ? (
          <div className="px-4 py-2">
            <DataTablePagination table={table} />
          </div>
        ) : null}
      </div>
    );
  }
  // The gutters are the page's; the table fills what is left and scrolls inside its own frame.
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 sm:px-9">
      <DataTable
        table={table}
        stickyHeader
        aria-label={props.caption}
        className="min-h-0 flex-1"
        empty={props.empty}
        withPagination={props.rows.length > pageSizes[0]}
      />
    </div>
  );
}
