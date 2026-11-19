"use client"

import { type Column, type ReactTable, type RowData, Subscribe } from "@tanstack/react-table"
import { cn } from "cn"
import * as React from "react"

import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"

import {
  getColumnNumberOptions,
  getColumnSelectOptions,
  getFilterVariant,
  getIsNumberRangeColumn
} from "@inventory/ui/components/data-table/data-table-utils"
import type { DataTableDateFilter as DateFilter } from "@inventory/ui/components/data-table/data-table-date-filter"
import { DataTableFacetedFilter } from "@inventory/ui/components/data-table/data-table-faceted-filter"
import type { DataTableSliderFilter as SliderFilter } from "@inventory/ui/components/data-table/data-table-slider-filter"
import { DataTableViewOptions } from "@inventory/ui/components/data-table/data-table-view-options"
import { Button } from "@inventory/ui/components/button"
import { Input } from "@inventory/ui/components/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@inventory/ui/components/input-group"
import { CalendarIcon, PlusCircle, X } from "lucide-react"

// The date and range filters bring a calendar, a date library and a slider: more code than the rest of a table's
// page, for buttons few people press. They arrive after the table, each with a stand-in of the same size.
// Cast back to the generic components: React.lazy keeps the props but not the row type.
const DataTableDateFilter = React.lazy(() =>
  import("@inventory/ui/components/data-table/data-table-date-filter").then((module) => ({
    default: module.DataTableDateFilter
  }))
) as unknown as typeof DateFilter
const DataTableSliderFilter = React.lazy(() =>
  import("@inventory/ui/components/data-table/data-table-slider-filter").then((module) => ({
    default: module.DataTableSliderFilter
  }))
) as unknown as typeof SliderFilter

/** The filter's button as it looks with nothing chosen, until its code arrives. */
function FilterStandIn(props: { title: string; icon: React.ReactNode }) {
  return (
    <Button variant="outline" className="max-w-full shrink" disabled>
      {props.icon}
      <bdi className="truncate">{props.title}</bdi>
    </Button>
  )
}

const BOOLEAN_OPTIONS = [
  // Local change: "Yes" and "No", the words this app shows for these values everywhere else.
  { label: "Yes", value: "true" },
  { label: "No", value: "false" }
]

interface DataTableToolbarProps<TData extends RowData> extends React.ComponentProps<"div"> {
  table: ReactTable<DataTableFeatures, TData, unknown>
  globalFilterPlaceholder?: string
  /**
   * Local addition: the ids of the columns that get a control in the toolbar, in this order. Left out, every
   * column that can be filtered gets one, as upstream. With a filter menu beside the toolbar, the rest are
   * reached from there, and the toolbar holds only the few that are used all day.
   */
  quick?: readonly string[] | undefined
  /**
   * Local addition: the table's one search box, drawn first, alone at the left with Reset. With it, the quick
   * filters move to the right beside the menus, so the search reads first and the filters and actions after it.
   */
  search?: React.ReactNode
}

export function DataTableToolbar<TData extends RowData>({
  table,
  globalFilterPlaceholder,
  quick,
  search,
  children,
  className,
  ...props
}: DataTableToolbarProps<TData>) {
  const columns = React.useMemo(() => {
    const filterable = table.getAllLeafColumns().filter((column) => column.getCanFilter())
    if (quick === undefined) return filterable
    return quick.flatMap((id) => filterable.filter((column) => column.id === id))
  }, [table, quick])

  function onReset() {
    table.resetColumnFilters(true)
    table.resetJoinOperator()
    table.resetGlobalFilter(true)
  }

  return (
    <div
      data-slot="data-table-toolbar"
      className={cn("flex w-full flex-wrap items-start justify-between gap-2 p-1", className)}
      {...props}
    >
      <div className="flex min-w-[min(100%,24rem)] flex-1 flex-wrap items-center gap-2">
        {search}
        {globalFilterPlaceholder && table.options.enableGlobalFilter !== false ? (
          <Subscribe source={table.atoms.globalFilter} selector={(globalFilter) => readFilterInputValue(globalFilter)}>
            {(globalFilter) => (
              <Input
                aria-label={globalFilterPlaceholder}
                placeholder={globalFilterPlaceholder}
                value={globalFilter}
                onChange={(event) => table.setGlobalFilter(event.target.value)}
                className="w-40 grow text-ellipsis sm:grow-0 lg:w-56"
              />
            )}
          </Subscribe>
        ) : null}
        {search === undefined
          ? columns.map((column) => <DataTableToolbarFilter key={column.id} column={column} />)
          : null}
        <table.Subscribe selector={(state) => state.columnFilters.length > 0 || Boolean(state.globalFilter)}>
          {(isFiltered) =>
            isFiltered && (
              <Button aria-label="Reset filters" variant="outline" onClick={onReset}>
                <X />
                Reset
              </Button>
            )
          }
        </table.Subscribe>
      </div>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        {/* Local change: this group wraps, and with a search box at the left the quick filters sit here, before
            the menus. */}
        {search === undefined
          ? null
          : columns.map((column) => <DataTableToolbarFilter key={column.id} column={column} />)}
        {children}
        <DataTableViewOptions table={table} align="end" />
      </div>
    </div>
  )
}

interface DataTableToolbarFilterProps<TData extends RowData> {
  column: Column<DataTableFeatures, TData>
}

function DataTableToolbarFilter<TData extends RowData>({ column }: DataTableToolbarFilterProps<TData>) {
  const columnMeta = column.columnDef.meta
  if (!columnMeta?.variant) return null

  const title = columnMeta.label ?? column.id
  const placeholder = columnMeta.placeholder ?? columnMeta.label
  const filterVariant = getFilterVariant(columnMeta)

  switch (filterVariant) {
    case "text":
      return (
        <DataTableFilterInput
          column={column}
          placeholder={placeholder}
          className="w-40 grow text-ellipsis sm:grow-0 lg:w-56"
        />
      )

    case "number": {
      if (getIsNumberRangeColumn(column)) {
        return (
          <React.Suspense fallback={<FilterStandIn title={title} icon={<PlusCircle />} />}>
            <DataTableSliderFilter column={column} title={title} />
          </React.Suspense>
        )
      }

      return (
        <DataTableFilterInput
          column={column}
          type="number"
          inputMode="numeric"
          placeholder={placeholder}
          unit={getColumnNumberOptions(columnMeta)?.unit}
          className="w-30"
        />
      )
    }

    case "date":
      return (
        <React.Suspense fallback={<FilterStandIn title={title} icon={<CalendarIcon />} />}>
          <DataTableDateFilter column={column} title={title} multiple />
        </React.Suspense>
      )

    case "select":
      return (
        <DataTableFacetedFilter
          column={column}
          title={title}
          options={getColumnSelectOptions(columnMeta)}
          multiple={columnMeta.multiple ?? true}
        />
      )

    case "boolean":
      return <DataTableFacetedFilter column={column} title={title} options={BOOLEAN_OPTIONS} />

    default:
      return null
  }
}

interface DataTableFilterInputProps<TData extends RowData> extends React.ComponentProps<"input"> {
  column: Column<DataTableFeatures, TData>
  unit?: string | undefined
}

function DataTableFilterInput<TData extends RowData>({
  column,
  type = "text",
  unit,
  className,
  ...props
}: DataTableFilterInputProps<TData>) {
  return (
    <Subscribe source={column.table.atoms.columnFilters} selector={() => column.getFilterValue()}>
      {(filterValue) => {
        const inputProps = {
          type,
          ...props,
          value: readFilterInputValue(filterValue),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            column.setFilterValue(event.target.value || undefined)
        }

        if (!unit) return <Input {...inputProps} className={className} />

        return (
          <InputGroup className={className}>
            <InputGroupInput {...inputProps} />
            <InputGroupAddon align="inline-end">
              <InputGroupText>{unit}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        )
      }}
    </Subscribe>
  )
}

function readFilterInputValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.join(",")
  }

  return ""
}
