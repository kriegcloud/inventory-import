// An upload as the browser sends it: its start, its pieces, and what cancelling one answers. An upload is not an
// import: its rows are kept apart until every piece has arrived, and only then become an import, in one step.
import * as Tuple from "effect/Tuple"
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as SchemaGetter from "effect/SchemaGetter"
import { UploadKey } from "../Catalog.id.ts"
import { maxStagedRows, StagedHead, StagedRow } from "./Staged.read.ts"

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
  S.annotate({ identifier: "UploadDiscard", description: "Whether an unfinished upload was deleted" }),
  S.toTaggedUnion("kind")
)
/** The decoded value of `UploadDiscard`. */
export type UploadDiscard = typeof UploadDiscard.Type

/** What cancelling an upload came to, from whether one was deleted. */
export const uploadDiscard = (deleted: boolean): UploadDiscard =>
  deleted ? UploadDiscarded.make({}) : NothingToDiscard.make({})

const UploadStartWire = S.Struct({
  key: UploadKey.annotateKey({
    description:
      "Chosen by the browser for this one file: a begin sent again with the same key (a retry after a lost answer) " +
      "is the same upload, not a second one"
  }),
  head: StagedHead,
  rowCount: S.Int.check(S.isBetween({ minimum: 1, maximum: maxStagedRows })).annotateKey({
    description: `Data rows the pieces will carry in all: 1 to ${maxStagedRows}, the most an import stages`,
    examples: [13]
  }),
  chunkCount: S.Int.check(S.isBetween({ minimum: 1, maximum: maxStagedRows })).annotateKey({
    description: `Pieces that will follow, numbered from 0: each carries one row at least and ${chunkRows} at most, so never more pieces than rows, nor fewer than the rows need`,
    examples: [1]
  })
}).check(
  // Named on `chunkCount`, so the 400 says which field: the pieces are what cannot carry the rows.
  S.makeFilter((start) =>
    piecesCarry(start)
      ? true
      : {
          path: ["chunkCount"],
          issue: `${start.chunkCount} pieces cannot carry ${start.rowCount} rows: each carries one row at least and ${chunkRows} at most`
        }
  )
)
type UploadStartShape = typeof UploadStartWire.Type

const isStartWire = S.is(UploadStartWire)

/**
 * True when the pieces can carry the rows: each piece one row at least and `chunkRows` at most.
 *
 * @example piecesCarry({ rowCount: 1200, chunkCount: 3 }) // true: pieces of 500, 500 and 200 rows
 * @example piecesCarry({ rowCount: 2, chunkCount: 3 }) // false: a piece would be empty
 */
export const piecesCarry = (start: { readonly rowCount: number; readonly chunkCount: number }): boolean =>
  start.chunkCount <= start.rowCount && start.chunkCount >= Math.ceil(start.rowCount / chunkRows)

// What a generated start is drawn from: the rows, and how many a piece carries. The pieces are then counted, so every
// start generated is one whose pieces carry its rows.
const UploadStartSource = S.Struct({
  key: UploadStartWire.fields.key,
  head: StagedHead,
  rowCount: UploadStartWire.fields.rowCount,
  perPiece: S.Int.check(S.isBetween({ minimum: 1, maximum: chunkRows }))
})

const PiecedStart = S.declare((input: unknown): input is UploadStartShape => isStartWire(input) && piecesCarry(input), {
  identifier: "PiecedStart",
  description: "A start whose pieces can carry its rows",
  expected: `a start whose pieces each carry one row at least and ${chunkRows} at most`,
  toCodecArbitrary: () =>
    S.link<UploadStartShape>()(UploadStartSource, {
      decode: SchemaGetter.transform((source: typeof UploadStartSource.Type) => ({
        key: source.key,
        head: source.head,
        rowCount: source.rowCount,
        chunkCount: Math.ceil(source.rowCount / source.perPiece)
      })),
      encode: SchemaGetter.forbiddenEncoding
    })
})

/**
 * The start of an upload: the file without its rows, and how many rows will follow in how many pieces. A start whose
 * pieces cannot carry its rows (an empty piece, or one over `chunkRows`) is refused before anything is stored.
 */
export const UploadStart = UploadStartWire.pipe(S.decodeTo(PiecedStart)).annotate({
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
  seq: S.Int.check(S.isBetween({ minimum: 0, maximum: maxStagedRows - 1 })).annotateKey({
    description: "The piece's place in the file, from 0: sending a piece again with the same number stores it once",
    examples: [0]
  }),
  rows: S.Array(StagedRow)
    .check(S.isMinLength(1), S.isMaxLength(chunkRows))
    .annotateKey({ description: `The piece's rows, in file order: 1 to ${chunkRows}` })
}).annotate({ identifier: "UploadChunk", description: "One piece of an upload's rows, in file order" })
/** The decoded value of `UploadChunk`: one piece of an upload's rows, in file order. */
export type UploadChunk = typeof UploadChunk.Type
