// What the person has done so far on a screen, kept in this browser so a hard refresh or a closed tab never makes
// them repeat it: the step they were on, the file they chose, and their decisions with the undo history behind them.
// The rules this file protects: progress belongs to one person in one organization (another member, or the same person
// in another organization, never sees it); what is read back is decoded, so a draft from an older version is never
// shown half (it reads as none, and the next write replaces it); and Confirm clears it. The decisions are small and
// go to localStorage through an atom per key (`SavedProgress.hook.ts`); the file itself is a Blob in IndexedDB,
// written once when it is chosen and read again by the worker on return.
import * as S from "effect/Schema"
import * as A from "effect/Array"
import type * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { ReviewDecisionFromFlags, RowKey } from "@inventory/review/ReviewDecision"
import { fromDraft, toDraft } from "@inventory/review/ReviewDraft"
import { DraftStep, ReviewDraft } from "@inventory/review/ReviewTypes"
import type { ReviewState } from "@inventory/review/ReviewTypes"
import { $ReviewId } from "./internal/identity.ts"

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
  A.join(A.map(["progress", "v1", scope.organizationId, scope.memberId, scope.screen], escapePart), ":")

// Only the separator and the escape character are escaped: injective, and unlike encodeURIComponent it never throws
// (a lone surrogate in an id made it throw; the property test found it).
const escapePart = (part: string): string => part.replaceAll("%", "%25").replaceAll(":", "%3A")

const $I = $ReviewId.create("SavedProgress")

/** One step of the undo or redo history as stored: the rows' decisions before it, and where focus returns. */
export class StoredStep extends S.Opaque<StoredStep, { readonly brand: unique symbol }>()(
  S.Struct({
    label: S.String.check(S.isMinLength(1), S.isMaxLength(200)).pipe(
      S.annotateKey({ description: "What the step did, in the words its undo button says" })
    ),
    before: S.Array(S.Tuple([RowKey, S.OptionFromNullOr(ReviewDecisionFromFlags)])).pipe(
      S.annotateKey({ description: "The decisions the step's rows had before it; null for a row with none" })
    ),
    focus: S.OptionFromNullOr(RowKey).pipe(S.annotateKey({ description: "The row focus returns to; null for none" }))
  }).pipe($I.annoteSchema("StoredStep", { description: "One step of the undo or redo history" }))
) {}

/**
 * The review region's decisions, undo history and redo history as stored (`ReviewDraft`). `redo` is optional on the
 * stored side so a draft saved before redo existed still decodes, with nothing to redo.
 */
export class StoredReview extends S.Opaque<StoredReview, { readonly brand: unique symbol }>()(
  S.Struct({
    decisions: S.Record(RowKey, ReviewDecisionFromFlags).pipe(
      S.annotateKey({ description: "Each row's decision, by row id" })
    ),
    undo: S.Array(StoredStep)
      .check(S.isMaxLength(200))
      .pipe(S.annotateKey({ description: "The steps an undo takes back, the latest last" })),
    redo: S.Array(StoredStep)
      .check(S.isMaxLength(200))
      .pipe(
        S.annotateKey({ description: "The steps a redo puts back, the latest last" }),
        S.withDecodingDefaultTypeKey(Effect.succeed([])),
        S.withConstructorDefault(Effect.succeed([]))
      )
  }).pipe(
    $I.annoteSchema("StoredReview", {
      description: "The person's decisions on the review and the undo and redo history behind them"
    })
  )
) {}

/** The file the person chose, so the screen can say which one and read it again from IndexedDB. */
export class StoredFile extends S.Opaque<StoredFile, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.check(S.isMinLength(1), S.isMaxLength(255)).pipe(
      S.annotateKey({ description: "The file's name as it was chosen" })
    ),
    size: S.ByteSizeFromNumber.pipe(S.annotateKey({ description: "The file's size" })),
    lastModified: S.DateTimeUtcFromMillis.pipe(S.annotateKey({ description: "When the file was last changed" })),
    sheet: S.OptionFromNullOr(S.String.check(S.isMinLength(1), S.isMaxLength(200))).pipe(
      S.annotateKey({ description: "The sheet the person picked; null for the first read" })
    )
  }).pipe($I.annoteSchema("StoredFile", { description: "The file the person chose" }))
) {}

/** The step a screen was on, as in `?step=`. */
export const ProgressStep = S.String.check(S.isMinLength(1), S.isMaxLength(32), S.isPattern(/^[a-z-]+$/)).pipe(
  $I.annoteSchema("ProgressStep", { description: "The step the person was on, as in ?step=", examples: ["review"] })
)

const Count = S.Int.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(1_000_000))

/** Everything a screen keeps for one person: the step, the file, the decisions, and a count to offer "Continue" by. */
export class SavedProgress extends S.Opaque<SavedProgress, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.Literal(1).pipe(S.annotateKey({ description: "The stored format's version" })),
    step: ProgressStep.pipe(S.annotateKey({ description: "The step the person was on" })),
    file: S.OptionFromNullOr(StoredFile).pipe(S.annotateKey({ description: "The file chosen; null for none" })),
    review: S.OptionFromNullOr(StoredReview).pipe(
      S.annotateKey({ description: "The decisions and their history; null before the review" })
    ),
    decided: Count.pipe(S.annotateKey({ description: 'Rows the person has decided, for "3 of 7 decided"' })),
    needed: Count.pipe(S.annotateKey({ description: "Rows that needed a decision when the file was read" })),
    savedAt: S.DateTimeUtcFromString.pipe(S.annotateKey({ description: "When it was last saved" }))
  }).pipe($I.annoteSchema("SavedProgress", { description: "What one person has done so far on one screen" }))
) {
  /** Progress at its first save: the upload step, nothing chosen or decided yet. */
  static readonly first = (savedAt: DateTime.Utc): SavedProgress =>
    SavedProgress.make({
      version: 1,
      step: "upload",
      file: O.none(),
      review: O.none(),
      decided: 0,
      needed: 0,
      savedAt
    })
}

const toStoredStep = (step: DraftStep): StoredStep =>
  StoredStep.make({
    label: step.label,
    before: step.before,
    focus: step.focus
  })

const fromStoredStep = (step: StoredStep): DraftStep =>
  DraftStep.make({
    label: step.label,
    before: step.before,
    focus: step.focus
  })

/** The review region's decisions with their undo and redo history, as stored. */
export const storedReview = (state: ReviewState): StoredReview => {
  const draft = toDraft(state)
  return StoredReview.make({
    decisions: draft.decisions,
    undo: A.map(draft.undo, toStoredStep),
    redo: A.map(draft.redo, toStoredStep)
  })
}

/** A stored review as the region's decisions hold it: where the region starts again, its history with it. */
export const restoredReview = (review: StoredReview): ReviewState =>
  fromDraft(
    ReviewDraft.make({
      decisions: review.decisions,
      undo: A.map(review.undo, fromStoredStep),
      redo: A.map(review.redo, fromStoredStep)
    })
  )
