// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// A cell's value is followed by an atom that subscribes to the table's cell and lets go with its finalizer (upstream
// read it with `useSyncExternalStore`). The focus a cell takes when it becomes the focused one is a ref callback that
// changes only when that does (upstream's layout effect on `isFocused` and `isEditing`), kept by the cell's own atom.
// The rule this file protects: typing on a focused cell opens its editor and keeps the key that opened it.
"use client"

import type { Cell, RowData } from "@tanstack/react-table"

import { useAtomValue } from "@effect/atom-react"
import { cn } from "cn"
import * as Atom from "effect/reactivity/Atom"
import { type ComponentProps, type CSSProperties, type KeyboardEvent, type Ref, type RefCallback, useId } from "react"
// Local change: `flushSync`, for `typesInPlace` below.
import { flushSync } from "react-dom"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import type { DataGridCellProps, StopEditingOptions } from "@inventory/ui/components/data-grid/data-grid-types"

// Local change: `getHasCustomCell` and `getIsEditableTarget`, for `typesInPlace` below.
import {
  CELL_TINTS,
  getCellFocusTarget,
  getCellLayoutStyle,
  getCellKey,
  getHasCustomCell,
  getIsEditableTarget,
  parseCellKey
} from "@inventory/ui/components/data-grid/data-grid-utils"

/** One ref callback that hands the node to each ref, and cleans up after each when the node goes. */
function composeRefs<T>(...refs: ReadonlyArray<Ref<T> | undefined>): RefCallback<T> {
  return (node) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") return ref(node)
      if (ref !== null && ref !== undefined) ref.current = node
      return undefined
    })
    return () => {
      cleanups.forEach((cleanup, index) => {
        const ref = refs[index]
        if (typeof cleanup === "function") cleanup()
        else if (typeof ref === "function") ref(null)
        else if (ref !== null && ref !== undefined) ref.current = null
      })
    }
  }
}

/** What one cell on screen keeps between draws: its ref callback, made again only when what it closes over changes. */
interface KeptRef {
  readonly of: (deps: ReadonlyArray<unknown>, make: () => RefCallback<HTMLDivElement>) => RefCallback<HTMLDivElement>
}

/**
 * A cell's `KeptRef`, made for each instance (its `useId`) and let go when the cell leaves the screen. React calls a new
 * ref callback with the node, so the callback changes exactly when upstream's layout effect ran again.
 */
const keptCellRef = Atom.family((_instance: string) =>
  Atom.readable((): KeptRef => {
    let kept: { readonly deps: ReadonlyArray<unknown>; readonly ref: RefCallback<HTMLDivElement> } | undefined
    return {
      of: (deps, make) => {
        if (
          kept !== undefined &&
          kept.deps.length === deps.length &&
          kept.deps.every((dep, index) => Object.is(dep, deps[index]))
        ) {
          return kept.ref
        }
        const ref = make()
        kept = { deps, ref }
        return ref
      }
    }
  }).pipe(Atom.setIdleTTL(0))
)

// The focused cell takes the focus when it becomes the focused one and is not being edited, unless the focus is in
// another grid or outside any grid (upstream's layout effect, unchanged).
function focusCell(element: HTMLDivElement | null) {
  if (element === null) return
  const grid = element.closest('[role="grid"]')
  const active = document.activeElement
  if (!grid || element.contains(active)) return
  const isPageFocused = !active || active === document.body
  const activeGrid = active?.closest('[data-slot="data-grid-cell"]')?.closest('[role="grid"]')
  if (!isPageFocused && active !== grid && activeGrid !== grid) return
  getCellFocusTarget(element).focus({ preventScroll: true })
}

interface DataGridCellElementProps<TData extends RowData> extends DataGridCellProps<TData>, ComponentProps<"div"> {
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
  // Local change: whether the editor this column opens takes typing (text, number, url, long text), so the browser can
  // type the key that opens it. It is read from the column, not passed by the editor: a column with a variant and its
  // own `cell` is drawn by this wrapper alone until the person edits, and its editor mounts only then.
  const variant = cell.column.columnDef.meta?.variant ?? "text"
  // A column that writes its own cell (`meta.writeCell`) opens no editor, so its key is prevented as upstream did.
  const typesInPlace =
    !cell.column.columnDef.meta?.writeCell &&
    !getHasCustomCell(cell.column) &&
    (variant === "text" || variant === "number" || variant === "url" || variant === "long-text")
  const takesFocus = isFocused && !isEditing
  const composedRef = useAtomValue(keptCellRef(useId())).of([ref, takesFocus], () =>
    takesFocus ? composeRefs(ref, focusCell) : composeRefs(ref)
  )

  const isSelectionTinted = isSelected && !isEditing
  const isTinted = isSelectionTinted || isSearchMatch || isActiveSearchMatch

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
  }

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
        ...(presence && !isFocused ? ({ "--tw-ring-color": presence.color } as CSSProperties) : null),
        ...style
      }}
      onKeyDown={onKeyDown}
    />
  )
}

// The value of each cell of a table on screen, as an atom that subscribes to the table's cell while something reads it
// and lets go with its finalizer: one family per table, keyed by the cell's key, as upstream's subscription was keyed
// by the table, the row and the column.
const cellValues = new WeakMap<object, (cellKey: string) => Atom.Atom<unknown>>()

function cellValueOf<TData extends RowData>(
  table: Cell<DataGridFeatures, TData>["table"],
  rowId: string,
  columnId: string
) {
  let family = cellValues.get(table)
  if (family === undefined) {
    family = Atom.family((cellKey: string) => {
      const position = parseCellKey(cellKey)
      const read = () => table.getRowModel().rowsById[position.rowId]?.getValue(position.columnId)
      return Atom.readable((get) => {
        get.addFinalizer(table.subscribeCell(position.rowId, position.columnId, () => get.setSelf(read())))
        return read()
      })
    })
    cellValues.set(table, family)
  }
  return family(getCellKey(rowId, columnId))
}

export function useCellValue<TData extends RowData>(cell: Cell<DataGridFeatures, TData>) {
  // Read to draw the cell again when its value changes; the value drawn is the cell's own, as upstream's snapshot was.
  useAtomValue(cellValueOf(cell.table, cell.row.id, cell.column.id))
  return cell.getValue()
}
