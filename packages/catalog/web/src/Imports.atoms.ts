// The imports as atoms: one import's view and its staged rows, the open and past imports, and removing one. The rule
// this file protects: what one screen learned (a staged file's view and rows, a draft's new revision) is put in place
// for the next screen, which then does not wait on a request; and a staged file's rows, which never change, are asked
// for once and kept for the page.
import { optimisticChange, optimisticWrite, shown } from "@inventory/client/OptimisticAtoms"
import { apiRuntime, invalidate, perKey } from "@inventory/client/Api"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import type { ImportView, OpenImports } from "@inventory/catalog-contract/Import"
import type { SavedDecisions } from "@inventory/catalog-contract/Decision"
import type { Field } from "@inventory/catalog-contract/Staged"
import type { SheetChoice, SheetSummary } from "@inventory/catalog-model/Spreadsheet"
import { catalogApi } from "./Catalog.runtime.ts"
import { catalogKeys } from "./Catalog.keys.ts"

/**
 * One import as the server has it now: status, decisions, what is already stored, the result once confirmed. Asked
 * again whenever the person comes back to the tab, however fresh, so decisions made on another screen show up.
 */
export const importView = perKey((id: ImportId) =>
  catalogApi.query((api) => api.imports.get({ params: { id } }), { reactivityKeys: catalogKeys.import(id) })
)

/** `importView`, asked again when the tab regains focus: what the import's screens read. */
export const importViewShown = perKey((id: ImportId) => Atom.refreshOnWindowFocus(importView(id)))

/** One staged file's rows. They never change once staged: asked for once and kept for the page. */
export const importTable = perKey((id: ImportId) =>
  catalogApi.query((api) => api.imports.table({ params: { id } }), { keep: "page" })
)

/**
 * A view with some of its parts replaced: a copy of the same class, not decoded again. The view was decoded when it
 * arrived and the parts come typed from another answer; a view can hold thousands of stored items.
 */
export const viewWith: {
  (parts: Partial<ImportView>): (held: ImportView) => ImportView
  (held: ImportView, parts: Partial<ImportView>): ImportView
} = dual(2, (held: ImportView, parts: Partial<ImportView>): ImportView => {
  const copy: ImportView = Object.create(Object.getPrototypeOf(held))
  return Object.assign(copy, held, parts)
})

/**
 * Changes the view held for an import, worked out from the view as it is held at this moment: an answer that took
 * its time (suggestions, a saved decision) changes only its own part, and never takes back what landed meanwhile.
 * With no view held there is nothing to change: the next screen asks the server.
 */
export const changeView = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly id: ImportId
  readonly change: (held: ImportView) => ImportView
}): void => {
  const read = importView(input.id)
  const now = input.registry.get(read)
  if (!AsyncResult.isSuccess(now)) return
  const next = input.change(now.value)
  if (next !== now.value) input.registry.set(read, next)
}

/**
 * Puts a view the server answered with in place, unless the one held is of a later revision: two requests can answer
 * in the other order, and the earlier answer must not replace the later one.
 */
export const putView = (input: { readonly registry: AtomRegistry.AtomRegistry; readonly view: ImportView }): void => {
  const read = importView(input.view.id)
  const now = input.registry.get(read)
  if (AsyncResult.isSuccess(now) && now.value.revision > input.view.revision) return
  input.registry.set(read, input.view)
}

/** A workbook chosen in this tab, kept so the person can read another of its sheets without choosing it again. */
export type OpenWorkbook = { file: File; sheets: ReadonlyArray<SheetSummary>; chosen: SheetChoice }

const workbooks = MutableHashMap.empty<string, OpenWorkbook>()

/** Remembers the chosen workbook for an import. Gone after a reload: a browser cannot keep the file. */
export const rememberWorkbook = (importId: string, workbook: OpenWorkbook) => {
  MutableHashMap.set(workbooks, importId, workbook)
}

/** The workbook behind an import, when it was chosen in this tab. */
export const workbookOf = (importId: string): OpenWorkbook | undefined =>
  O.getOrUndefined(MutableHashMap.get(workbooks, importId))

/**
 * The imports nobody has confirmed yet, newest first, each a file of its own: the first screen offers to continue or
 * remove each. The server sends the newest few in full and counts the rest (`older`). Shown through removals.
 */
export const openImports = shown(
  catalogApi.query((api) => api.imports.open(), { reactivityKeys: catalogKeys.openImports })
)

/**
 * The imports confirmed at least once, last confirmed first, each with how many of its items are stored now: the way
 * back to a past import's result from the first screen and from Activity. The server counts the older ones.
 */
export const pastImports = catalogApi.query((api) => api.imports.past(), {
  reactivityKeys: catalogKeys.pastImports
})

/**
 * Removes an import nobody has confirmed: its staged rows and the decisions made on it. The server refuses one that
 * has created records. Optimistic: the card goes the moment the person confirms, and comes back in its place, with
 * the reason, if the server refuses. Either way the list is asked for again, which also brings in an older file.
 */
export const removeImport = optimisticWrite({
  send: (view: ImportView) => catalogApi.send((api) => api.imports.remove({ params: { id: view.id } })),
  changes: [
    optimisticChange(openImports, (list: OpenImports, view: ImportView) => ({
      ...list,
      views: A.filter(list.views, (entry) => entry.id !== view.id)
    }))
  ],
  failed: (view) => `${view.fileName} was not removed.`,
  settled: catalogKeys.activity
})

/** Which file column fills a field of one import, or none. */
export interface ColumnPick {
  readonly id: ImportId
  readonly field: Field
  readonly column: O.Option<number>
}

/**
 * Matches a file column to a field (or clears it), from the Match step or from inside the review. The server decides
 * what a new match drops (the accepts of that field); its answer is the import's new view, put in place at once.
 */
export const matchColumn = apiRuntime.fn<ColumnPick>()(
  Effect.fnUntraced(function* (pick: ColumnPick) {
    const view = yield* catalogApi.ask((api) =>
      api.imports.match({ params: { id: pick.id }, payload: { field: pick.field, column: pick.column } })
    )
    const registry = yield* AtomRegistry.AtomRegistry
    putView({ registry, view })
    return view
  }),
  { concurrent: true }
)

/** What a confirm, a reopen or a take-back changes besides the import itself: what lists it and what it wrote. */
const afterImportChange = [...catalogKeys.openImports, ...catalogKeys.pastImports, ...catalogKeys.activity] as const

/**
 * Opens a confirmed import's review again (to fix what was not imported): its new view is put in place at once, and
 * the lists of open and past imports and the audit trail are asked again.
 */
export const reopenImport = apiRuntime.fn<ImportId>()(
  Effect.fnUntraced(function* (id: ImportId) {
    const opened = yield* catalogApi.ask((api) => api.imports.reopen({ params: { id } }))
    const registry = yield* AtomRegistry.AtomRegistry
    registry.set(importView(id), opened)
    invalidate(afterImportChange)
    return opened
  }),
  { concurrent: true }
)

/** Takes a confirmed import back: one atomic write on the server; its new view is put in place at once. */
export const takeBackImport = apiRuntime.fn<ImportView>()(
  Effect.fnUntraced(function* (view: ImportView) {
    const done = yield* catalogApi.ask((api) =>
      api.imports.takeBack({ params: { id: view.id }, payload: { confirms: view.takeBack.confirms } })
    )
    const registry = yield* AtomRegistry.AtomRegistry
    registry.set(importView(view.id), done)
    invalidate([...afterImportChange, ...catalogKeys.items, ...catalogKeys.itemFacets, ...catalogKeys.changes])
    return done
  }),
  { concurrent: true }
)

/**
 * Asks for suggestions where the rules have none. Nothing it returns changes a row: each waits for the person. The
 * suggestions are put into the import's view as it is held when they arrive, where the review reads them: decisions
 * saved and a column matched while the model worked stay.
 */
export const suggestFixes = apiRuntime.fn<ImportId>()(
  Effect.fnUntraced(function* (id: ImportId) {
    const outcome = yield* catalogApi.ask((api) => api.imports.suggest({ params: { id } }))
    const registry = yield* AtomRegistry.AtomRegistry
    changeView({ registry, id, change: viewWith({ suggestions: outcome.suggestions }) })
    return outcome
  }),
  { concurrent: true }
)

/** One confirm: the import and the decisions it carries, all of them, so the server reviews the same rows. */
export interface Confirm {
  readonly id: ImportId
  readonly decisions: SavedDecisions
}

/**
 * Confirms an import: the server reviews the rows again with these decisions and writes what is ready, in one atomic
 * write. Its new view (with the result) is put in place at once, and what the confirm wrote is asked for again.
 */
export const confirmImport = apiRuntime.fn<Confirm>()(
  Effect.fnUntraced(function* (confirm: Confirm) {
    const done = yield* catalogApi.ask((api) =>
      api.imports.commit({ params: { id: confirm.id }, payload: { set: confirm.decisions, clear: [] } })
    )
    const registry = yield* AtomRegistry.AtomRegistry
    registry.set(importView(confirm.id), done)
    invalidate([...afterImportChange, ...catalogKeys.items, ...catalogKeys.itemFacets, ...catalogKeys.changes])
    return done
  }),
  { concurrent: true }
)
