"use client";

import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/*
 * Local addition, beside upstream's `data-table-skeleton.tsx` (which also draws a toolbar and a paging bar): a data
 * table's frame while its rows are on their way, in the same boxes `DataTable` draws with `stickyHeader` (the
 * rounded border, the header row with the column names when the page knows them, rows of the table's height) and
 * with no code from the table itself, so a page whose code is still loading can show it. Nothing moves when the
 * rows arrive.
 */

/** A column of the frame: its heading when the page knows it, its width as the table has it, and its side. */
export type FrameColumn = { readonly label?: string; readonly width?: number; readonly align?: "right" };

/** One grey bar of a cell, in one of three widths so the rows do not look stamped; at the right in a number column. */
function Bar(props: { seed: number; right?: boolean | undefined }) {
  const n = props.seed % 3;
  const width = n === 0 ? "w-2/3" : n === 1 ? "w-1/2" : "w-4/5";
  return <Skeleton className={cn("h-3.5", width, props.right === true && "ml-auto")} />;
}

export function DataTableFrameSkeleton(props: {
  caption: string;
  columns: ReadonlyArray<FrameColumn>;
  rows?: number;
  className?: string;
}) {
  const rows = props.rows ?? 24;
  const minWidth = props.columns.reduce((total, column) => total + (column.width ?? 320), 0);
  return (
    <div
      role="status"
      aria-label={`${props.caption}, loading`}
      aria-busy="true"
      className={cn("flex min-h-0 flex-1 flex-col px-4 pb-3 sm:px-9", props.className)}
    >
      <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
        <Table className="table-fixed" style={{ minWidth }}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {props.columns.map((column, index) => (
                <TableHead
                  key={index}
                  style={column.width === undefined ? {} : { width: column.width }}
                  className={column.align === "right" ? "text-right" : undefined}
                >
                  {column.label ?? <Bar seed={index} right={column.align === "right"} />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody aria-hidden>
            {Array.from({ length: rows }, (_, row) => (
              <TableRow key={row} className="hover:bg-transparent">
                {props.columns.map((column, index) => (
                  <TableCell key={index} className="h-9">
                    <Bar seed={row + index} right={column.align === "right"} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
