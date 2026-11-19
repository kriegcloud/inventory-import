import { stringify } from "@inventory/ui/Json"
import { useCallback, useRef } from "react"
import type { DecisionDelta } from "../../api/v1/Api.ts"
import type { SavedDecisions } from "../../domain/ItemImport.ts"
import type { ImportId } from "../../domain/Ids.ts"
import { callWrite } from "./api.ts"
import { isTransient, toastError } from "@inventory/client/SayError"

/** What differs between two drafts, row by row: the rows to save and the rows whose decision was taken back. */
export const deltaOf = (before: SavedDecisions, after: SavedDecisions): DecisionDelta => {
  const set: Record<string, SavedDecisions[string]> = {}
  for (const [rowId, decision] of Object.entries(after)) {
    const earlier = before[rowId]
    if (earlier === undefined || stringify(earlier) !== stringify(decision)) set[rowId] = decision
  }
  return { set, clear: Object.keys(before).filter((rowId) => !Object.hasOwn(after, rowId)) }
}

const isEmpty = (delta: DecisionDelta): boolean => Object.keys(delta.set).length === 0 && delta.clear.length === 0

/**
 * Saves the review's decisions to the server as they are made: optimistic, the decision is on screen before it is
 * sent. Each change is sent at once; while one request is on its way the next waits and then sends whatever changed
 * since, so the server always ends at the latest state and never sees two saves race. `pending` is what the server
 * does not have yet, for the confirm to carry.
 *
 * A failure that may pass (the network, a server error) is sent again under the same key, twice, and if it still
 * fails the decision stays on screen with "Save again": it is the person's work, the confirm carries it, and putting
 * it back would make them decide again. A refusal (the import was confirmed or removed meanwhile, the role was taken
 * away) is told to `onRefused`, which puts the screen back to what the server holds.
 */
export function useDecisionSaver(input: {
  importId: ImportId
  start: SavedDecisions
  /** Told the draft's revision after every save, and the decisions that are now on the server. */
  onSaved: (revision: number, decisions: SavedDecisions) => void
  /** The server refused the decisions: show what it holds, and say why. */
  onRefused: (error: unknown) => void
}) {
  const onServer = useRef(input.start)
  const wanted = useRef(input.start)
  const busy = useRef(false)
  const { importId, onSaved, onRefused } = input

  const flush = useCallback((): Promise<void> => {
    if (busy.current) return Promise.resolve()
    busy.current = true
    const saveNext = (): Promise<void> => {
      const target = wanted.current
      const delta = deltaOf(onServer.current, target)
      if (isEmpty(delta)) return Promise.resolve()
      return callWrite((api) => api.imports.decide({ params: { id: importId }, payload: delta })).then(
        ({ revision }) => {
          onServer.current = target
          onSaved(revision, target)
          return saveNext()
        }
      )
    }
    return Promise.resolve()
      .then(saveNext)
      .catch((error: unknown) => {
        if (isTransient(error)) {
          toastError(error, {
            lead: "Your last decision is on this screen but not saved yet.",
            action: { label: "Save again", onClick: () => void flush() }
          })
        } else {
          onRefused(error)
        }
      })
      .finally(() => {
        busy.current = false
      })
  }, [importId, onSaved, onRefused])

  return {
    /** The screen's decisions changed: remember them and save the difference. */
    change: useCallback(
      (next: SavedDecisions) => {
        wanted.current = next
        void flush()
      },
      [flush]
    ),
    /** What the server has not been sent, or has not answered for, yet. */
    pending: useCallback(() => deltaOf(onServer.current, wanted.current), []),
    /** The draft was fetched again (it changed on another screen): start from what the server holds now. */
    reset: useCallback((decisions: SavedDecisions) => {
      onServer.current = decisions
      wanted.current = decisions
    }, [])
  }
}
