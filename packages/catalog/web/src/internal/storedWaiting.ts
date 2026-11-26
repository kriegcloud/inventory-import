// One import's waiting rows as this browser keeps them: the stored form of the draft's `Waiting`. The one thing not to
// break: what a reload reads back is what the draft kept, every side of every line and what each may be written over
// included; and what an older page of the app kept still reads, so nothing it kept is lost.
import * as A from "effect/Array"
import { dual, identity } from "effect/Function"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { emptyWhenLeftOut } from "@inventory/kernel/Wire"
import { RowDecision } from "@inventory/catalog-contract/Decision"
import type { Line, Side, Waiting } from "../Draft.machine.ts"

const StoredDecision = S.OptionFromNullOr(RowDecision)

/** Several decisions of a row, as this browser keeps them. */
const StoredSeveral = StoredDecision.pipe(S.Array)

/** One decision of one row, as this browser keeps it. */
const StoredSide = S.Struct({
  decision: StoredDecision,
  madeOn: S.Int,
  dates: emptyWhenLeftOut(S.Record(S.String, S.Int), { empty: {}, isEmpty: R.isEmptyReadonlyRecord }),
  seen: StoredSeveral,
  here: S.Boolean,
  overtaken: S.Boolean,
  refused: S.OptionFromNullOr(S.String)
}).annotate({ description: "One decision of a row of the person's the server has not taken, as this browser keeps it" })

/** One row's line as this browser keeps it: `theirs` left out where nobody decided the row since. */
const StoredLine = S.Struct({
  sides: S.Array(StoredSide),
  theirs: StoredDecision.pipe(S.OptionFromOptionalKey)
}).annotate({
  description: "One row's line above the review, as this browser keeps it"
})

/** A closed tab's decision on a row's line, as an older page kept it. */
const OlderClosed = S.Struct({
  decision: StoredDecision,
  madeOn: S.Int,
  seen: S.OptionFromNullOr(StoredSeveral),
  refused: S.OptionFromNullOr(S.String)
}).annotate({ description: "A closed tab's decision on a row's line, as an older page kept it" })

/** Why a row was held, as an older page kept it. */
const OlderHold = S.Union([
  S.Struct({ kind: S.tag("refused"), reason: S.String }),
  S.Struct({ kind: S.tag("elsewhere"), theirs: StoredDecision }),
  S.Struct({ kind: S.tag("othertab"), thisTab: StoredDecision.pipe(S.OptionFromOptionalKey) })
])
  .annotate({ description: "Why one of the person's rows was held, as an older page kept it" })
  .pipe(S.toTaggedUnion("kind"))

/** One row on hold, as an older page kept it. */
const OlderHeld = S.Struct({
  mine: StoredDecision,
  madeOn: S.Int,
  why: OlderHold,
  closed: OlderClosed.pipe(S.Array, S.OptionFromOptionalKey)
}).annotate({ description: "One of the person's rows on hold, as an older page kept it" })

/**
 * One import's waiting rows as this browser keeps them: what waits (`waits`), the lines, and what was left over
 * (`rows`, `beside`, `theirs`). Read too as an older page of the app kept them: what waited in `rows`, with one revision
 * for all of them or one each (`madeOn`), the values seen apart, and the rows on hold (`held`).
 */
export const StoredWaiting = S.Struct({
  waits: S.Record(S.String, StoredSide).pipe(S.optionalKey),
  lines: S.Record(S.String, StoredLine).pipe(S.optionalKey),
  confirms: S.Int.pipe(S.NullOr, S.optionalKey),
  leftOver: S.Boolean,
  rows: S.Record(S.String, StoredDecision),
  beside: S.Record(S.String, StoredSeveral).pipe(S.optionalKey),
  theirs: S.Record(S.String, StoredDecision).pipe(S.optionalKey),
  madeOn: S.Union([S.Int, S.Record(S.String, S.Int)]),
  seen: S.Record(S.String, StoredSeveral).pipe(S.optionalKey),
  held: S.Record(S.String, OlderHeld).pipe(S.optionalKey),
  fileName: S.OptionFromOptionalKey(S.String)
})
  .pipe(S.OptionFromNullOr)
  .annotate({ description: "One import's waiting rows as this browser keeps them; none is no entry" })
/** The decoded value of `StoredWaiting`. */
export type StoredWaiting = typeof StoredWaiting.Type

const sideFrom = (stored: typeof StoredSide.Type): Side => ({
  ...stored,
  // Kept between visits, it waited.
  live: false
})

const sideTo = ({ dates, decision, here, madeOn, overtaken, refused, seen }: Side): typeof StoredSide.Type => ({
  decision,
  madeOn,
  dates,
  seen,
  here,
  overtaken,
  refused
})

/** A decision an older page kept; where it kept no values seen, the server may hold nothing of the row. */
const olderSide = (parts: {
  readonly decision: Side["decision"]
  readonly madeOn: number
  readonly seen: O.Option<Side["seen"]>
  readonly here: boolean
  readonly overtaken: boolean
  readonly refused: O.Option<string>
}): Side => ({
  decision: parts.decision,
  madeOn: parts.madeOn,
  dates: {},
  seen: O.getOrElse(parts.seen, (): Side["seen"] => [O.none()]),
  live: false,
  here: parts.here,
  overtaken: parts.overtaken,
  refused: parts.refused
})

/**
 * One row on hold as an older page kept it, as its line. A gone tab's decision held beside this tab's own is told by
 * what is not there: kept as the row's own, with this tab's in `thisTab` or (older still) only among the rows that
 * waited, it has no closed tabs' decisions beside it.
 */
const olderLine = (input: {
  readonly held: typeof OlderHeld.Type
  readonly seen: O.Option<Side["seen"]>
  /** This tab's own decision of the row waited beside it. */
  readonly waits: boolean
}): Line => {
  const { held, seen, waits } = input
  const closed = A.map(O.match(held.closed, { onNone: A.empty, onSome: identity }), (one) =>
    olderSide({ ...one, here: false, overtaken: false })
  )
  const own = (parts: { readonly overtaken: boolean; readonly refused: O.Option<string> }): ReadonlyArray<Side> => [
    olderSide({ decision: held.mine, madeOn: held.madeOn, seen, here: true, ...parts }),
    ...closed
  ]
  const gone = (refused: O.Option<string>): ReadonlyArray<Side> => [
    olderSide({ decision: held.mine, madeOn: held.madeOn, seen: O.none(), here: false, overtaken: false, refused }),
    ...closed
  ]
  return OlderHold.match(held.why, {
    refused: ({ reason }): Line => ({
      sides: waits ? gone(O.some(reason)) : own({ overtaken: false, refused: O.some(reason) }),
      theirs: O.none()
    }),
    elsewhere: ({ theirs }) => ({ sides: own({ overtaken: true, refused: O.none() }), theirs: O.some(theirs) }),
    // This tab's own waits beside the line, or is saved: what is asked about is the others'.
    othertab: ({ thisTab }) => ({
      sides: O.isNone(thisTab) && A.isReadonlyArrayNonEmpty(closed) ? closed : gone(O.none()),
      theirs: O.none()
    })
  })
}

/** The draft's waiting rows from what this browser kept. */
export const toWaiting = (stored: StoredWaiting): O.Option<Waiting> =>
  O.map(stored, (entry): Waiting => {
    const confirms = O.fromNullishOr(entry.confirms)
    if (entry.leftOver) {
      const named = { rows: entry.rows, beside: entry.beside ?? {}, theirs: entry.theirs ?? {} }
      return { rows: {}, lines: {}, confirms, leftOver: O.some(named) }
    }
    const made = entry.madeOn
    const seenOf = (rowId: string): O.Option<Side["seen"]> => R.get(entry.seen ?? {}, rowId)
    const older = R.map(entry.rows, (decision, rowId) =>
      olderSide({
        decision,
        madeOn: P.isNumber(made) ? made : O.getOrElse(R.get(made, rowId), () => 0),
        seen: seenOf(rowId),
        here: true,
        overtaken: false,
        refused: O.none()
      })
    )
    const olderLines = R.map(entry.held ?? {}, (held, rowId) =>
      olderLine({ held, seen: seenOf(rowId), waits: R.has(older, rowId) })
    )
    const lines = R.map(entry.lines ?? {}, (line): Line => ({
      sides: A.map(line.sides, sideFrom),
      theirs: line.theirs
    }))
    return {
      rows: { ...older, ...R.map(entry.waits ?? {}, sideFrom) },
      lines: { ...olderLines, ...lines },
      confirms,
      leftOver: O.none()
    }
  })

/** The name of the import's file, as it was kept with the rows: none where an older page kept them. */
export const fileNameOf = (stored: StoredWaiting): O.Option<string> => O.flatMap(stored, (entry) => entry.fileName)

/** The draft's waiting rows as this browser keeps them, with the name of the import's file. */
export const toStored: {
  (fileName: O.Option<string>): (waits: O.Option<Waiting>) => StoredWaiting
  (waits: O.Option<Waiting>, fileName: O.Option<string>): StoredWaiting
} = dual(2, (waits: O.Option<Waiting>, fileName: O.Option<string>): StoredWaiting =>
  O.map(waits, (entry) => ({
    fileName,
    confirms: O.getOrNull(entry.confirms),
    madeOn: {},
    ...O.match(entry.leftOver, {
      onSome: (named) => ({ leftOver: true, ...named }),
      onNone: () => ({
        leftOver: false,
        rows: {},
        waits: R.map(entry.rows, sideTo),
        lines: R.map(entry.lines, (line) => ({
          sides: A.map(line.sides, sideTo),
          theirs: line.theirs
        }))
      })
    })
  }))
)

const asText = S.fromJsonString(StoredWaiting)
const decodeText = S.decodeUnknownOption(asText)
const encodeText = S.encodeOption(asText)

/**
 * Waiting rows read from the text this browser keeps under their key: none where there is none or it cannot be read.
 * For a read that must see the browser's storage as it is now (another tab may have changed it since this page read).
 */
export const waitingFromText = (text: string | null): O.Option<Waiting> => toWaiting(storedFromText(text))

/** The entry itself read from that text, with the name of the import's file: none where it cannot be read. */
export const storedFromText = (text: string | null): StoredWaiting =>
  text === null ? O.none() : O.flatten(decodeText(text))

/**
 * The waiting rows as they come back after a reload: written as this browser keeps them, and read again.
 *
 * @example keptForm(waiting(draft)) // what `Opened` finds after the page is loaded again
 */
export const keptForm = (waits: O.Option<Waiting>): O.Option<Waiting> =>
  waits.pipe(toStored(O.none()), encodeText, O.flatMap(waitingFromText))
