// Local change: not part of the upstream component (goals/atoms, "The kit on atoms", batch 2). What the grid's core
// (`use-data-grid.ts`, `data-grid.tsx`) uses in place of React's memo and effect hooks: a value kept while what it was
// worked out from is the same, and a call after each commit of the component that holds the table.
//
// The rule this file protects: a kept value keeps its identity exactly while its inputs do (the rows and the header
// are `React.memo` with identity compares, and the table compares its options), and the call after a commit runs
// where upstream's layout effects ran: in the commit of the component that called `useTable`, after the table has
// published its state.
import type { RowData, Table } from "@tanstack/react-table"
import type { RefObject } from "react"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"

/** One kept value: `make` runs again only when one of `deps` is not the same (`Object.is`) as last time. */
export type Keep<T> = (deps: ReadonlyArray<unknown>, make: () => T) => T

/** A slot that keeps one value for one component on screen, as `useMemo` did, made once with what it belongs to. */
export function keepOne<T>(): Keep<T> {
  let last: { readonly deps: ReadonlyArray<unknown>; readonly value: T } | null = null
  return (deps, make) => {
    if (
      last !== null &&
      last.deps.length === deps.length &&
      last.deps.every((dep, index) => Object.is(dep, deps[index]))
    ) {
      return last.value
    }
    const value = make()
    last = { deps, value }
    return value
  }
}

/**
 * Calls `listener` after each commit of the component that holds `table` (TanStack's `useTable` publishes the table's
 * state in a layout effect of that component and then tells the table's readonly atoms to read again): where upstream's
 * `useLayoutEffect` with no dependency list ran. Returns what stops it.
 */
export function afterEachCommit<TData extends RowData>(
  table: Table<DataGridFeatures, TData>,
  listener: () => void
): () => void {
  const commits = table._reactivity.createReadonlyAtom(() => listener, {
    debugName: "dataGridCommits",
    compare: () => false
  })
  const subscription = commits.subscribe(() => listener())
  return () => subscription.unsubscribe()
}

/**
 * Calls `listener` after a commit of the component that holds `table` in which `read` gives another list (each item
 * compared with `Object.is`): where upstream's `useEffect` with those dependencies ran again. Returns what stops it.
 */
export function afterCommitOf<TData extends RowData>(
  table: Table<DataGridFeatures, TData>,
  read: () => ReadonlyArray<unknown>,
  listener: () => void
): () => void {
  const values = table._reactivity.createReadonlyAtom(read, {
    debugName: "dataGridDependencies",
    compare: (a, b) => a.length === b.length && a.every((item, index) => Object.is(item, b[index]))
  })
  const subscription = values.subscribe(() => listener())
  return () => subscription.unsubscribe()
}

/**
 * A ref box for an element that starts `start` when React sets its node and calls what `start` returned when the node
 * is replaced or taken back: where upstream's mount effects added listeners to the element, and their cleanups. It
 * runs in the commit that attaches the element, so nothing depends on when a store's subscribers are told.
 */
export function onScreenRef<T>(start: (node: T) => () => void): RefObject<T | null> {
  let node: T | null = null
  let stop: (() => void) | null = null
  return {
    get current() {
      return node
    },
    set current(next: T | null) {
      if (Object.is(next, node)) return
      if (stop !== null) {
        const previous = stop
        stop = null
        previous()
      }
      node = next
      if (next !== null) stop = start(next)
    }
  }
}

/** Whether the page runs in Firefox, read once: the grid lays its pinned columns out another way there. */
let firefox: boolean | null = null

export function getIsFirefox(): boolean {
  if (firefox === null) firefox = typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox")
  return firefox
}
