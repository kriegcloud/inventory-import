// Where one upload stands, as the screen shows it: the states between choosing a file and its review, and how far
// along each is. The one thing a reader must not break: an upload is not an import. Its rows are kept apart until
// every piece has arrived and been checked, and only then become an import, whole, in one step.
import { LiteralKit } from "@beep/schema/LiteralKit"
import { FileProblem } from "@inventory/catalog-contract/FileProblem"
import { ImportId } from "@inventory/catalog-contract/Ids"
import * as Tuple from "effect/Tuple"
import * as S from "effect/Schema"

/** What is known of how many rows a file has while it is read. */
export const RowEstimateKind = LiteralKit(["unknown", "about", "counted"]).annotate({
  description: "Nothing yet, an estimate, or a count"
})

const RowsUnknown = S.Struct({ kind: S.tag("unknown") }).annotate({
  description: "Nobody can say yet: a workbook that is still being opened"
})
const RowsAbout = S.Struct({
  kind: S.tag("about"),
  n: S.Int.annotateKey({ description: "The estimate, worked out from how much of a CSV has been read" })
}).annotate({ description: 'An estimate: the screen says "about"' })
const RowsCounted = S.Struct({
  kind: S.tag("counted"),
  n: S.Int.annotateKey({ description: "The count: a workbook once it is open, a CSV once all of it is read" })
}).annotate({ description: "A count" })

/** How many rows a file has, as far as it is known: not yet, about so many, or exactly so many. */
export const RowEstimate = RowEstimateKind.mapMembers(() => Tuple.make(RowsUnknown, RowsAbout, RowsCounted)).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({ description: "How many rows a file has, as far as it is known" })
)
/** The decoded value of `RowEstimate`. */
export type RowEstimate = typeof RowEstimate.Type

/**
 * The estimate a reader's progress says. The reader runs in a worker and reports plain fields (`rowsAbout`, null
 * while unknown, and `exact`), because nothing with a tag survives the way back.
 *
 * @example rowsOf({ rowsAbout: 49600, exact: false }) // { kind: "about", n: 49600 }
 */
export const rowsOf = (progress: { readonly rowsAbout: number | null; readonly exact: boolean }): RowEstimate =>
  progress.rowsAbout === null
    ? { kind: "unknown" }
    : progress.exact
      ? { kind: "counted", n: progress.rowsAbout }
      : { kind: "about", n: progress.rowsAbout }

/**
 * Where one upload stands, as the screen shows it. Each state carries only what is needed to say so in words and
 * numbers; `progressOf` turns it into a bar.
 */
export const UploadState = S.TaggedUnion({
  /** Nothing chosen, or the last upload finished, failed or was cancelled. */
  Idle: {},
  Reading: {
    fileName: S.String,
    rowsRead: S.Int.annotateKey({ description: "Rows of the file read so far, heading and blank rows included" }),
    rows: RowEstimate
  },
  Saving: {
    fileName: S.String,
    uploadId: ImportId,
    rowsSaved: S.Int.annotateKey({ description: "Rows in the pieces the server has acknowledged, each piece once" }),
    rows: S.Int.annotateKey({ description: "Data rows in the file: what will be staged" })
  },
  /** Every piece arrived; the server is turning the upload into an import and preparing its review. */
  Preparing: { fileName: S.String, uploadId: ImportId, rows: S.Int },
  /** The person pressed Cancel: the reader is stopped and the server is deleting what arrived. */
  Cancelling: { fileName: S.String, uploadId: S.NullOr(ImportId) },
  /** The file itself cannot be staged, found by the reader or by the server: what is wrong and what to do. */
  Refused: { problem: FileProblem },
  /** Something that is not the file stopped it (the network, the server, the browser): the sentence says what to do. */
  Failed: {
    fileName: S.String,
    step: S.Literals(["read", "save"]).annotateKey({ description: "Reading the file, or saving it" }),
    message: S.String.annotateKey({ description: "What happened and what to do, for the person" })
  }
}).annotate({ description: "Where one upload stands, as the screen shows it" })
/** The decoded value of `UploadState`: where one upload stands, as the screen shows it. */
export type UploadState = typeof UploadState.Type

/**
 * How far an upload is, for a bar: `done` of `total`, where `total` is null while nobody can know it. `done` never
 * passes `total`: a CSV's estimate is raised to the rows already read, and saved rows are capped at the file's rows.
 *
 * @example progressOf({ state: { _tag: "Reading", fileName: "items.csv", rowsRead: 52000, rows: rowsOf({ rowsAbout: 50000, exact: false }) } })
 * // { done: 52000, total: 52000 }
 */
export const progressOf = (input: { readonly state: UploadState }): { done: number; total: number | null } =>
  UploadState.matchOrElse(
    input.state,
    {
      Reading: (state) => ({
        done: Math.max(0, state.rowsRead),
        total: state.rows.kind === "unknown" ? null : Math.max(state.rows.n, state.rowsRead, 0)
      }),
      Saving: (state) => ({ done: Math.min(Math.max(0, state.rowsSaved), state.rows), total: state.rows }),
      Preparing: (state) => ({ done: state.rows, total: state.rows })
    },
    () => ({ done: 0, total: null })
  )

/**
 * The file an upload is of, as its state names it; none while nothing is chosen.
 *
 * @example fileNameOf({ _tag: "Preparing", fileName: "items_messy.csv", uploadId, rows: 200 }) // "items_messy.csv"
 */
export const fileNameOf: (state: UploadState) => string = UploadState.match({
  Idle: () => "",
  Refused: (state) => state.problem.fileName,
  Reading: (state) => state.fileName,
  Saving: (state) => state.fileName,
  Preparing: (state) => state.fileName,
  Cancelling: (state) => state.fileName,
  Failed: (state) => state.fileName
})

/** True while Cancel still stops something: the file is being read or its rows saved. */
export const isStoppable = UploadState.isAnyOf(["Reading", "Saving"])

/** True from the moment a file is chosen until its upload has ended: arrived, cancelled, failed or refused. */
export const isBusy = (state: UploadState): boolean => !UploadState.isAnyOf(["Idle", "Failed", "Refused"])(state)
