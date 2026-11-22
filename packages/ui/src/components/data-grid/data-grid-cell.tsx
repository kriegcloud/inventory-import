"use client"
// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// A cell takes the focus when it becomes the focused cell and nobody is editing it, through its ref callback: the
// wrapper is given one of two callbacks that each stay the same, one that focuses and one that does not, so React
// calls the focusing one exactly when the cell turns focused (upstream's layout effect on `isFocused` and
// `isEditing`). The two are kept by the ref the caller gives, which they also set. A cell's value is read as it is
// drawn, and `cellChanges` (an atom per cell of the table, subscribed to the table's own cell listeners) draws it again
// when the value changes, where upstream had `useSyncExternalStore`.
import type { Cell, RowData, Table } from "@tanstack/react-table"

import { useAtomValue } from "@effect/atom-react"
import { cn } from "cn"
import * as Atom from "effect/reactivity/Atom"
import {
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
  type RefCallback
} from "react"
// Local change: `flushSync`, for `typesInPlace` below.
import { flushSync } from "react-dom"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import type { DataGridCellProps, StopEditingOptions } from "@inventory/ui/components/data-grid/data-grid-types"

// Local change: `getHasCustomCell` and `getIsEditableTarget`, for `typesInPlace` below.
import {
  CELL_TINTS,
  getCellFocusTarget,
  getCellKey,
  getCellLayoutStyle,
  getHasCustomCell,
  getIsEditableTarget,
  parseCellKey
} from "@inventory/ui/components/data-grid/data-grid-utils"

interface DataGridCellElementProps<TData extends RowData> extends DataGridCellProps<TData>, ComponentProps<"div"> {
  onCommit?: (options?: StopEditingOptions) => void
  onCancel?: () => void
  commitOnEnter?: boolean
}

/** Sets `ref` to `node` (a ref object, or a callback and what it returns), and gives what undoes it. */
export function setRef<T>(ref: Ref<T> | undefined, node: T): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(node)
    return typeof cleanup === "function" ? cleanup : () => ref(null)
  }
  if (ref) {
    ref.current = node
    return () => {
      ref.current = null
    }
  }
  return () => {}
}

interface CellRefs {
  readonly focusing: RefCallback<HTMLDivElement>
  readonly still: RefCallback<HTMLDivElement>
}

const noRef = {}
const cellRefsKept = new WeakMap<object, CellRefs>()

/** The wrapper's two ref callbacks for the ref its caller gives, the same two for as long as that ref is the same. */
function getCellRefs(ref: Ref<HTMLDivElement> | undefined): CellRefs {
  const key = ref ?? noRef
  const known = cellRefsKept.get(key)
  if (known !== undefined) return known
  const refs: CellRefs = {
    focusing: (element) => {
      if (!element) return
      const undo = setRef(ref, element)
      focusIfTheGridHasFocus(element)
      return undo
    },
    still: (element) => {
      if (!element) return
      return setRef(ref, element)
    }
  }
  cellRefsKept.set(key, refs)
  return refs
}

/** Focuses a cell that has just become the focused one, unless the person is somewhere else on the page. */
function focusIfTheGridHasFocus(element: HTMLDivElement) {
  const grid = element.closest('[role="grid"]')
  const active = document.activeElement
  if (!grid || element.contains(active)) return
  const isPageFocused = !active || active === document.body
  const activeGrid = active?.closest('[data-slot="data-grid-cell"]')?.closest('[role="grid"]')
  if (!isPageFocused && active !== grid && activeGrid !== grid) return
  getCellFocusTarget(element).focus({ preventScroll: true })
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
  const refs = getCellRefs(ref)

  const isSelectionTinted = isSelected && !isEditing
  const isTinted = isSelectionTinted || isSearchMatch || isActiveSearchMatch

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
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
      ref={isFocused && !isEditing ? refs.focusing : refs.still}
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

// One family of change counters per table, kept while the table is.
const cellChangeFamilies = new WeakMap<object, (cellKey: string) => Atom.Atom<number>>()

/**
 * A number that goes up each time the table says one cell's value changed (its `subscribeCell`), for as long as
 * something on screen reads it: the cell's listener is on while the atom is read and is taken off by its finalizer.
 */
export function cellChanges<TData extends RowData>(
  table: Table<DataGridFeatures, TData>,
  rowId: string,
  columnId: string
): Atom.Atom<number> {
  let family = cellChangeFamilies.get(table)
  if (family === undefined) {
    family = Atom.family((cellKey: string) =>
      Atom.readable((get) => {
        const cell = parseCellKey(cellKey)
        let changes = 0
        let isSubscribed = false
        const unsubscribe = table.subscribeCell(cell.rowId, cell.columnId, () => {
          changes += 1
          if (isSubscribed) get.setSelf(changes)
        })
        isSubscribed = true
        get.addFinalizer(unsubscribe)
        return changes
      }).pipe(Atom.setIdleTTL(0))
    )
    cellChangeFamilies.set(table, family)
  }
  return family(getCellKey(rowId, columnId))
}

// The atom of each cell object (a cell stays the same object while its row does), so a cell drawn again (an arrow key
// draws the cells it leaves and enters) finds its atom without building its key and looking it up in the family.
const cellChangesKept = new WeakMap<object, Atom.Atom<number>>()

/** `cellChanges` of one cell, the same atom as `cellChanges(cell.table, cell.row.id, cell.column.id)`. */
export function cellChangesOf<TData extends RowData>(cell: Cell<DataGridFeatures, TData>): Atom.Atom<number> {
  const known = cellChangesKept.get(cell)
  if (known !== undefined) return known
  const atom = cellChanges(cell.table, cell.row.id, cell.column.id)
  cellChangesKept.set(cell, atom)
  return atom
}

export function useCellValue<TData extends RowData>(cell: Cell<DataGridFeatures, TData>) {
  useAtomValue(cellChangesOf(cell))
  return cell.getValue()
}
