"use client"
// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// Whether a word is being composed (an input method) and whether a query was typed are atoms of the grid's own; the
// search box's ref callback, the same function for the grid's whole life, focuses the box a frame after it opens (when
// its grid is the one the Ctrl+F was pressed in) and listens for Escape on the page while it is open, where upstream
// had two effects on `searchOpen`. When the box closes the two atoms go back to "not composing" and "no query", as
// upstream's state did.
import { useAtomValue } from "@effect/atom-react"
import type { ReactTable, RowData } from "@tanstack/react-table"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import {
  type ChangeEvent,
  type CompositionEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  memo,
  type PointerEvent as ReactPointerEvent,
  type RefCallback
} from "react"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"

import { gridTableOf, searchFocusClaim, takesSearchFocus } from "@inventory/ui/components/data-grid/use-data-grid"
import { atomRegistry } from "@inventory/ui/components/data-table/data-table-state"
// The kit's own debounce, on atoms since batch 1 (`oneTimer`): the rule keeps it out of our code, and this is the kit.
// oxlint-disable-next-line no-restricted-imports
import { useDebouncedCallback } from "@inventory/ui/hooks/use-debounced-callback"
import { Button } from "@inventory/ui/components/button"
import { Input } from "@inventory/ui/components/input"
import { ChevronUp, ChevronDown, X } from "lucide-react"

interface DataGridSearchProps<TData extends RowData> {
  table: ReactTable<DataGridFeatures, TData, unknown>
  gridId: string
}

/** Whether one grid's search box is in the middle of composing a word. */
const searchComposing = Atom.family((_grid: string) => Atom.make(false))

/** Whether one grid's search box has a query typed: none until the person types, when the table's query says. */
const searchHasQuery = Atom.family((_grid: string) => Atom.make<O.Option<boolean>>(O.none()))

/**
 * The ref callback of one grid's search box, the same function for the grid's whole life. The box asks for the focus
 * a frame after it opens, and takes it only when its grid is the one the Ctrl+F was pressed in (`searchFocusClaim`),
 * so with two grids on the page the query goes to the grid the person was in.
 */
export const searchInputRef = Atom.family((grid: string) =>
  Atom.readable((get): RefCallback<HTMLInputElement> => {
    const registry = get.registry
    get.mount(searchComposing(grid))
    return (input) => {
      if (!input) return
      const frame = requestAnimationFrame(() => {
        if (takesSearchFocus(registry.get(searchFocusClaim), grid)) input.focus()
      })

      function onEscape(event: KeyboardEvent) {
        if (event.key === "Escape") {
          event.preventDefault()
          const table = registry.get(gridTableOf(grid)) as { closeSearch: () => void } | null
          table?.closeSearch()
        }
      }

      document.addEventListener("keydown", onEscape)
      return () => {
        cancelAnimationFrame(frame)
        document.removeEventListener("keydown", onEscape)
        registry.set(searchComposing(grid), false)
        registry.set(searchHasQuery(grid), O.some(false))
      }
    }
  }).pipe(Atom.setIdleTTL(0))
)

export function DataGridSearch<TData extends RowData>({ table, gridId }: DataGridSearchProps<TData>) {
  return (
    <table.Subscribe
      selector={(state) => ({
        searchOpen: state.searchOpen,
        searchQuery: state.searchQuery,
        matchIndex: state.searchMatchIndex,
        matchCount: table.getSearchMatches().length
      })}
    >
      {(searchState) => <DataGridSearchContent table={table} gridId={gridId} {...searchState} />}
    </table.Subscribe>
  )
}

interface DataGridSearchContentProps<TData extends RowData> extends DataGridSearchProps<TData> {
  searchOpen: boolean
  searchQuery: string
  matchIndex: number
  matchCount: number
}

const DataGridSearchContent = memo(DataGridSearchContentImpl, (prev, next) => {
  if (prev.table !== next.table) return false
  if (prev.gridId !== next.gridId) return false
  if (prev.searchOpen !== next.searchOpen) return false

  if (!next.searchOpen) return true

  return prev.matchIndex === next.matchIndex && prev.matchCount === next.matchCount
}) as typeof DataGridSearchContentImpl

function DataGridSearchContentImpl<TData extends RowData>({
  table,
  gridId,
  searchOpen,
  searchQuery,
  matchIndex,
  matchCount
}: DataGridSearchContentProps<TData>) {
  const registry = useAtomValue(atomRegistry)
  const inputRef = useAtomValue(searchInputRef(gridId))
  const hasQuery = O.getOrElse(useAtomValue(searchHasQuery(gridId)), () => searchQuery.length > 0)

  function setHasQuery(value: boolean) {
    registry.set(searchHasQuery(gridId), O.some(value))
  }

  const debouncedSearch = useDebouncedCallback((query: string) => {
    table.setSearchQuery(query)
  }, 150)

  function onCompositionStart() {
    registry.set(searchComposing(gridId), true)
  }

  function onCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    registry.set(searchComposing(gridId), false)
    const value = event.currentTarget.value
    setHasQuery(value.length > 0)
    debouncedSearch(value)
  }

  function onKeyDown(event: ReactKeyboardEvent) {
    event.stopPropagation()

    if (event.key === "Enter") {
      if (event.nativeEvent.isComposing) return
      event.preventDefault()
      if (event.shiftKey) {
        table.goToPrevSearchMatch()
      } else {
        table.goToNextSearchMatch()
      }
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    if (registry.get(searchComposing(gridId))) return
    const value = event.target.value
    setHasQuery(value.length > 0)
    debouncedSearch(value)
  }

  function onClose() {
    table.closeSearch()
  }

  function onPrevMatch() {
    table.goToPrevSearchMatch()
  }

  function onNextMatch() {
    table.goToNextSearchMatch()
  }

  if (!searchOpen) return null

  return (
    <div
      role="search"
      data-slot="data-grid-search"
      className="absolute inset-e-4 top-4 z-50 flex animate-in flex-col gap-2 rounded-lg border bg-background p-2 shadow-lg fade-in-0 slide-in-from-top-2"
    >
      <div className="flex items-center gap-2">
        <Input
          aria-label="Find in table"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Find in table..."
          className="w-64"
          ref={inputRef}
          defaultValue={searchQuery}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
        />
        <div className="flex items-center gap-1">
          <Button
            aria-label="Previous match"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onPrevMatch}
            onPointerDown={onTriggerPointerDown}
            disabled={matchCount === 0}
          >
            <ChevronUp />
          </Button>
          <Button
            aria-label="Next match"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onNextMatch}
            onPointerDown={onTriggerPointerDown}
            disabled={matchCount === 0}
          >
            <ChevronDown />
          </Button>
          <Button aria-label="Close search" variant="ghost" size="icon" className="size-7" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>
      <div role="status" className="flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
        {matchCount > 0 ? (
          <span>
            {matchIndex + 1} of {matchCount}
          </span>
        ) : hasQuery ? (
          <span>No results</span>
        ) : (
          <span>Type to search</span>
        )}
      </div>
    </div>
  )
}

function onTriggerPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }

  // Keeps the trigger from taking focus from the input.
  if (event.button === 0 && !event.ctrlKey && event.pointerType === "mouse") {
    event.preventDefault()
  }
}
