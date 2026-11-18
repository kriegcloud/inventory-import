// What the person has done so far on a screen, kept in this browser so a hard refresh or a closed tab never makes
// them repeat it: the step they were on, the file they chose, and their decisions with the undo history behind them.
// The rules this file protects: progress belongs to one person in one organization (another member, or the same person
// in another organization, never sees it); what is read back is decoded, so a draft from an older version is dropped,
// never shown half; and Confirm clears it. The decisions are small and go to localStorage, written before the next
// frame; the file itself is a Blob in IndexedDB, written once when it is chosen and read again by the worker on return.
import * as S from "effect/Schema"
import { fromDraft, toDraft } from "../../components/review/logic.ts"
import type { ReviewDraft, SavedDecisions } from "../../components/review/types.ts"

/** Who the progress belongs to, and which screen. Every part comes from the session, never from the page's address. */
export type ProgressScope = {
  readonly organizationId: string
  readonly memberId: string
  readonly screen: string
}

/**
 * The storage key for one scope. Each part is escaped, so two different scopes can never share a key, whatever
 * their ids contain ("a:b" in one part and "c" in the next is not "a" and "b:c").
 *
 * @example progressKey({ organizationId: "org_prairie", memberId: "mem_dana", screen: "import" })
 * // "progress:v1:org_prairie:mem_dana:import"
 */
export const progressKey = (scope: ProgressScope): string =>
  ["progress", "v1", scope.organizationId, scope.memberId, scope.screen].map(escapePart).join(":")

// Only the separator and the escape character are escaped: injective, and unlike encodeURIComponent it never throws
// (a lone surrogate in an id made it throw; the property test found it).
const escapePart = (part: string): string => part.replaceAll("%", "%25").replaceAll(":", "%3A")

const RowDecision = S.Struct({
  out: S.optionalKey(S.Boolean),
  kept: S.optionalKey(S.Boolean),
  accepted: S.String.pipe(S.Array, S.optionalKey),
  reverted: S.String.pipe(S.Array, S.optionalKey),
  edits: S.optionalKey(S.Record(S.String, S.String))
})

const StoredStep = S.Struct({
  label: S.String,
  before: S.Array(S.Tuple([S.String, S.NullOr(RowDecision)])),
  focus: S.NullOr(S.String)
})

/**
 * The review region's decisions, undo history and redo history as stored (`ReviewDraft`). `redo` is optional so a
 * draft saved before redo existed still decodes, with nothing to redo.
 */
export const StoredReview = S.Struct({
  decisions: S.Record(S.String, RowDecision),
  undo: S.Array(StoredStep),
  redo: StoredStep.pipe(S.Array, S.optionalKey)
}).annotate({ description: "The person's decisions on the review and the undo and redo history behind them." })

/** The file the person chose, so the screen can say which one and read it again from IndexedDB. */
export const StoredFile = S.Struct({
  name: S.String,
  size: S.Int,
  lastModified: S.Finite,
  sheet: S.NullOr(S.String).annotateKey({ description: "The sheet the person picked, null for the first read." })
})

/** Everything a screen keeps for one person: the step, the file, the decisions, and a count to offer "Continue" by. */
export const SavedProgress = S.Struct({
  version: S.Literal(1),
  step: S.String.annotateKey({ description: "The step the person was on, as in `?step=`." }),
  file: S.NullOr(StoredFile),
  review: S.NullOr(StoredReview),
  decided: S.Int.annotateKey({ description: 'Rows the person has decided, for "3 of 7 decided".' }),
  needed: S.Int.annotateKey({ description: "Rows that needed a decision when the file was read." }),
  savedAt: S.String.annotateKey({ description: "When it was last saved, ISO 8601." })
}).annotate({ description: "What one person has done so far on one screen." })
export type SavedProgress = typeof SavedProgress.Type

const decode = S.decodeUnknownOption(S.fromJsonString(SavedProgress))
const encode = S.encodeOption(S.fromJsonString(SavedProgress))

/** The part of the Web Storage interface (localStorage) the progress needs, so a test can hand in its own. */
export interface ProgressStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Reads the progress stored under `key`, dropping it when it no longer decodes. */
export const readAt = (storage: ProgressStorage, key: string): SavedProgress | undefined => {
  const text = storage.getItem(key)
  if (text === null) return undefined
  const found = decode(text)
  if (found._tag === "Some") return found.value
  storage.removeItem(key)
  return undefined
}

/** Writes the progress under `key`. False when the browser refused (a private window, a full disk). */
export const writeAt = (storage: ProgressStorage, key: string, progress: SavedProgress): boolean => {
  const text = encode(progress)
  if (text._tag === "None") return false
  try {
    storage.setItem(key, text.value)
    return true
  } catch {
    return false
  }
}

/**
 * Reads the progress of one scope. Absent, unreadable or from an older version: undefined, and the stored text is
 * removed, so a broken draft never comes back.
 */
export const readProgress = (storage: ProgressStorage, scope: ProgressScope): SavedProgress | undefined =>
  readAt(storage, progressKey(scope))

/** Writes the progress of one scope. False when the browser refused (a private window, a full disk). */
export const writeProgress = (storage: ProgressStorage, scope: ProgressScope, progress: SavedProgress): boolean =>
  writeAt(storage, progressKey(scope), progress)

/** Removes the progress of one scope. */
export const clearProgress = (storage: ProgressStorage, scope: ProgressScope): void =>
  storage.removeItem(progressKey(scope))

/** The decisions handed out by the review region, as stored, undo history included. */
export const storedReview = (decisions: SavedDecisions): ReviewDraft => toDraft(decisions)

/** Stored decisions, ready to hand back to the review region as `savedDecisions`, undo history included. */
export const restoredDecisions = (review: ReviewDraft): SavedDecisions => fromDraft(review)

/** Progress before anything was done: the first save starts from it. */
export const blank: SavedProgress = {
  version: 1,
  step: "upload",
  file: null,
  review: null,
  decided: 0,
  needed: 0,
  savedAt: ""
}
