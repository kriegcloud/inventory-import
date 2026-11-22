"use client"

import type { Cell, RowData } from "@tanstack/react-table"

import { cn } from "cn"
import { useComposedRefs } from "radix-ui/internal"
import * as React from "react"
// Local change: `flushSync`, for `typesInPlace` below.
import { flushSync } from "react-dom"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import type { DataGridCellProps, StopEditingOptions } from "@inventory/ui/components/data-grid/data-grid-types"

// Local change: `getHasCustomCell` and `getIsEditableTarget`, for `typesInPlace` below.
import {
  CELL_TINTS,
  getCellFocusTarget,
  getCellLayoutStyle,
  getHasCustomCell,
  getIsEditableTarget
} from "@inventory/ui/components/data-grid/data-grid-utils"

interface DataGridCellElementProps<TData extends RowData>
  extends DataGridCellProps<TData>, React.ComponentProps<"div"> {
  onCommit?: (options?: StopEditingOptions) => void
  onCancel?: () => void
  commitOnEnter?: boolean
}

export function DataGridCell<TData extends RowData>({
  cell,
  columnIndex,
  isEditing,
  isFocused,
  isSelected,
  isSearchMatch,
  isActiveSearchMatch,
  presence,
  readOnly,
  rowHeight,
  width,
  pinned,
  pinnedOffset,
  grow,
  showStartBorder,
  showEndBorder,
  onCommit,
  onCancel,
  onKeyDown: onKeyDownProp,
  commitOnEnter = false,
  className,
  style,
  ref,
  ...props
}: DataGridCellElementProps<TData>) {
  const rowId = cell.row.id
  const columnId = cell.column.id
  const cellRef = React.useRef<HTMLDivElement>(null)
  // Local change: whether the editor this column opens takes typing (text, number, url, long text), so the browser can
  // type the key that opens it. It is read from the column, not passed by the editor: a column with a variant and its
  // own `cell` is drawn by this wrapper alone until the person edits, and its editor mounts only then.
  const variant = cell.column.columnDef.meta?.variant ?? "text"
  // A column that writes its own cell (`meta.writeCell`) opens no editor, so its key is prevented as upstream did.
  const typesInPlace =
    !cell.column.columnDef.meta?.writeCell &&
    !getHasCustomCell(cell.column) &&
    (variant === "text" || variant === "number" || variant === "url" || variant === "long-text")
  const composedRef = useComposedRefs(ref, cellRef)

  React.useLayoutEffect(() => {
    if (!isFocused || isEditing) return
    const element = cellRef.current
    const grid = element?.closest('[role="grid"]')
    const active = document.activeElement
    if (!element || !grid || element.contains(active)) return
    const isPageFocused = !active || active === document.body
    const activeGrid = active?.closest('[data-slot="data-grid-cell"]')?.closest('[role="grid"]')
    if (!isPageFocused && active !== grid && activeGrid !== grid) return
    getCellFocusTarget(element).focus({ preventScroll: true })
  }, [isFocused, isEditing])

  const isSelectionTinted = isSelected && !isEditing
  const isTinted = isSelectionTinted || isSearchMatch || isActiveSearchMatch

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const wasPrevented = event.defaultPrevented
      onKeyDownProp?.(event)
      if (!wasPrevented && event.defaultPrevented) return

      if (isEditing) {
        const commit = (options?: StopEditingOptions) => {
          event.preventDefault()
          event.stopPropagation()
          if (onCommit) {
            onCommit(options)
          } else {
            cell.table.stopEditing(options)
          }
        }

        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          if (onCancel) {
            onCancel()
          } else {
            cell.table.stopEditing()
          }
        } else if (event.key === "Tab") {
          commit({ direction: event.shiftKey ? "shift+tab" : "tab" })
        } else if (event.key === "Enter") {
          if (commitOnEnter) {
            commit({ moveToNextRow: true })
          } else if (event.ctrlKey || event.metaKey) {
            commit()
          }
        }
        return
      }

      if (event.defaultPrevented) return

      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "Tab"
      ) {
        return
      }

      if (!isFocused || readOnly) return

      const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey

      if (event.key === "F2" || event.key === "Enter" || isPrintable) {
        event.stopPropagation()
        // Local change: the editor is opened and focused before this handler ends (in the cell with its value selected,
        // or, for long text, in its popover with the caret after the text), and the browser then types the key into it
        // (upstream prevented the key and typed it with the deprecated `document.execCommand`). So a sign or a decimal
        // point that begins a number stays, and a second key cannot overtake the first (`bun run grid:keys` in
        // apps/inventory types on each editor and reads what is stored, its Escape and undo too).
        if (isPrintable && typesInPlace) {
          flushSync(() => cell.startEditing({ pendingChar: event.key }))
          // Local change: the browser types the key only where the editor has the focus by now. Where it has not (a
          // screen that keeps the editing state itself and applies it later, an editor that did not open), the key
          // would go nowhere and the editor would open afterwards with its value selected, so the next key would
          // replace the whole value. So the key is prevented and the editing is ended: the key does nothing, and
          // nothing is stored that was not typed.
          const active = document.activeElement
          if (active === event.currentTarget || !getIsEditableTarget(active)) {
            event.preventDefault()
            cell.table.stopEditing()
          }
          return
        }
        event.preventDefault()
        cell.startEditing(isPrintable ? { pendingChar: event.key } : undefined)
      }
    },
    // Local change: `typesInPlace` is in the list.
    [cell, onKeyDownProp, isFocused, isEditing, readOnly, onCommit, onCancel, commitOnEnter, typesInPlace]
  )

  return (
    <div
      role="gridcell"
      aria-colindex={columnIndex + 1}
      aria-selected={isSelected}
      aria-readonly={readOnly || undefined}
      {...props}
      ref={composedRef}
      data-slot="data-grid-cell"
      data-row-id={rowId}
      data-column-id={columnId}
      data-editing={isEditing ? "" : undefined}
      data-focused={isFocused ? "" : undefined}
      data-selected={isSelected ? "" : undefined}
      tabIndex={isFocused && !isEditing ? 0 : -1}
      className={cn(
        "h-full px-2 pt-1.75 pb-2 text-start text-sm outline-none has-data-[slot=checkbox]:pt-2.5 has-data-[slot=switch]:pt-2.5 **:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:w-fit **:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:max-w-full **:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:wrap-anywhere",
        {
          grow,
          "border-s": showStartBorder,
          "border-e": showEndBorder,
          "ring-1 ring-inset": isFocused || !!presence,
          "ring-ring": isFocused,
          "bg-background": !isTinted,
          [CELL_TINTS.tinted]: isTinted,
          [CELL_TINTS.selected]: isSelectionTinted,
          [CELL_TINTS.activeSearchMatch]: isActiveSearchMatch && !isSelectionTinted,
          [CELL_TINTS.searchMatch]: isSearchMatch && !isActiveSearchMatch && !isSelectionTinted,
          [CELL_TINTS.darkActiveSearchMatch]: isActiveSearchMatch,
          [CELL_TINTS.darkSearchMatch]: isSearchMatch && !isActiveSearchMatch,
          "cursor-default": !isEditing,
          "pointer-coarse:text-base": isEditing,
          "**:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:block **:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:truncate":
            rowHeight === "short",
          "**:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:line-clamp-2": rowHeight === "medium",
          "**:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:line-clamp-3": rowHeight === "tall",
          "**:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:line-clamp-4": rowHeight === "extra-tall"
        },
        className
      )}
      style={{
        ...getCellLayoutStyle({
          width,
          pinned,
          pinnedOffset
        }),
        ...(presence && !isFocused ? ({ "--tw-ring-color": presence.color } as React.CSSProperties) : null),
        ...style
      }}
      onKeyDown={onKeyDown}
    />
  )
}

export function useCellValue<TData extends RowData>(cell: Cell<DataGridFeatures, TData>) {
  const { table } = cell
  const rowId = cell.row.id
  const columnId = cell.column.id

  const subscribe = React.useCallback(
    (onChange: () => void) => table.subscribeCell(rowId, columnId, onChange),
    [table, rowId, columnId]
  )
  const getValue = () => cell.getValue()

  return React.useSyncExternalStore(subscribe, getValue, getValue)
}
