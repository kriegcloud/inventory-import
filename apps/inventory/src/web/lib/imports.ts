import { useQuery, useQueryClient } from "@tanstack/react-query"
import { MutableHashMap, Option } from "effect"
import type { ImportView, OpenImports } from "../../api/v1/Api.ts"
import type { StagedTable } from "../../domain/ItemImport.ts"
import type { SheetChoice, SheetSummary } from "../../domain/Spreadsheet.ts"
import { call } from "./api.ts"
import { cacheChange, useOptimisticWrite } from "./optimistic.ts"
import { queryKeys } from "./queries.ts"

/** How the import's view is fetched: by its hook, and ahead of it by the workspace when the address names one. */
export const importViewQuery = (id: string | undefined) => ({
  queryKey: queryKeys.import(id),
  queryFn: () => call((api) => api.imports.get({ params: { id: id ?? "" } })),
  enabled: id !== undefined
})

/** How the staged file's rows are fetched. They never change once staged, so they are fetched once and kept. */
export const importTableQuery = (id: string | undefined) => ({
  queryKey: queryKeys.importTable(id),
  queryFn: () => call((api) => api.imports.table({ params: { id: id ?? "" } })),
  enabled: id !== undefined,
  staleTime: Infinity,
  gcTime: Infinity
})

/** The import as the server has it now: status, what is already stored, the result once confirmed. */
export function useImportView(id: string | undefined) {
  // Coming back to the tab asks again, however fresh, so decisions made on another screen show up.
  return useQuery({ ...importViewQuery(id), refetchOnWindowFocus: "always" })
}

/** The staged file's rows, fetched once and kept. */
export function useImportTable(id: string | undefined) {
  return useQuery(importTableQuery(id))
}

/** Puts a freshly staged or changed import into the cache, so the next screen does not wait on a request. */
export function useImportCache() {
  const queryClient = useQueryClient()
  return {
    setView: (view: ImportView) => queryClient.setQueryData(queryKeys.import(view.id), view),
    setTable: (id: string, table: StagedTable) => queryClient.setQueryData(queryKeys.importTable(id), table)
  }
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
  Option.getOrUndefined(MutableHashMap.get(workbooks, importId))

/**
 * The imports nobody has confirmed yet, newest first, each a file of its own: the first screen offers to continue
 * or remove each. The server sends the newest few in full and counts the rest (`older`).
 */
export function useOpenImports() {
  return useQuery({ queryKey: queryKeys.openImports, queryFn: () => call((api) => api.imports.open()) })
}

/**
 * Removes an import nobody has confirmed: its staged rows and the decisions made on it. The server refuses one
 * that has created records. Afterwards nothing of it is left in this tab's cache either.
 *
 * Optimistic (`useOptimisticWrite`): the card goes the moment the person confirms, and comes back in its place, with
 * the reason, if the server refuses. Either way the list is asked for again, which also brings in an older file.
 */
export function useRemoveImport() {
  const queryClient = useQueryClient()
  return useOptimisticWrite({
    name: "remove-import",
    write: (client, view: ImportView) => client.imports.remove({ params: { id: view.id } }),
    changes: (view) => [
      cacheChange<OpenImports, ImportView>({
        key: queryKeys.openImports,
        apply: (list) => ({ ...list, views: list.views.filter((entry) => entry.id !== view.id) }),
        // Back in the place it had, unless the list fetched meanwhile already has it.
        undo: (now, before) => {
          const at = before.views.findIndex((entry) => entry.id === view.id)
          if (at < 0 || now.views.some((entry) => entry.id === view.id)) return now
          return { ...now, views: [...now.views.slice(0, at), view, ...now.views.slice(at)] }
        }
      })
    ],
    failed: (view) => `${view.fileName} was not removed.`,
    settled: () => [queryKeys.activity],
    onAnswer: (_answer, view) => {
      queryClient.removeQueries({ queryKey: queryKeys.import(view.id) })
      queryClient.removeQueries({ queryKey: queryKeys.importTable(view.id) })
    }
  })
}
