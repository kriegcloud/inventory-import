// An upload as the browser sends it: its start, its pieces, and what cancelling one answers. An upload is not an
// import: its rows are kept apart until every piece has arrived, and only then become an import, in one step.
import { Tuple } from "effect"
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema/LiteralKit"
import { UploadKey } from "../Catalog.id.ts"
import { StagedHead, StagedRow } from "./Staged.read.ts"

/** Rows in one piece of an upload, and in one stored chunk of an import: the two are the same chunks. */
export const chunkRows = 500

/** The two things cancelling an upload can come to. */
export const UploadDiscardKind = LiteralKit(["discarded", "nothingToDiscard"]).annotate({
  identifier: "UploadDiscardKind",
  description: "An unfinished upload was deleted, or there was none (it had finished, or was already gone)"
})

class UploadDiscarded extends S.Opaque<UploadDiscarded, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("discarded") }).annotate({
    identifier: "UploadDiscarded",
    description: "The unfinished upload and every piece that arrived were deleted"
  })
) {}

class NothingToDiscard extends S.Opaque<NothingToDiscard, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("nothingToDiscard") }).annotate({
    identifier: "NothingToDiscard",
    description: "There was no unfinished upload: it had finished, or was already gone"
  })
) {}

/** What cancelling an upload came to. */
export const UploadDiscard = UploadDiscardKind.mapMembers(() => Tuple.make(UploadDiscarded, NothingToDiscard)).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({ identifier: "UploadDiscard", description: "Whether an unfinished upload was deleted" })
)
/** The decoded value of `UploadDiscard`. */
export type UploadDiscard = typeof UploadDiscard.Type

/** What cancelling an upload came to, from whether one was deleted. */
export const uploadDiscard = (deleted: boolean): UploadDiscard =>
  deleted ? UploadDiscarded.make({}) : NothingToDiscard.make({})

/** The start of an upload: the file without its rows, and how many rows will follow in how many pieces. */
export const UploadStart = S.Struct({
  key: UploadKey.annotateKey({
    description:
      "Chosen by the browser for this one file: a begin sent again with the same key (a retry after a lost answer) " +
      "is the same upload, not a second one"
  }),
  head: StagedHead,
  rowCount: S.Int.annotateKey({ description: "Data rows the pieces will carry in all", examples: [13] }),
  chunkCount: S.Int.annotateKey({ description: "Pieces that will follow, numbered from 0", examples: [1] })
}).annotate({
  identifier: "UploadStart",
  description: "The start of an upload: the file without its rows, and how many rows will follow in how many pieces"
})
/** The decoded value of `UploadStart`: the start of an upload. */
export type UploadStart = typeof UploadStart.Type

/**
 * One piece of an upload's rows, in file order. `seq` is its place; sending the same piece again stores nothing new,
 * so a piece whose answer was lost on the network can simply be sent again.
 */
export const UploadChunk = S.Struct({
  seq: S.Int.check(S.isGreaterThanOrEqualTo(0)).annotateKey({
    description: "The piece's place in the file, from 0: sending a piece again with the same number stores it once",
    examples: [0]
  }),
  rows: S.Array(StagedRow)
    .check(S.isMinLength(1), S.isMaxLength(chunkRows))
    .annotateKey({ description: `The piece's rows, in file order: 1 to ${chunkRows}` })
}).annotate({ identifier: "UploadChunk", description: "One piece of an upload's rows, in file order" })
/** The decoded value of `UploadChunk`: one piece of an upload's rows, in file order. */
export type UploadChunk = typeof UploadChunk.Type
