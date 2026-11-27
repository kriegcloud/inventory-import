// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// The menu's handlers were `useCallback`s that nothing compares by identity (they go to Radix's menu items), so they
// are plain functions; the trigger's style was a memo, and is a plain object.
"use client"

import { type ReactTable, type RowData, Subscribe } from "@tanstack/react-table"
import { type CSSProperties, memo, type RefObject } from "react"
import { toast } from "sonner"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import type { ContextMenuState } from "@inventory/ui/components/data-grid/data-grid-types"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@inventory/ui/components/dropdown-menu"
import { CopyIcon, ScissorsIcon, EraserIcon, Trash2Icon } from "lucide-react"

interface DataGridContextMenuProps<TData extends RowData> {
  table: ReactTable<DataGridFeatures, TData, unknown>
  dataGridRef: RefObject<HTMLDivElement | null>
}

export function DataGridContextMenu<TData extends RowData>(props: DataGridContextMenuProps<TData>) {
  return (
    <Subscribe source={props.table.atoms.contextMenu}>
      {(contextMenu) => (contextMenu.open ? <ContextMenu {...props} contextMenu={contextMenu} /> : null)}
    </Subscribe>
  )
}

interface ContextMenuProps<TData extends RowData> extends DataGridContextMenuProps<TData> {
  contextMenu: ContextMenuState
}

const ContextMenu = memo(ContextMenuImpl, (prev, next) => {
  if (prev.contextMenu.open !== next.contextMenu.open) return false
  if (!next.contextMenu.open) return true
  return prev.contextMenu.x === next.contextMenu.x && prev.contextMenu.y === next.contextMenu.y
}) as typeof ContextMenuImpl

function ContextMenuImpl<TData extends RowData>({ table, dataGridRef, contextMenu }: ContextMenuProps<TData>) {
  const readOnly = table.getIsReadOnly()
  const canDeleteRows = !readOnly && !!table.options.enableRowDeletion

  const triggerStyle: CSSProperties = {
    position: "fixed",
    left: `${contextMenu.x}px`,
    top: `${contextMenu.y}px`,
    width: "1px",
    height: "1px",
    padding: 0,
    margin: 0,
    border: "none",
    background: "transparent",
    pointerEvents: "none",
    opacity: 0
  }

  function onCloseAutoFocus(event: Event) {
    event.preventDefault()
    const focusedCell = table.getFocusedCell()
    if (focusedCell && table.options.onCellFocus) {
      table.options.onCellFocus({
        rowId: focusedCell.row.id,
        columnId: focusedCell.column.id
      })
      return
    }
    dataGridRef.current?.focus()
  }

  function onOpenChange(open: boolean) {
    if (!open) table.closeContextMenu()
  }

  function onCopy() {
    void table.copySelectedCells()
  }

  function onCut() {
    void table.cutSelectedCells()
  }

  function onClear() {
    const cells = table.getSelectedCells()
    if (cells.length === 0) return

    table.clearCells(cells)

    toast.success(`${cells.length} cell${cells.length !== 1 ? "s" : ""} cleared`)
  }

  function onDelete() {
    const rowIds = new Set(table.getSelectedCells().map((cell) => cell.rowId))
    if (rowIds.size === 0) return

    table.deleteRows(Array.from(rowIds))

    toast.success(`${rowIds.size} row${rowIds.size !== 1 ? "s" : ""} deleted`)
  }

  return (
    <DropdownMenu open={contextMenu.open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger style={triggerStyle} />
      <DropdownMenuContent data-grid-popover="" align="start" className="w-48" onCloseAutoFocus={onCloseAutoFocus}>
        <DropdownMenuItem onSelect={onCopy}>
          <CopyIcon />
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCut} disabled={readOnly}>
          <ScissorsIcon />
          Cut
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onClear} disabled={readOnly}>
          <EraserIcon />
          Clear
        </DropdownMenuItem>
        {canDeleteRows && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2Icon />
              Delete rows
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
