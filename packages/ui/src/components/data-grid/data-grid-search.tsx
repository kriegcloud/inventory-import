// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// The search box is drawn only while the search is open, so what upstream's two effects did when it opened and closed
// is done by ref callbacks on the box itself, each the same function across draws: the input's (`searchBox`, one per
// search on screen) focuses it as it appears and, as it goes, forgets the composition and that anything was typed; the
// box's (`closeOnEscape`, one per table) holds the document's Escape listener while the box is there. Whether
// something was typed is an atom of the instance; the pause before a search is `oneTimer` (batch 1).
"use client"

import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { ReactTable, RowData } from "@tanstack/react-table"

import * as Atom from "effect/reactivity/Atom"
import {
  type ChangeEvent,
  type CompositionEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  memo,
  type PointerEvent,
  useId
} from "react"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"

import { oneTimer } from "@inventory/ui/components/data-table/data-table-state"
import { Button } from "@inventory/ui/components/button"
import { Input } from "@inventory/ui/components/input"
import { ChevronUp, ChevronDown, X } from "lucide-react"

const SEARCH_DELAY_MS = 150

/**
 * Whether the person has typed into one search on screen since it last opened: null until they first type, when the
 * query the grid already holds says it. Made for each instance (its `useId`).
 */
const searchHasQuery = Atom.family((_instance: string) => Atom.make<boolean | null>(null))

interface SearchBox {
  /** The input's ref: focuses it as it appears; as it goes, forgets the composition and what was typed. */
  readonly inputRef: (node: HTMLInputElement | null) => void
  readonly isComposing: () => boolean
  readonly setComposing: (composing: boolean) => void
}

/**
 * One search on screen, made for each instance (its `useId`). Whether an IME composition is under way is never
 * drawn, only read by the change handler, so it is kept here beside the input's ref, as `oneTimer` keeps its timer.
 */
const searchBox = Atom.family((instance: string) =>
  Atom.readable((get): SearchBox => {
    const registry = get.registry
    let composing = false
    return {
      inputRef: (node) => {
        if (node !== null) {
          requestAnimationFrame(() => {
            node.focus()
          })
          return
        }
        composing = false
        registry.set(searchHasQuery(instance), false)
      },
      isComposing: () => composing,
      setComposing: (next) => {
        composing = next
      }
    }
  }).pipe(Atom.setIdleTTL(0))
)

type EscapeRef = (node: HTMLDivElement | null) => (() => void) | undefined

const escapeRefs = new WeakMap<object, EscapeRef>()

/** The search box's ref for one table: Escape anywhere in the document closes the search while the box is there. */
function closeOnEscape<TData extends RowData>(table: ReactTable<DataGridFeatures, TData, unknown>): EscapeRef {
  const kept = escapeRefs.get(table)
  if (kept !== undefined) return kept
  const ref: EscapeRef = (node) => {
    if (node === null) return undefined

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        table.closeSearch()
      }
    }

    document.addEventListener("keydown", onEscape)
    return () => document.removeEventListener("keydown", onEscape)
  }
  escapeRefs.set(table, ref)
  return ref
}

interface DataGridSearchProps<TData extends RowData> {
  table: ReactTable<DataGridFeatures, TData, unknown>
}

export function DataGridSearch<TData extends RowData>({ table }: DataGridSearchProps<TData>) {
  return (
    <table.Subscribe
      selector={(state) => ({
        searchOpen: state.searchOpen,
        searchQuery: state.searchQuery,
        matchIndex: state.searchMatchIndex,
        matchCount: table.getSearchMatches().length
      })}
    >
      {(searchState) => <DataGridSearchContent table={table} {...searchState} />}
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
  if (prev.searchOpen !== next.searchOpen) return false

  if (!next.searchOpen) return true

  return prev.matchIndex === next.matchIndex && prev.matchCount === next.matchCount
}) as typeof DataGridSearchContentImpl

function DataGridSearchContentImpl<TData extends RowData>({
  table,
  searchOpen,
  searchQuery,
  matchIndex,
  matchCount
}: DataGridSearchContentProps<TData>) {
  const id = useId()
  const box = useAtomValue(searchBox(id))
  const typed = useAtomValue(searchHasQuery(id))
  const hasQuery = typed ?? searchQuery.length > 0
  const setHasQuery = useAtomSet(searchHasQuery(id))
  const timer = useAtomValue(oneTimer(id))

  function debouncedSearch(query: string) {
    timer.start(() => table.setSearchQuery(query), SEARCH_DELAY_MS)
  }

  function onCompositionStart() {
    box.setComposing(true)
  }

  function onCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    box.setComposing(false)
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
    if (box.isComposing()) return
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
      ref={closeOnEscape(table)}
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
          ref={box.inputRef}
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

function onTriggerPointerDown(event: PointerEvent<HTMLButtonElement>) {
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
