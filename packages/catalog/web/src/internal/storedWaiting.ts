// One import's waiting rows as this browser keeps them: the stored form of the draft's `Waiting`, with the rows on hold
// and the values the server may hold of each row. The one thing not to break: what a reload reads back is what the
// draft kept, holds and values seen included; a G2 hold after a reload and a refused row across one rest on it.
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { RowDecision } from "@inventory/catalog-contract/Decision"
import { Hold, type HeldRow, type Waiting } from "../Draft.machine.ts"

/** Why a row is held, as this browser keeps it: refused, decided elsewhere since, or decided otherwise by a gone tab. */
const StoredHold = S.Union([
  S.Struct({ kind: S.tag("refused"), reason: S.String }),
  S.Struct({ kind: S.tag("elsewhere"), theirs: S.OptionFromNullOr(RowDecision) }),
  S.Struct({ kind: S.tag("othertab"), thisTab: S.OptionFromNullOr(RowDecision) })
])
  .annotate({ description: "Why one of the person's rows is held, as this browser keeps it" })
  .pipe(S.toTaggedUnion("kind"))

/** One row on hold as this browser keeps it. */
const StoredHeld = S.Struct({ mine: S.OptionFromNullOr(RowDecision), madeOn: S.Int, why: StoredHold }).annotate({
  description: "One of the person's rows on hold, as this browser keeps it"
})

/**
 * One import's waiting rows as this browser keeps them. Read too as an older page of the app kept them: one revision
 * for all the rows (`madeOn` a number), no count of confirms, no values seen and no rows on hold.
 */
export const StoredWaiting = S.Struct({
  madeOn: S.Union([S.Int, S.Record(S.String, S.Int)]),
  confirms: S.Int.pipe(S.NullOr, S.optionalKey),
  leftOver: S.Boolean,
  rows: S.Record(S.String, S.OptionFromNullOr(RowDecision)),
  seen: S.Record(S.String, RowDecision.pipe(S.OptionFromNullOr, S.Array)).pipe(S.optionalKey),
  held: S.Record(S.String, StoredHeld).pipe(S.optionalKey)
})
  .pipe(S.OptionFromNullOr)
  .annotate({ description: "One import's waiting rows as this browser keeps them; none is no entry" })
/** The decoded value of `StoredWaiting`. */
export type StoredWaiting = typeof StoredWaiting.Type

/** The draft's waiting rows from what this browser kept. */
export const toWaiting = (stored: StoredWaiting): O.Option<Waiting> =>
  O.map(stored, (entry) => {
    const made = entry.madeOn
    return {
      rows: entry.rows,
      madeOn: P.isNumber(made) ? R.map(entry.rows, () => made) : made,
      confirms: O.fromNullishOr(entry.confirms),
      leftOver: entry.leftOver,
      seen: entry.seen ?? {},
      held: R.map(entry.held ?? {}, (held): HeldRow => ({
        mine: held.mine,
        madeOn: held.madeOn,
        why: StoredHold.match(held.why, {
          refused: ({ reason }) => Hold.Refused({ reason }),
          elsewhere: ({ theirs }) => Hold.Elsewhere({ theirs }),
          othertab: ({ thisTab }) => Hold.OtherTab({ thisTab })
        })
      }))
    }
  })

/** The draft's waiting rows as this browser keeps them. */
export const toStored = (waits: O.Option<Waiting>): StoredWaiting =>
  O.map(waits, (entry) => ({
    madeOn: entry.madeOn,
    confirms: O.getOrNull(entry.confirms),
    leftOver: entry.leftOver,
    rows: entry.rows,
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
              OtherTab: ({ thisTab }) => ({ kind: "othertab" as const, thisTab })
            })
          }))
        })
  }))

const asText = S.fromJsonString(StoredWaiting)
const decodeText = S.decodeUnknownOption(asText)
const encodeText = S.encodeOption(asText)

/**
 * Waiting rows read from the text this browser keeps under their key: none where there is none or it cannot be read.
 * For a read that must see the browser's storage as it is now (another tab may have changed it since this page read).
 */
export const waitingFromText = (text: string | null): O.Option<Waiting> =>
  text === null ? O.none() : O.flatMap(decodeText(text), toWaiting)

/**
 * The waiting rows as they come back after a reload: written as this browser keeps them, and read again.
 *
 * @example keptForm(waiting(draft)) // what `Opened` finds after the page is loaded again
 */
export const keptForm = (waits: O.Option<Waiting>): O.Option<Waiting> =>
  waits.pipe(toStored, encodeText, O.flatMap(waitingFromText))
