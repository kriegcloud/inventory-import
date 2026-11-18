"use client";

import { FlexRender, type ReactTable, type RowData } from "@tanstack/react-table";
import * as React from "react";

import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";

/*
 * Local addition: the rows of a data table as cards, for a page as narrow as a phone. The same table instance as
 * `DataTable` (its sorting, filters and page), one card per row of the current page: the first visible column as the
 * card's heading, every other visible column as a labelled line (`meta.label`), so nothing is wider than the screen.
 * A cell the caller says is blank for its row (`blank`) is left out, as a card has no empty lines.
 */

interface DataTableCardsProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  /** What the cards hold, for the scroll region. */
  label: string;
  /** Shown in place of cards when the page has no rows. */
  empty: React.ReactNode;
  /** True when this row has nothing in this column: the card leaves the line out. */
  blank?: (columnId: string, row: TData) => boolean;
  /** Columns that are not lines of the card, such as a column of row buttons. */
  hide?: ReadonlyArray<string>;
  /** The row's own buttons, at the foot of its card in reach of a thumb. */
  actions?: (row: TData) => React.ReactNode;
}

export function DataTableCards<TData extends RowData>({
  table,
  label,
  empty,
  blank,
  hide = [],
  actions,
}: DataTableCardsProps<TData>) {
  return (
    <table.Subscribe
      selector={(state) => ({
        pagination: state.pagination,
        sorting: state.sorting,
        columnFilters: state.columnFilters,
        columnVisibility: state.columnVisibility,
      })}
    >
      {() => {
        const rows = table.getRowModel().rows;
        return (
          // `relative` keeps visually hidden text (absolutely placed) inside this scroller, not the page.
          <div
            role="region"
            aria-label={label}
            tabIndex={0}
            className="relative min-h-0 flex-1 overflow-y-auto border-y"
          >
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
            ) : (
              <ul className="flex flex-col">
                {rows.map((row) => {
                  const [first, ...rest] = row
                    .getVisibleCells()
                    .filter((cell) => !hide.includes(cell.column.id));
                  return (
                    <li key={row.id} className="flex flex-col gap-1 border-b px-4 py-3 sm:px-9">
                      {first === undefined ? null : (
                        <span className="font-semibold break-words">
                          <FlexRender cell={first} />
                        </span>
                      )}
                      <dl className="grid grid-cols-label-value items-center gap-x-3 gap-y-1 text-sm">
                        {rest
                          .filter((cell) => blank?.(cell.column.id, row.original) !== true)
                          .map((cell) => (
                            <div key={cell.id} className="contents">
                              <dt className="text-muted-foreground">
                                {cell.column.columnDef.meta?.label ?? cell.column.id}
                              </dt>
                              <dd className="min-w-0 break-words">
                                <FlexRender cell={cell} />
                              </dd>
                            </div>
                          ))}
                      </dl>
                      {actions === undefined ? null : (
                        <div className="flex flex-wrap gap-2 pt-1">{actions(row.original)}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      }}
    </table.Subscribe>
  );
}
