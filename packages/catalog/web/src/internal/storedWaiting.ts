// One import's waiting rows as this browser keeps them: the stored form of the draft's `Waiting`, with the rows on hold
// and the values the server may hold of each row. The one thing not to break: what a reload reads back is what the
// draft kept, holds and values seen included; a G2 hold after a reload and a refused row across one rest on it.
import * as A from "effect/Array"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { RowDecision } from "@inventory/catalog-contract/Decision"
import { type ClosedTab, Hold, type HeldRow, type Waiting } from "../Draft.machine.ts"

/** The values the server may have of a row, as this browser keeps them. */
const StoredSeen = RowDecision.pipe(S.OptionFromNullOr, S.Array)

/** A decision of a row made in a tab that is gone, as this browser keeps it on the row's line. */
const StoredClosed = S.Struct({
  decision: S.OptionFromNullOr(RowDecision),
  madeOn: S.Int,
  seen: S.OptionFromNullOr(StoredSeen),
  refused: S.OptionFromNullOr(S.String)
}).annotate({ description: "A decision of a row made in a closed tab of the person's, as this browser keeps it" })

/**
 * Why a row is held, as this browser keeps it: refused, decided elsewhere since, or decided otherwise by a gone tab. An
 * older page kept, for the last, the gone tab's decision as the row's own and this tab's beside it (`thisTab`).
 */
const StoredHold = S.Union([
  S.Struct({ kind: S.tag("refused"), reason: S.String }),
  S.Struct({ kind: S.tag("elsewhere"), theirs: S.OptionFromNullOr(RowDecision) }),
  S.Struct({ kind: S.tag("othertab"), thisTab: RowDecision.pipe(S.OptionFromNullOr, S.optionalKey) })
])
  .annotate({ description: "Why one of the person's rows is held, as this browser keeps it" })
  .pipe(S.toTaggedUnion("kind"))

/** One row on hold as this browser keeps it: an older page kept no closed tabs' decisions with it. */
const StoredHeld = S.Struct({
  mine: S.OptionFromNullOr(RowDecision),
  madeOn: S.Int,
  why: StoredHold,
  closed: StoredClosed.pipe(S.Array, S.optionalKey)
}).annotate({
  description: "One of the person's rows on hold, as this browser keeps it"
})

/**
 * One import's waiting rows as this browser keeps them. Read too as an older page of the app kept them: one revision
 * for all the rows (`madeOn` a number), no count of confirms, no values seen, no rows on hold and no file name.
 */
export const StoredWaiting = S.Struct({
  madeOn: S.Union([S.Int, S.Record(S.String, S.Int)]),
  confirms: S.Int.pipe(S.NullOr, S.optionalKey),
  leftOver: S.Boolean,
  rows: S.Record(S.String, S.OptionFromNullOr(RowDecision)),
  beside: S.Record(S.String, StoredSeen).pipe(S.optionalKey),
  seen: S.Record(S.String, StoredSeen).pipe(S.optionalKey),
  held: S.Record(S.String, StoredHeld).pipe(S.optionalKey),
  fileName: S.optionalKey(S.String)
})
  .pipe(S.OptionFromNullOr)
  .annotate({ description: "One import's waiting rows as this browser keeps them; none is no entry" })
/** The decoded value of `StoredWaiting`. */
export type StoredWaiting = typeof StoredWaiting.Type

/**
 * One row on hold from what this browser kept. What an older page kept of a gone tab's decision beside this tab's own
 * reads as the same line: this tab's decision is the row's, and the gone tab's is on it, refused where it was.
 */
const toHeld = (input: {
  readonly held: typeof StoredHeld.Type
  /** This tab's own decision of the row, kept waiting beside the line. */
  readonly own: O.Option<{ readonly decision: O.Option<RowDecision>; readonly madeOn: O.Option<number> }>
}): HeldRow => {
  const { held, own } = input
  const closed: ReadonlyArray<ClosedTab> = held.closed ?? []
  const beside = (mine: O.Option<RowDecision>, refused: O.Option<string>): HeldRow => ({
    mine,
    madeOn: O.getOrElse(
      O.flatMap(own, (waits) => waits.madeOn),
      () => held.madeOn
    ),
    why: Hold.OtherTab(),
    closed: [...closed, { decision: held.mine, madeOn: held.madeOn, seen: O.none(), refused }]
  })
  const as = (why: Hold): HeldRow => ({ mine: held.mine, madeOn: held.madeOn, why, closed })
  return StoredHold.match(held.why, {
    refused: ({ reason }) =>
      O.match(own, {
        onNone: () => as(Hold.Refused({ reason })),
        onSome: (waits) => beside(waits.decision, O.some(reason))
      }),
    elsewhere: ({ theirs }) => as(Hold.Elsewhere({ theirs })),
    othertab: ({ thisTab }) => (thisTab === undefined ? as(Hold.OtherTab()) : beside(thisTab, O.none()))
  })
}

/** The draft's waiting rows from what this browser kept. */
export const toWaiting = (stored: StoredWaiting): O.Option<Waiting> =>
  O.map(stored, (entry) => {
    const made = entry.madeOn
    const madeOn = P.isNumber(made) ? R.map(entry.rows, () => made) : made
    return {
      rows: entry.rows,
      madeOn,
      confirms: O.fromNullishOr(entry.confirms),
      leftOver: entry.leftOver,
      beside: entry.beside ?? {},
      seen: entry.seen ?? {},
      held: R.map(entry.held ?? {}, (held, rowId) =>
        toHeld({
          held,
          own: O.map(R.get(entry.rows, rowId), (decision) => ({ decision, madeOn: R.get(madeOn, rowId) }))
        })
      )
    }
  })

/** The name of the import's file, as it was kept with the rows: none where an older page kept them. */
export const fileNameOf = (stored: StoredWaiting): O.Option<string> =>
  O.flatMap(stored, (entry) => O.fromNullishOr(entry.fileName))

/** The draft's waiting rows as this browser keeps them, with the name of the import's file. */
export const toStored: {
  (fileName: O.Option<string>): (waits: O.Option<Waiting>) => StoredWaiting
  (waits: O.Option<Waiting>, fileName: O.Option<string>): StoredWaiting
} = dual(2, (waits: O.Option<Waiting>, fileName: O.Option<string>): StoredWaiting =>
  O.map(waits, (entry) => ({
    ...O.match(fileName, { onNone: () => ({}), onSome: (name) => ({ fileName: name }) }),
    madeOn: entry.madeOn,
    confirms: O.getOrNull(entry.confirms),
    leftOver: entry.leftOver,
    rows: entry.rows,
    ...(R.isEmptyReadonlyRecord(entry.beside) ? {} : { beside: entry.beside }),
    ...(R.isEmptyReadonlyRecord(entry.seen) ? {} : { seen: entry.seen }),
    ...(R.isEmptyReadonlyRecord(entry.held)
      ? {}
      : {
          held: R.map(entry.held, (held) => ({
            mine: held.mine,
            madeOn: held.madeOn,
            why: Hold.$match(held.why, {
              Refused: ({ reason }) => ({ kind: "refused" as const, reason }),
              Elsewhere: ({ theirs }) => ({ kind: "elsewhere" as const, theirs }),
              OtherTab: () => ({ kind: "othertab" as const })
            }),
            ...(A.isReadonlyArrayNonEmpty(held.closed) ? { closed: held.closed } : {})
          }))
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
