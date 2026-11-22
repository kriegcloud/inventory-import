// Local change: React is imported by name, so the atoms lint reads this file (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
"use client"

import { type Column, type RowData, type SortDirection, type SortingState, Subscribe } from "@tanstack/react-table"
import { cn } from "cn"
import type { ComponentProps } from "react"

import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@inventory/ui/components/dropdown-menu"
import { ChevronDown, ChevronUp, ChevronsUpDown, EyeOff } from "lucide-react"

interface DataTableColumnHeaderProps<TData extends RowData, TValue> extends ComponentProps<typeof DropdownMenuTrigger> {
  column: Column<DataTableFeatures, TData, TValue>
  label?: string
  // Local addition: a second, quieter line under the label (the unit the values are in), and the label at the
  // trigger's end for a column of numbers, the sort mark before it, so the label lines up with its right-aligned values.
  unit?: string
  alignEnd?: boolean
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  label = column.columnDef.meta?.label ?? column.id,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return (
      // Local change: no native `title` (see below).
      <div className={cn("truncate", className)}>{label}</div>
    )
  }

  return (
    <Subscribe
      source={column.table.store}
      selector={(state) => ({
        isVisible: state.columnVisibility[column.id] !== false,
        sortDirection: getSortDirection(state.sorting, column.id)
      })}
    >
      {(headerState) => (
        <DataTableColumnHeaderMenu
          column={column}
          label={label}
          className={className}
          isVisible={headerState.isVisible}
          sortDirection={headerState.sortDirection}
          {...props}
        />
      )}
    </Subscribe>
  )
}

interface DataTableColumnHeaderMenuProps<TData extends RowData, TValue> extends DataTableColumnHeaderProps<
  TData,
  TValue
> {
  label: string
  isVisible: boolean
  sortDirection: SortDirection | "none"
}

function DataTableColumnHeaderMenu<TData extends RowData, TValue>({
  column,
  label,
  unit,
  alignEnd,
  className,
  isVisible,
  sortDirection,
  ...props
}: DataTableColumnHeaderMenuProps<TData, TValue>) {
  function onSortDirectionChange(direction: SortDirection) {
    if (sortDirection === direction) {
      column.clearSorting()
      return
    }

    column.table.setSorting((prev) => {
      const sort = { id: column.id, desc: direction === "desc" }
      if (!column.getCanMultiSort()) return [sort]
      return [sort, ...prev.filter((item) => item.id !== column.id)].slice(0, column.table.options.maxMultiSortColCount)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          // Local change: the trigger fills its header cell edge to edge (it was an inset pill, which left a strip of
          // the cell showing around it), and the focus ring is drawn inside the cell so the next cell does not cut it.
          "flex h-full min-h-9 w-full min-w-0 items-center justify-between gap-1.5 px-2 hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset data-[state=open]:bg-accent rtl:flex-row-reverse [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          className
        )}
        // Local change: no native `title`; a column that cuts its label shows it in the app's own tooltip instead.
        {...props}
      >
        {unit === undefined ? (
          <bdi className={cn("truncate", alignEnd === true && "order-last")}>{label}</bdi>
        ) : (
          <span
            className={cn(
              "flex min-w-0 flex-col leading-tight",
              alignEnd === true ? "order-last items-end" : "items-start"
            )}
          >
            <bdi className="truncate">{label}</bdi>
            <bdi className="truncate text-xs font-normal text-muted-foreground">{unit}</bdi>
          </span>
        )}
        {column.getCanSort() &&
          (sortDirection === "desc" ? <ChevronDown /> : sortDirection === "asc" ? <ChevronUp /> : <ChevronsUpDown />)}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        // Local change: under the cell with no gap, and never narrower than it.
        sideOffset={0}
        className="w-36 min-w-(--radix-dropdown-menu-trigger-width) data-closed:fill-mode-forwards"
      >
        {column.getCanSort() && (
          <>
            <DropdownMenuCheckboxItem
              className={menuItem}
              checked={sortDirection === "asc"}
              onClick={() => onSortDirectionChange("asc")}
            >
              <ChevronUp />
              Asc
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className={menuItem}
              checked={sortDirection === "desc"}
              onClick={() => onSortDirectionChange("desc")}
            >
              <ChevronDown />
              Desc
            </DropdownMenuCheckboxItem>
          </>
        )}
        {column.getCanHide() && (
          <DropdownMenuCheckboxItem
            className={menuItem}
            checked={!isVisible}
            onClick={() => column.toggleVisibility(false)}
          >
            <EyeOff />
            Hide
          </DropdownMenuCheckboxItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The mark's place (right) comes from the dropdown menu component; here only the icon's colour.
const menuItem = "[&_svg:not([class*='text-'])]:text-muted-foreground"

function getSortDirection(sorting: SortingState, columnId: string): SortDirection | "none" {
  const sort = sorting.find((sort) => sort.id === columnId)
  if (!sort) return "none"
  return sort.desc ? "desc" : "asc"
}
