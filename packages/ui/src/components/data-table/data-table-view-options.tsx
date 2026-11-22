// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
"use client"

import { type ReactTable, type RowData, Subscribe } from "@tanstack/react-table"
import { cn } from "cn"
import type { ComponentProps } from "react"

import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"

import { Button } from "@inventory/ui/components/button"
import { useDirection } from "@inventory/ui/components/direction"
import {
  Faceted,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedItemIndicator,
  FacetedList,
  FacetedTrigger
} from "@inventory/ui/components/faceted"
import { Settings2 } from "lucide-react"

interface DataTableViewOptionsProps<TData extends RowData> extends ComponentProps<typeof FacetedContent> {
  table: ReactTable<DataTableFeatures, TData, unknown>
  disabled?: boolean
}

export function DataTableViewOptions<TData extends RowData>({
  table,
  disabled,
  className,
  ...props
}: DataTableViewOptionsProps<TData>) {
  const dir = useDirection()
  // Worked out in each draw: the table handed in is a new object in each draw of its owner, so upstream's memo on it
  // never kept anything.
  const columns = table.getAllLeafColumns().filter((column) => column.accessorFn !== undefined && column.getCanHide())

  return (
    <Subscribe source={table.atoms.columnVisibility}>
      {(columnVisibility) => (
        <Faceted
          multiple
          value={columns.filter((column) => columnVisibility[column.id] !== false).map((column) => column.id)}
        >
          <FacetedTrigger asChild>
            <Button aria-label="View columns" variant="outline" className="ms-auto" disabled={disabled}>
              <Settings2 className="text-muted-foreground" />
              View
            </Button>
          </FacetedTrigger>
          <FacetedContent aria-label="Columns" dir={dir} align="center" className={cn("w-44", className)} {...props}>
            <FacetedInput placeholder="Search columns..." />
            <FacetedList>
              <FacetedEmpty>No columns found.</FacetedEmpty>
              <FacetedGroup>
                {columns.map((column) => (
                  <FacetedItem key={column.id} value={column.id} onSelect={() => column.toggleVisibility()}>
                    <bdi className="truncate">{column.columnDef.meta?.label ?? column.id}</bdi>
                    <FacetedItemIndicator />
                  </FacetedItem>
                ))}
              </FacetedGroup>
            </FacetedList>
          </FacetedContent>
        </Faceted>
      )}
    </Subscribe>
  )
}
