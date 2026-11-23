// The ids of the catalog: an import, an item, one confirm, one suggestion, the key a browser gives an upload, and
// the id of one item of a file. Each is branded, so one cannot stand in for another, and checked, so a request
// cannot send an id no row could have: a malformed one is refused as a 400 naming it, before any lookup.
import * as S from "effect/Schema"

const Uuid = S.String.check(S.isUUID())

/** An import: the id its upload was given, kept once the upload has finished. */
export const ImportId = Uuid.pipe(
  S.brand("ImportId"),
  S.annotate({ identifier: "ImportId", description: "An import's id: the id its upload was given" })
)
/** The decoded value of `ImportId`. */
export type ImportId = typeof ImportId.Type

/** A stored item. */
export const ItemId = Uuid.pipe(
  S.brand("ItemId"),
  S.annotate({ identifier: "ItemId", description: "A stored item's id, given when an import created it" })
)
/** The decoded value of `ItemId`. */
export type ItemId = typeof ItemId.Type

/** One confirm of an import: what a take-back names. Stored as `batchId`. */
export const ConfirmId = Uuid.pipe(
  S.brand("ConfirmId"),
  S.annotate({ identifier: "ConfirmId", description: "One confirm of an import: what a take-back names" })
)
/** The decoded value of `ConfirmId`. */
export type ConfirmId = typeof ConfirmId.Type

/** One stored suggestion. */
export const SuggestionId = Uuid.pipe(
  S.brand("SuggestionId"),
  S.annotate({ identifier: "SuggestionId", description: "A stored suggestion's id" })
)
/** The decoded value of `SuggestionId`. */
export type SuggestionId = typeof SuggestionId.Type

/** The key a browser chooses for one file, so a begin sent twice is one upload. */
export const UploadKey = S.String.check(S.isMinLength(1), S.isMaxLength(64)).pipe(
  S.brand("UploadKey"),
  S.annotate({
    identifier: "UploadKey",
    description: "Chosen by the browser for one file: a begin sent again with the same key is the same upload"
  })
)
/** The decoded value of `UploadKey`. */
export type UploadKey = typeof UploadKey.Type

/** A row id's form: `row-` and the row's number, then `.` and the part when the row holds several items. */
export const rowIdPattern = /^row-[1-9][0-9]{0,6}(\.[1-9][0-9]{0,3})?$/

/**
 * One item of a file, as the review, the saved decisions and the confirm name it: its row's number, and its part
 * when the row holds several items ("row-56", "row-8.2").
 */
export const RowId = S.String.check(S.isPattern(rowIdPattern))
  .annotate({ examples: ["row-7"] })
  .pipe(
    S.brand("RowId"),
    S.annotate({
      identifier: "RowId",
      description: "One item of a file: its row's number, and its part when the row holds several"
    })
  )
/** The decoded value of `RowId`. */
export type RowId = typeof RowId.Type
