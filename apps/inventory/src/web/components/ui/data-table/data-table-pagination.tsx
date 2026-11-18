"use client";

import type { ReactTable, RowData } from "@tanstack/react-table";

import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";

import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  getVisibleSelectedRows,
} from "@/components/ui/data-table/data-table-utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";

interface DataTablePaginationProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
}

export function DataTablePagination<TData extends RowData>({
  table,
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  return (
    <table.Subscribe
      selector={(state) => ({
        pageIndex: state.pagination.pageIndex,
        pageSize: state.pagination.pageSize,
        selectedRowCount: table.getSelectedRowIds().length,
        visibleSelectedRowCount: getVisibleSelectedRows(table).length,
      })}
    >
      {({ pageIndex, pageSize, selectedRowCount, visibleSelectedRowCount }) => (
        <DataTablePaginationContent
          table={table}
          pageIndex={pageIndex}
          pageSize={pageSize}
          selectedRowCount={selectedRowCount}
          visibleSelectedRowCount={visibleSelectedRowCount}
          pageSizeOptions={
            table.options.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS
          }
          className={className}
          {...props}
        />
      )}
    </table.Subscribe>
  );
}

interface DataTablePaginationContentProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  pageIndex: number;
  pageSize: number;
  selectedRowCount: number;
  visibleSelectedRowCount: number;
  pageSizeOptions: readonly number[];
}

function DataTablePaginationContent<TData extends RowData>({
  table,
  pageIndex,
  pageSize,
  selectedRowCount,
  visibleSelectedRowCount,
  pageSizeOptions,
  className,
  ...props
}: DataTablePaginationContentProps<TData>) {
  const pageSizeLabelId = React.useId();
  const sizeOptions = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);
  const pageCount = table.getPageCount();
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage();

  return (
    <div
      data-slot="data-table-pagination"
      className={cn(
        "flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8",
        className,
      )}
      {...props}
    >
      {/* Local change: a table whose rows cannot be selected does not say "0 rows selected". */}
      {table.options.enableRowSelection === false ? (
        <div className="flex-1" />
      ) : (
        <div
          role="status"
          className="flex-1 text-sm whitespace-nowrap text-muted-foreground"
        >
          {selectedRowCount.toLocaleString()}{" "}
          {selectedRowCount === 1 ? "row" : "rows"} selected
          {selectedRowCount > visibleSelectedRowCount
            ? ` (${(selectedRowCount - visibleSelectedRowCount).toLocaleString()} not shown)`
            : ""}
          .
        </div>
      )}
      {/* Local change: one row on a phone too (upstream stacks three), with the page size's label kept for a
          screen reader only there, so the list above keeps the height. */}
      <div className="flex flex-1 items-center justify-between gap-4 sm:flex-none sm:justify-start sm:gap-6 lg:gap-8">
        <div className="flex items-center gap-2">
          <p
            id={pageSizeLabelId}
            className="text-sm font-medium whitespace-nowrap max-sm:sr-only"
          >
            Rows per page
          </p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger aria-labelledby={pageSizeLabelId} className="w-18">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {sizeOptions.map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div
          role="status"
          className="flex items-center justify-center text-sm font-medium"
        >
          {/* Local change: a list with nothing in it is one empty page, not "Page 1 of 0". */}
          Page {pageIndex + 1} of {Math.max(1, pageCount)}
        </div>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Go to first page"
            variant="outline"
            size="icon"
            className="hidden lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!canPreviousPage}
          >
            <ChevronsLeft className="rtl:rotate-180" />
          </Button>
          <Button
            aria-label="Go to previous page"
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!canPreviousPage}
          >
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <Button
            aria-label="Go to next page"
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!canNextPage}
          >
            <ChevronRight className="rtl:rotate-180" />
          </Button>
          <Button
            aria-label="Go to last page"
            variant="outline"
            size="icon"
            className="hidden lg:flex"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!canNextPage}
          >
            <ChevronsRight className="rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}
