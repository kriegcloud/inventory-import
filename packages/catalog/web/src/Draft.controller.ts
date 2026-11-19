import { stringify } from "@inventory/ui/Json"
import { perKey } from "@inventory/client/Api"
import type { DecisionDelta } from "@inventory/catalog-contract/Decision"
import type { SavedDecisions } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { callWrite } from "./Catalog.runtime.ts"
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

/** Who to tell how a save went: the screen that made the change, the latest one. */
export interface SaveListeners {
  /** Told the draft's revision after every save, and the decisions that are now on the server. */
  readonly onSaved: (revision: number, decisions: SavedDecisions) => void
  /** The server refused the decisions: show what it holds, and say why. */
  readonly onRefused: (error: unknown) => void
}

/** One import's saver: hand it the screen's decisions after each change. */
export interface DecisionSaver {
  /** The screen's decisions changed: remember them and save the difference. */
  readonly change: (next: SavedDecisions, listeners: SaveListeners) => void
  /** What the server has not been sent, or has not answered for, yet. */
  readonly pending: () => DecisionDelta
  /** The draft was fetched again (it changed on another screen): start from what the server holds now. */
  readonly reset: (decisions: SavedDecisions) => void
}

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
 *
 * One per import, outside the screen (`decisionSaver`): what it holds is the save under way, not something drawn, so
 * it is the saver's own, not React's or an atom's. The screen resets it when it first sees the import.
 */
const makeSaver = (importId: ImportId): DecisionSaver => {
  let onServer: SavedDecisions = {}
  let wanted: SavedDecisions = {}
  let busy = false
  let listeners: SaveListeners = { onSaved: () => {}, onRefused: () => {} }

  const flush = (): Promise<void> => {
    if (busy) return Promise.resolve()
    busy = true
    const saveNext = (): Promise<void> => {
      const target = wanted
      const delta = deltaOf(onServer, target)
      if (isEmpty(delta)) return Promise.resolve()
      return callWrite((api) => api.imports.decide({ params: { id: importId }, payload: delta })).then(
        ({ revision }) => {
          onServer = target
          listeners.onSaved(revision, target)
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
          listeners.onRefused(error)
        }
      })
      .finally(() => {
        busy = false
      })
  }

  return {
    change: (next, told) => {
      listeners = told
      wanted = next
      void flush()
    },
    pending: () => deltaOf(onServer, wanted),
    reset: (decisions) => {
      onServer = decisions
      wanted = decisions
    }
  }
}

/** The saver of one import, the same for the page's life. */
export const decisionSaver = perKey(makeSaver)
