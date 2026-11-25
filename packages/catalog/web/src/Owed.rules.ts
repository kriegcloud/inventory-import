// What the person is owed: every decision she made stands somewhere in the draft (waiting, on its way, a side of its
// row's line, owed by a save nobody waits for any more, left over by a close) until the server's word says it was
// stored, she took it back herself, or she was told what became of it. This is one pure fold beside `step`: it reads
// its own ledger from the step before, the event, and the transition's answer, and nothing else (no server, no clock,
// no storage), so the same audit runs in a test's world and beside the browser's runner.
//
// The one thing a reader must not break: the audit judges the machine and never follows it. A decision the draft no
// longer holds leaves by one of the three exits, each on evidence the machine cannot make up (an answer by its id, her
// own press, a sentence said in this step); anything else is a fault, however sensible the machine's reason reads.
import * as A from "effect/Array"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { RowDecision, SavedDecisions } from "@inventory/catalog-contract/Decision"
import {
  type Draft,
  DraftEffect,
  DraftEvent,
  eachNamed,
  isUnsure,
  Keep,
  knownOf,
  leftByMatch,
  type LinePick,
  maySaved,
  type Named,
  type OfRow,
  partsNamed,
  partsOf,
  type RowChanges,
  Said,
  sameDecision,
  shown,
  type Side,
  type StaleAccept,
  type Stepped,
  type Waiting
} from "./Draft.machine.ts"
import { decisionWords, rowLabel } from "./internal/leftOver.ts"

// -- The ledger ------------------------------------------------------------------------------------------------------

const Decision = S.Option(RowDecision).annotate({
  description: "One row's decision, or none where the row has none: a decision with nothing in it reads as none"
})
type Decision = typeof Decision.Type

/** Why the server wrote nothing of a request. */
export const NotWrittenWhy = S.Literals(["refused", "decidedSince", "moved", "stale"]).annotate({
  description:
    "refused: the save was refused. decidedSince: the row was decided otherwise since. moved: the confirm named an older revision. stale: the confirm carried accepts of a column matched again"
})
/** The decoded value of `NotWrittenWhy`. */
export type NotWrittenWhy = typeof NotWrittenWhy.Type

/** What became of one request that carried a decision, as far as the server's own word says. */
export const Fate = S.TaggedUnion({
  /** The request is not answered yet. */
  Out: {},
  /** No answer came (the network, nobody signed in): the server may have written it. */
  Unknown: {},
  /** The server's word that it wrote nothing of it, and why. */
  NotWritten: { why: NotWrittenWhy },
  /** The server's word that it wrote it. */
  Stored: {}
}).annotate({ description: "What became of one request that carried a decision, by the server's own word" })
/** The decoded value of `Fate`. */
export type Fate = typeof Fate.Type

/** The two requests that carry decisions. */
export const SendingKind = S.Literals(["save", "confirm"]).annotate({
  description: "A save of decisions, or the confirm with the decisions not saved yet"
})
/** The decoded value of `SendingKind`. */
export type SendingKind = typeof SendingKind.Type

/** One save or confirm that carried a decision: which, what it carried of it, when, and what became of it. */
export const Sending = S.Struct({
  id: S.String.annotateKey({ description: "The id the request went out with, as text: a draft keys its saves so" }),
  kind: SendingKind,
  sent: Decision.annotateKey({
    description: "What the request carried of the decision: all of it, or its parts from before a match"
  }),
  at: S.Int.annotateKey({ description: "The step of the ledger it was sent on" }),
  fate: Fate
}).annotate({ description: "One save or confirm that carried a decision of hers, and what became of it" })
/** The decoded value of `Sending`. */
export type Sending = typeof Sending.Type

/** Where the draft holds a decision of hers after a step. */
export const Place = S.TaggedUnion({
  /** It waits to be sent. */
  Unsent: {},
  /** It is on its way, with the save or confirm of this id. */
  Flight: { id: S.String },
  /** It is a side of its row's line. */
  Line: {
    here: S.Boolean.annotateKey({ description: "Decided in this tab; false for a closed tab's" }),
    refused: S.Boolean.annotateKey({ description: "The server refused it: it is never sent by itself" }),
    overtaken: S.Boolean.annotateKey({ description: "Somebody decided the row since: it is hers to pick" })
  },
  /** A save nobody waits for any more still owes it its answer. */
  Stray: {
    id: S.String,
    here: S.Boolean.annotateKey({ description: "Decided in this tab; false for a closed tab's" })
  },
  /** An import that closed never took it: it waits to be named by the result. */
  LeftOver: {
    unsure: S.Boolean.annotateKey({ description: "It was sent with a fate not known: the server may hold it" })
  },
  /** The picture the draft ended on already said it, so nothing named it. */
  SaidByClose: {}
}).annotate({ description: "Where the draft holds a decision of hers after a step" })
/** The decoded value of `Place`. */
export type Place = typeof Place.Type

/** Her own act that takes a decision back. */
export const Release = S.Literals(["redecided", "undone", "keptTheirs", "pickedOther"]).annotate({
  description:
    "redecided: she decided the row again. undone: she decided it back to what the server holds. keptTheirs: she kept what is saved on its line. pickedOther: she picked another answer of its line"
})
/** The decoded value of `Release`. */
export type Release = typeof Release.Type

/** One decision of hers the draft still owes her an account of. */
export const Debt = S.Struct({
  rowId: S.String.annotateKey({ description: "The row, as the draft keys it" }),
  decision: Decision.annotateKey({ description: "The decision as she made it" }),
  heldAs: Decision.annotateKey({
    description:
      "The decision as the draft held it after the last step: what she made, or what is left of it once the server did not apply a part"
  }),
  madeAt: S.Int.annotateKey({ description: "The step of the ledger she last made it on" }),
  inherited: S.Boolean.annotateKey({
    description: "It came in from what a browser kept, already sent with a fate not known: the server may hold it"
  }),
  toldRefused: S.Boolean.annotateKey({
    description: "She was told the server refused it, in this tab or by what a tab kept of it"
  }),
  sendings: S.Array(Sending).annotateKey({ description: "Every save and confirm that carried it, the oldest first" }),
  place: S.Option(Place).annotateKey({ description: "Where the draft held it after the last step" }),
  released: S.Option(Release).annotateKey({ description: "Her own act that took it back; none while it is hers still" })
}).annotate({ description: "One decision of hers the draft still owes her an account of" })
/** The decoded value of `Debt`. */
export type Debt = typeof Debt.Type

/**
 * Everything owed after a step, and how what was owed before it left. With no fault and nothing forgotten,
 * `entered` is what is owed plus the three exits; `lost` and `forgotten` count the debts that left any other way.
 */
export const Ledger = S.Struct({
  debts: S.Record(S.String, S.Array(Debt)).annotateKey({
    description: "What is owed, by row; a row holds one debt for each decision, a refused one apart from a good one"
  }),
  shown: SavedDecisions.annotateKey({ description: "What the screen showed after the last step" }),
  confirms: S.Option(S.Int).annotateKey({
    description: "How many confirms the import had in the picture the draft held after the last step"
  }),
  exits: S.Struct({
    stored: S.Int.annotateKey({ description: "Left on the server's word that it was written" }),
    takenBack: S.Int.annotateKey({ description: "Left by her own act" }),
    told: S.Int.annotateKey({ description: "Left because she was told what became of it" })
  }).annotateKey({ description: "How many debts left by each of the three ways out" }),
  lost: S.Int.annotateKey({ description: "How many debts left with a fault" }),
  forgotten: S.Int.annotateKey({
    description: "How many debts were cleared when she removed the import herself: no exit and no fault"
  }),
  entered: S.Int.annotateKey({ description: "How many debts there have been" }),
  steps: S.Int.annotateKey({ description: "How many steps the ledger has audited" })
}).annotate({ description: "Every decision of hers the draft owes an account of, and how the others left" })
/** The decoded value of `Ledger`. */
export type Ledger = typeof Ledger.Type

/** What held a value equal to a decision that was let go on it. */
export const EqualIn = S.Literals(["open", "answer", "closed", "reopened", "nothing"]).annotate({
  description:
    "open: the open import. answer: a save's answer. closed: the closed import. reopened: the import opened again. nothing: no picture at all, where an undecided row reads as held"
})
/** The decoded value of `EqualIn`. */
export type EqualIn = typeof EqualIn.Type

/** Which words said a decision was not sent. */
export const NotSentBy = S.Literals(["Outlived", "LeftOver", "Refused"]).annotate({
  description:
    "Outlived: the notice of decisions not sent. LeftOver: the result's list of decisions confirmed before they were saved. Refused: the refusal's words"
})
/** The decoded value of `NotSentBy`. */
export type NotSentBy = typeof NotSentBy.Type

/** A decision of hers the draft handled in a way none of the three exits allows. */
export const Fault = S.TaggedUnion({
  /** The draft no longer holds it: not stored, not taken back, not told. */
  LetGo: {
    rowId: S.String,
    decision: Decision,
    last: S.Option(Place).annotateKey({ description: "Where it stood before; none where it never stood" })
  },
  /** Let go because a picture or an answer holds an equal value: values do not say who wrote them. */
  LetGoOnEqualValue: {
    rowId: S.String,
    decision: Decision,
    picture: EqualIn,
    mayBeStored: S.Boolean.annotateKey({ description: "A request of hers that may have been written carried it" })
  },
  /** Said to be not sent, though a request that carried it may have been written. */
  SaidNotSent: {
    rowId: S.String,
    decision: Decision,
    by: NotSentBy
  },
  /** A pick said a refused decision was kept: it is never sent. */
  SaidKeptOfRefused: {
    rowId: S.String,
    decision: Decision,
    by: S.Literals(["pick", "letGo"]).annotateKey({ description: "Her pick on its line, or the draft let go" })
  },
  /** The server did not apply a part of a decision, and nothing told her. */
  PartLetGo: {
    rowId: S.String,
    part: S.String.annotateKey({ description: "The part, as a decision's parts are named: accept:unitCost" })
  }
}).annotate({ description: "A decision of hers handled in a way none of the three exits allows" })
/** The decoded value of `Fault`. */
export type Fault = typeof Fault.Type

/** One audited step: the ledger after it, and the faults it found. */
export const Audited = S.Struct({ ledger: Ledger, faults: S.Array(Fault) }).annotate({
  description: "One audited step: the ledger after it, and the faults it found"
})
/** The decoded value of `Audited`. */
export type Audited = typeof Audited.Type

/** One decision the draft holds, and where. */
export const Placed = S.Struct({ decision: Decision, place: Place }).annotate({
  description: "One decision of hers the draft holds, and where"
})
/** The decoded value of `Placed`. */
export type Placed = typeof Placed.Type

/** How a draft is let go outside a step. */
export const Leaving = S.Literals(["reload", "anotherMember", "letGo", "removed", "forgotten"]).annotate({
  description:
    "reload: the page is loaded again. anotherMember: another person signed in. letGo: the draft is let go. removed: the import was removed elsewhere. forgotten: she removed the import herself"
})
/** The decoded value of `Leaving`. */
export type Leaving = typeof Leaving.Type

/** A draft let go outside a step: how, what the browser kept of it, and what a notice named. */
export interface Leave {
  readonly how: Leaving
  readonly kept: O.Option<Waiting>
  readonly named: O.Option<Named>
}

/** A ledger with nothing owed: where a draft nobody has opened starts, and where a page loaded again starts. */
export const emptyLedger: Ledger = {
  debts: {},
  shown: {},
  confirms: O.none(),
  exits: { stored: 0, takenBack: 0, told: 0 },
  lost: 0,
  forgotten: 0,
  entered: 0,
  steps: 0
}

/**
 * Every debt of a ledger, one by one.
 *
 * @example owed(emptyLedger) // []
 */
export const owed = (ledger: Ledger): ReadonlyArray<Debt> => A.flatten(R.values(ledger.debts))

// -- Decisions and debts ---------------------------------------------------------------------------------------------

const undecided: Decision = O.none()

/** A decision as the ledger keeps it: one with nothing in it is none. */
const said = (decision: Decision): Decision => (sameDecision(decision, undecided) ? undecided : decision)

/** One decision coming into the ledger. */
interface Entry {
  readonly rowId: string
  readonly decision: Decision
  readonly inherited: boolean
  readonly toldRefused: boolean
}

/** True for the debt an entry is: the same row, the same decision, refused or not as it is. */
const isOf = (debt: Debt, entry: Pick<Entry, "rowId" | "decision" | "toldRefused">): boolean =>
  debt.rowId === entry.rowId && debt.toldRefused === entry.toldRefused && sameDecision(debt.decision, entry.decision)

/** True when a value is what the draft holds of a debt, or the decision as she made it. */
const isSaidOf = (debt: Debt, value: Decision): boolean =>
  sameDecision(debt.heldAs, value) || sameDecision(debt.decision, value)

const isOpenFate = Fate.isAnyOf(["Out", "Unknown"])

/** True when a request that carried it may have been written, or it came in already sent with a fate not known. */
const mayBeStored = (debt: Debt): boolean => debt.inherited || A.some(debt.sendings, (one) => isOpenFate(one.fate))

const isStored = (debt: Debt): boolean => A.some(debt.sendings, (one) => Fate.guards.Stored(one.fate))

const isPlaced = (debt: Debt): boolean => O.isSome(debt.place)

const placedAs = (debt: Debt, is: (place: Place) => boolean): boolean => O.exists(debt.place, is)

const rank: (place: Place) => number = Place.match({
  Flight: () => 0,
  Unsent: () => 1,
  Line: () => 2,
  Stray: () => 3,
  LeftOver: () => 4,
  SaidByClose: () => 5
})

const isRefusedLine: (place: Place) => boolean = Place.matchOrElse({ Line: (line) => line.refused }, () => false)

/** The decisions a browser kept, each as it comes into the ledger: a side as it is, a left-over one as it was named. */
const keptEntries = (kept: Waiting): ReadonlyArray<Entry> => {
  const sides: ReadonlyArray<readonly [string, Side]> = [
    ...R.toEntries(kept.rows),
    ...A.flatMap(R.toEntries(kept.lines), ([rowId, line]) => A.map(line.sides, (side) => [rowId, side] as const))
  ]
  return [
    ...A.map(
      sides,
      ([rowId, side]): Entry => ({
        rowId,
        decision: said(side.decision),
        // Sent before with a fate not known, and not refused since: the server may hold it (`decisionsIn`).
        inherited: O.isNone(side.refused) && maySaved(side),
        toldRefused: O.isSome(side.refused)
      })
    ),
    ...O.match(kept.leftOver, {
      onNone: (): ReadonlyArray<Entry> => [],
      onSome: (named) =>
        A.map(
          eachNamed(named),
          (one): Entry => ({
            rowId: one[0],
            decision: said(one[1]),
            inherited: isUnsure(named, one),
            toldRefused: false
          })
        )
    })
  ]
}

/** Her presses as they come into the ledger: one that leaves an undecided row undecided is no decision. */
const decidedEntries = (before: SavedDecisions, changes: RowChanges): ReadonlyArray<Entry> =>
  A.map(
    A.filter(
      R.toEntries(changes),
      ([rowId, decision]) => !(sameDecision(R.get(before, rowId), undecided) && sameDecision(decision, undecided))
    ),
    ([rowId, decision]): Entry => ({ rowId, decision: said(decision), inherited: false, toldRefused: false })
  )

// -- What the draft holds --------------------------------------------------------------------------------------------

/**
 * Every decision of hers a draft holds, by row, with where it holds it: waiting, on its way, a side of a line, a row a
 * save nobody waits for still owes, left over, or said by the picture the draft ended on. What the server is known to
 * hold is no place: it is the server's, not hers.
 *
 * @example placed(emptyDraft) // {}
 */
export const placed = (draft: Draft): Readonly<Record<string, ReadonlyArray<Placed>>> => {
  const one = (rowId: string, decision: Decision, place: Place) => [rowId, { decision: said(decision), place }] as const
  const named = (kept: O.Option<Named>, place: (named: Named, of: OfRow) => Place) =>
    O.match(kept, {
      onNone: () => [],
      onSome: (naming) => A.map(eachNamed(naming), (of) => one(of[0], of[1], place(naming, of)))
    })
  const all = [
    ...O.match(draft.flight, {
      onNone: () => [],
      onSome: (flight) =>
        A.map(R.toEntries(flight.rows), ([rowId, side]) =>
          one(rowId, side.decision, Place.cases.Flight.make({ id: `${flight.id}` }))
        )
    }),
    ...A.map(R.toEntries(draft.unsent), ([rowId, side]) => one(rowId, side.decision, Place.cases.Unsent.make({}))),
    ...A.flatMap(R.toEntries(draft.lines), ([rowId, line]) =>
      A.map(line.sides, (side) =>
        one(
          rowId,
          side.decision,
          Place.cases.Line.make({ here: side.here, refused: O.isSome(side.refused), overtaken: side.overtaken })
        )
      )
    ),
    ...A.flatMap(R.toEntries(draft.strays), ([id, stray]) =>
      A.flatMap(stray.owed, (rowId) =>
        A.fromOption(
          O.map(R.get(stray.rows, rowId), (side) =>
            one(rowId, side.decision, Place.cases.Stray.make({ id, here: side.here }))
          )
        )
      )
    ),
    ...named(draft.leftOver, (naming, of) => Place.cases.LeftOver.make({ unsure: isUnsure(naming, of) })),
    ...named(draft.saidByClose, () => Place.cases.SaidByClose.make({}))
  ]
  return R.map(
    A.groupBy(all, ([rowId]) => rowId),
    (row) => A.map(row, ([, held]) => held)
  )
}

/**
 * Where a debt stands among what the draft holds of its row: the places whose value is the decision as she made it or
 * what is left of it, refused sides for a refused debt and the others for a good one. The place is the nearest to the
 * server (on its way before waiting before a line); the value is the fullest (a row sent as its older parts first is
 * held whole where it waits).
 */
const standing = (debt: Debt, row: ReadonlyArray<Placed>, refused: boolean): O.Option<Pick<Debt, "place" | "heldAs">> => {
  const fits = A.filter(
    row,
    (held) => isRefusedLine(held.place) === refused && leftByMatch(debt.decision, held.decision)
  )
  const nearest = A.head(A.sortWith(fits, (held) => rank(held.place), Order.Number))
  const fullest = O.orElse(
    A.findFirst(fits, (held) => sameDecision(held.decision, debt.decision)),
    () =>
      O.orElse(
        A.findFirst(fits, (held) => sameDecision(held.decision, debt.heldAs)),
        () => nearest
      )
  )
  return O.map(nearest, (held) => ({
    place: O.some(held.place),
    heldAs: O.match(fullest, { onNone: () => held.decision, onSome: (full) => full.decision })
  }))
}

// -- The fold --------------------------------------------------------------------------------------------------------

/** The ledger's numbers as a step changes them. */
interface Tally {
  readonly entered: number
  readonly stored: number
  readonly takenBack: number
  readonly told: number
  readonly lost: number
}

/** A step half audited: what is owed so far, the numbers, and the faults found. */
interface Fold {
  readonly debts: ReadonlyArray<Debt>
  readonly tally: Tally
  readonly faults: ReadonlyArray<Fault>
}

/** One of the three ways out. */
const Exit = S.Literals(["stored", "takenBack", "told"]).annotate({
  description: "The server's word that it was written, her own act, or a sentence said to her"
})
type Exit = typeof Exit.Type

const counted = (tally: Tally, exit: Exit): Tally => ({ ...tally, [exit]: tally[exit] + 1 })

/**
 * Two debts of one row the draft came to hold as one (the same decision, refused or not alike) are one debt: what
 * either was sent with stays, and `entered` counts it once.
 */
const asOne = (fold: Fold): Fold =>
  A.reduce(fold.debts, { ...fold, debts: A.empty<Debt>() }, (so, debt) =>
    A.some(so.debts, (one) => isOf(one, debt))
      ? {
          ...so,
          tally: { ...so.tally, entered: so.tally.entered - 1 },
          debts: A.map(so.debts, (one) =>
            isOf(one, debt)
              ? {
                  ...one,
                  inherited: one.inherited || debt.inherited,
                  madeAt: Math.max(one.madeAt, debt.madeAt),
                  sendings: A.sortWith([...one.sendings, ...debt.sendings], (sending) => sending.at, Order.Number),
                  released: O.isSome(one.released) && O.isSome(debt.released) ? one.released : O.none()
                }
              : one
          )
        }
      : { ...so, debts: [...so.debts, debt] }
  )

/** A decision comes in: a new debt, or the one already owed under the same row, decision and refusal. */
const entering = (fold: Fold, entry: Entry, at: number, remade: boolean): Fold =>
  A.some(fold.debts, (debt) => isOf(debt, entry))
    ? {
        ...fold,
        debts: A.map(fold.debts, (debt) =>
          isOf(debt, entry)
            ? {
                ...debt,
                inherited: debt.inherited || entry.inherited,
                madeAt: remade ? at : debt.madeAt,
                // Hers again, whatever took it back before.
                released: O.none()
              }
            : debt
        )
      }
    : {
        ...fold,
        tally: { ...fold.tally, entered: fold.tally.entered + 1 },
        debts: [
          ...fold.debts,
          {
            rowId: entry.rowId,
            decision: entry.decision,
            heldAs: entry.decision,
            madeAt: at,
            inherited: entry.inherited,
            toldRefused: entry.toldRefused,
            sendings: [],
            place: O.none(),
            released: O.none()
          }
        ]
      }

/**
 * She decided rows again: what each new decision takes back. This tab's own decisions of the row, a closed tab's
 * refused one, what was left over of it, and what a save nobody waits for owed of it where that was this tab's or what
 * the screen showed. A closed tab's good side of the line is not hers to lose by a press: it stays.
 */
const redecided = (debts: ReadonlyArray<Debt>, made: ReadonlyArray<Entry>, before: SavedDecisions): ReadonlyArray<Debt> =>
  A.map(debts, (debt) => {
    const again = A.findFirst(made, (entry) => entry.rowId === debt.rowId)
    const goes =
      O.exists(again, (entry) => !isOf(debt, entry)) &&
      placedAs(
        debt,
        Place.match({
          Unsent: () => true,
          Flight: () => true,
          Line: (line) => line.here || line.refused,
          Stray: (stray) => stray.here || sameDecision(debt.heldAs, R.get(before, debt.rowId)),
          LeftOver: () => true,
          SaidByClose: () => false
        })
      )
    return goes ? { ...debt, released: O.some<Release>("redecided") } : debt
  })

/**
 * She settled lines: what each pick takes back. Keeping what is saved takes back every side of the line; picking a
 * side takes back the others. A pick made while the row is on its way does nothing, nor one the line does not have.
 */
const picked = (fold: Fold, picks: ReadonlyArray<LinePick>): Fold =>
  A.reduce(picks, fold, (so, { keep, rowId }) => {
    const row = A.filter(so.debts, (debt) => debt.rowId === rowId)
    if (A.some(row, (debt) => placedAs(debt, Place.guards.Flight))) return so
    const onLine = A.filter(row, (debt) => placedAs(debt, Place.guards.Line))
    const releasing = (goes: (debt: Debt) => boolean, release: Release): ReadonlyArray<Debt> =>
      A.map(so.debts, (debt) =>
        A.some(onLine, (one) => one === debt) && goes(debt) ? { ...debt, released: O.some(release) } : debt
      )
    return Keep.$match(keep, {
      Theirs: (): Fold => ({ ...so, debts: releasing(() => true, "keptTheirs") }),
      Side: ({ decision }): Fold => {
        const asked = A.filter(onLine, (debt) => isSaidOf(debt, decision))
        const chosen = O.orElse(
          A.findFirst(asked, (debt) => !debt.toldRefused),
          () => A.head(asked)
        )
        return O.match(chosen, {
          onNone: () => so,
          onSome: (one) => ({
            ...so,
            debts: A.map(
              releasing((debt) => debt !== one, "pickedOther"),
              (debt) => (debt === one ? { ...debt, released: O.none() } : debt)
            )
          })
        })
      }
    })
  })

/** The rows a request carried, each with what it carried of it: a decision to save, or none where it is taken back. */
const carried = (delta: {
  readonly set: SavedDecisions
  readonly clear: ReadonlyArray<string>
}): ReadonlyArray<readonly [string, Decision]> => [
  ...A.map(R.toEntries(delta.set), ([rowId, decision]) => [rowId, O.some(decision)] as const),
  ...A.map(delta.clear, (rowId) => [rowId, undecided] as const)
]

/**
 * A request went out: each row it carries is a sending of the debt it carries. That is the good debt of the row held
 * as what was sent; where none is, the one what was sent is a part of (a row with parts from before and after a match
 * goes as its older parts first), hers still before one she took back.
 */
const sent = (
  debts: ReadonlyArray<Debt>,
  request: Request,
  at: number
): ReadonlyArray<Debt> =>
  A.reduce(request.rows, debts, (so, [rowId, value]) => {
    const row = A.filter(so, (debt) => debt.rowId === rowId && !debt.toldRefused)
    const whole = A.filter(row, (debt) => isSaidOf(debt, value))
    const partly = A.filter(row, (debt) => leftByMatch(debt.heldAs, value) || leftByMatch(debt.decision, value))
    const hers = A.filter(partly, (debt) => O.isNone(debt.released))
    const carries = A.isReadonlyArrayNonEmpty(whole) ? whole : A.isReadonlyArrayNonEmpty(hers) ? hers : partly
    const sending: Sending = { id: request.id, kind: request.kind, sent: said(value), at, fate: Fate.cases.Out.make({}) }
    return A.map(so, (debt) =>
      A.some(carries, (one) => one === debt) ? { ...debt, sendings: [...debt.sendings, sending] } : debt
    )
  })

/** One request a step sent: its id, which of the two it is, and the rows it carried. */
interface Request {
  readonly id: string
  readonly kind: SendingKind
  readonly rows: ReadonlyArray<readonly [string, Decision]>
}

const request = (id: number, kind: SendingKind, delta: Parameters<typeof carried>[0]): Request => ({
  id: `${id}`,
  kind,
  rows: carried(delta)
})

/** The requests a step sent, in the order it sent them. */
const requests = (effects: ReadonlyArray<DraftEffect>): ReadonlyArray<Request> =>
  A.flatMap(
    effects,
    DraftEffect.$match({
      Send: (send) => [request(send.id, "save", send.delta)],
      Confirm: (confirm) => [request(confirm.id, "confirm", confirm.delta)],
      Say: () => [],
      Ask: () => [],
      Put: () => [],
      Restart: () => []
    })
  )

/** The server's word about the request of one id, put on each sending of that id still out: an id is answered once. */
const answered = (debts: ReadonlyArray<Debt>, id: string, fate: (debt: Debt) => Fate): ReadonlyArray<Debt> =>
  A.map(debts, (debt) =>
    A.some(debt.sendings, (sending) => sending.id === id && Fate.guards.Out(sending.fate))
      ? {
          ...debt,
          sendings: A.map(debt.sendings, (sending) =>
            sending.id === id && Fate.guards.Out(sending.fate) ? { ...sending, fate: fate(debt) } : sending
          )
        }
      : debt
  )

const notWritten = (why: NotWrittenWhy) => (): Fate =>
  Fate.cases.NotWritten.make({ why })
const unknown = (): Fate => Fate.cases.Unknown.make({})
const stored = (): Fate => Fate.cases.Stored.make({})

/** The server's word an event brings, by the id it answers: none where the event is no answer. */
const worded = (debts: ReadonlyArray<Debt>, event: DraftEvent): ReadonlyArray<Debt> =>
  DraftEvent.$match(event, {
    SaveAnswered: ({ decidedSince, id }) =>
      answered(debts, `${id}`, (debt) =>
        A.some(decidedSince, (since) => since.rowId === debt.rowId) ? notWritten("decidedSince")() : stored()
      ),
    SaveFailed: ({ id }) => answered(debts, `${id}`, unknown),
    // Nobody signed in: whether a request went and was written is not known here, as the draft holds it.
    SaveSignedOut: ({ id }) => answered(debts, `${id}`, unknown),
    SaveRefused: ({ id }) => answered(debts, `${id}`, notWritten("refused")),
    ConfirmDone: ({ id }) => answered(debts, `${id}`, stored),
    ConfirmMoved: ({ id }) => answered(debts, `${id}`, notWritten("moved")),
    ConfirmStale: ({ id }) => answered(debts, `${id}`, notWritten("stale")),
    ConfirmFailed: ({ id }) => answered(debts, `${id}`, unknown),
    Opened: () => debts,
    Left: () => debts,
    TakenUp: () => debts,
    Decided: () => debts,
    SaveAgain: () => debts,
    Settled: () => debts,
    ViewArrived: () => debts,
    MatchStarted: () => debts,
    MatchEnded: () => debts,
    ConfirmPressed: () => debts,
    LeftOverNamed: () => debts
  })

/** What a step said to her, as far as it bears on what she is owed. */
interface Claims {
  /** The refusal's words were said. */
  readonly refused: boolean
  /** Decisions named as not sent. */
  readonly notSent: ReadonlyArray<OfRow>
  /** Decisions named as ones that may have been saved. */
  readonly maybe: ReadonlyArray<OfRow>
  /** Parts of decisions said to be taken back. */
  readonly accepts: ReadonlyArray<StaleAccept>
}

const noClaims: Claims = { refused: false, notSent: [], maybe: [], accepts: [] }

const claimsOf = (effects: ReadonlyArray<DraftEffect>): Claims =>
  A.reduce(effects, noClaims, (claims, effect) =>
    DraftEffect.$is("Say")(effect)
      ? Said.$match(effect.what, {
          Refused: () => ({ ...claims, refused: true }),
          Outlived: (named) => ({ ...claims, notSent: [...claims.notSent, ...eachNamed(named)] }),
          MaybeSaved: (named) => ({ ...claims, maybe: [...claims.maybe, ...eachNamed(named)] }),
          AcceptsTakenBack: ({ accepts }) => ({ ...claims, accepts: [...claims.accepts, ...accepts] }),
          NotSaved: () => claims,
          SignedOut: () => claims,
          DecidedSince: () => claims,
          SavedOtherwise: () => claims
        })
      : claims
  )

const isNamed = (debt: Debt, named: ReadonlyArray<OfRow>): boolean =>
  A.some(named, ([rowId, decision]) => rowId === debt.rowId && isSaidOf(debt, decision))

const isRefusal = (sending: Sending, id: string): boolean =>
  sending.id === id && Fate.guards.NotWritten(sending.fate) && sending.fate.why === "refused"

/**
 * The server refused the save of this id, and the refusal's words were said: each decision it carried that is hers
 * still, with nothing made or sent of it since, is told as refused. Saying so of one an earlier request may have
 * written says "not saved" of a decision that may be: a fault.
 */
const refusing = (fold: Fold, id: string): Fold =>
  A.reduce(fold.debts, { ...fold, debts: A.empty<Debt>() }, (so, debt) => {
    const refusal = A.findFirst(debt.sendings, (sending) => isRefusal(sending, id))
    const tells = O.exists(
      refusal,
      (sending) =>
        !debt.toldRefused &&
        O.isNone(debt.released) &&
        debt.madeAt <= sending.at &&
        A.every(debt.sendings, (other) => other.at <= sending.at)
    )
    if (!tells) return { ...so, debts: [...so.debts, debt] }
    return {
      ...so,
      debts: [...so.debts, { ...debt, toldRefused: true }],
      faults: mayBeStored(debt)
        ? [
            ...so.faults,
            Fault.cases.SaidNotSent.make({ rowId: debt.rowId, decision: debt.decision, by: "Refused" })
          ]
        : so.faults
    }
  })

/**
 * Every debt where the draft holds it now. A refused debt the draft holds only as a good decision is good again (made
 * again in a tab and not refused there); where the row already has that decision the other way, the two are one. A
 * good debt the draft holds only as refused, with no word of a refusal, stands nowhere.
 */
const placing = (fold: Fold, now: Readonly<Record<string, ReadonlyArray<Placed>>>): Fold => {
  const stood = A.map(fold.debts, (debt) => {
    const row = O.getOrElse(R.get(now, debt.rowId), (): ReadonlyArray<Placed> => [])
    const own = standing(debt, row, debt.toldRefused)
    const other = O.isSome(own) ? O.none() : standing(debt, row, !debt.toldRefused)
    const twin = A.some(
      fold.debts,
      (one) => one !== debt && isOf(one, { rowId: debt.rowId, decision: debt.decision, toldRefused: !debt.toldRefused })
    )
    return O.match(own, {
      onSome: (at): Debt => ({ ...debt, ...at }),
      onNone: (): Debt =>
        O.match(other, {
          onNone: () => ({ ...debt, place: O.none() }),
          onSome: (at) =>
            twin || debt.toldRefused
              ? { ...debt, ...at, toldRefused: twin ? !debt.toldRefused : false }
              : { ...debt, place: O.none() }
        })
    })
  })
  return asOne({ ...fold, debts: stood })
}

/** What a debt the draft let go of is judged against: what it knows of the row now, and what the event said of it. */
interface Judging {
  readonly ledger: Ledger
  readonly event: DraftEvent
  readonly draft: Draft
  readonly claims: Claims
  /** The decisions she made in this step. */
  readonly made: ReadonlyArray<Entry>
  /** Every debt of the step, placed or not. */
  readonly all: ReadonlyArray<Debt>
}

/**
 * The picture a decision was let go on, where one holds an equal value: an answer's own word of the row, the picture
 * an event brought, the closed picture the draft holds, what the draft knows of the open import, or no picture at all
 * (where only an undecided row reads as held).
 */
const letGoOn = (
  debt: Debt,
  before: O.Option<Place>,
  { draft, event, ledger }: Judging
): O.Option<EqualIn> => {
  const holds = (value: Decision): boolean => isSaidOf(debt, value)
  const wasOutside = O.exists(before, Place.isAnyOf(["Stray", "LeftOver", "SaidByClose"]))
  const answer = DraftEvent.$is("SaveAnswered")(event)
    ? A.findFirst(event.decidedSince, (since) => since.rowId === debt.rowId && holds(since.theirs))
    : O.none()
  const picture = (decisions: SavedDecisions, kind: EqualIn) => O.some({ decisions, kind })
  const brought = DraftEvent.$is("ViewArrived")(event)
    ? picture(
        event.decisions,
        !event.open
          ? "closed"
          : wasOutside || O.exists(ledger.confirms, (confirms) => event.confirms > confirms)
            ? "reopened"
            : "open"
      )
    : DraftEvent.$is("ConfirmDone")(event)
      ? picture(event.decisions, "closed")
      : O.none()
  const closed = O.orElse(
    O.map(draft.closedSeen, (seen) => seen.decisions),
    () => (draft.ended ? O.some(draft.endedOn) : O.none())
  )
  if (O.isSome(answer)) return O.some("answer")
  if (O.exists(brought, (seen) => holds(R.get(seen.decisions, debt.rowId)))) {
    return O.map(brought, (seen) => seen.kind)
  }
  if (O.exists(closed, (decisions) => holds(R.get(decisions, debt.rowId)))) return O.some("closed")
  if (!holds(knownOf(draft, debt.rowId))) return O.none()
  return O.some(O.isNone(draft.held) ? "nothing" : wasOutside ? "reopened" : "open")
}

/**
 * One debt the draft no longer holds: the way out it has, or the fault. Stored on the server's word; told where a
 * sentence of this step names it; taken back by her own act (a refusal she dismissed was told); a decision made back
 * to what the server holds, with no request of hers that may have written another value, is undone; a refused one told
 * in this tab goes when the draft ends; a left-over one when the result has named it; one whose parts the server took
 * back when that was said.
 */
const judged = (debt: Debt, before: O.Option<Place>, judging: Judging): Result.Result<Exit, Fault> => {
  const { all, claims, draft, event, made } = judging
  const exit = (way: Exit): Result.Result<Exit, Fault> => Result.succeed(way)
  if (isStored(debt)) return exit("stored")
  if (isNamed(debt, claims.notSent) || isNamed(debt, claims.maybe)) return exit("told")
  if (O.isSome(debt.released)) return exit(debt.toldRefused && debt.released.value === "keptTheirs" ? "told" : "takenBack")
  const undone =
    A.some(made, (entry) => isOf(debt, entry)) &&
    sameDecision(debt.decision, knownOf(draft, debt.rowId)) &&
    !A.some(
      all,
      (other) =>
        other !== debt &&
        other.rowId === debt.rowId &&
        mayBeStored(other) &&
        !sameDecision(other.decision, debt.decision)
    )
  if (undone) return exit("takenBack")
  if (debt.toldRefused && draft.ended) return exit("told")
  if (DraftEvent.$is("LeftOverNamed")(event) && O.exists(before, Place.guards.LeftOver)) return exit("told")
  const takenBack = partsNamed(claims.accepts)(debt.rowId)
  if (A.some(partsOf(debt.decision), takenBack)) return exit("told")
  return Result.fail(
    O.match(letGoOn(debt, before, judging), {
      onNone: (): Fault => Fault.cases.LetGo.make({ rowId: debt.rowId, decision: debt.decision, last: before }),
      onSome: (picture): Fault =>
        Fault.cases.LetGoOnEqualValue.make({
          rowId: debt.rowId,
          decision: debt.decision,
          picture,
          mayBeStored: mayBeStored(debt)
        })
    })
  )
}

/** Every debt the draft no longer holds leaves the ledger: by its way out, or counted lost with its fault. */
const judging = (fold: Fold, before: (debt: Debt) => O.Option<Place>, input: Omit<Judging, "all">): Fold =>
  A.reduce(fold.debts, { ...fold, debts: A.empty<Debt>() }, (so, debt) =>
    isPlaced(debt)
      ? { ...so, debts: [...so.debts, debt] }
      : Result.match(judged(debt, before(debt), { ...input, all: fold.debts }), {
          onSuccess: (exit) => ({ ...so, tally: counted(so.tally, exit) }),
          onFailure: (fault) => ({
            ...so,
            tally: { ...so.tally, lost: so.tally.lost + 1 },
            faults: [...so.faults, fault]
          })
        })
  )

/**
 * The parts of what a save carried that the server did not apply, and no sentence of the step said were taken back:
 * one fault a part.
 */
const partsLetGo = (
  debts: ReadonlyArray<Debt>,
  id: number,
  notApplied: ReadonlyArray<StaleAccept>,
  accepts: ReadonlyArray<StaleAccept>
): ReadonlyArray<Fault> =>
  A.flatMap(debts, (debt): ReadonlyArray<Fault> => {
    const gone = partsNamed(notApplied)(debt.rowId)
    const told = partsNamed(accepts)(debt.rowId)
    const carried: ReadonlyArray<Sending> = A.filter(debt.sendings, (sending) => sending.id === `${id}`)
    return A.flatMap(carried, (sending) =>
      A.map(
        A.filter(partsOf(sending.sent), (part) => gone(part) && !told(part)),
        (part): Fault => Fault.cases.PartLetGo.make({ rowId: debt.rowId, part })
      )
    )
  })

/**
 * The picks of a side the server refused that the step kept as refused: the button says the decision is kept, and it
 * stands on its line where nothing sends it. A pick the step sent, or made good, is no fault; nor one made while the
 * row was on its way, which does nothing.
 */
const keptRefused = (
  start: ReadonlyArray<Debt>,
  debts: ReadonlyArray<Debt>,
  picks: ReadonlyArray<LinePick>
): ReadonlyArray<Fault> =>
  A.flatMap(picks, ({ keep, rowId }): ReadonlyArray<Fault> => {
    const flew = A.some(start, (debt) => debt.rowId === rowId && placedAs(debt, Place.guards.Flight))
    const row = A.filter(debts, (debt) => debt.rowId === rowId)
    return Keep.$match(keep, {
      Theirs: () => [],
      Side: ({ decision }) => {
        const asked = A.filter(row, (debt) => isSaidOf(debt, decision))
        const good = A.some(asked, (debt) => !debt.toldRefused)
        return flew || good
          ? []
          : A.map(
              A.filter(asked, (debt) => O.isNone(debt.released) && placedAs(debt, isRefusedLine)),
              (debt): Fault => Fault.cases.SaidKeptOfRefused.make({ rowId, decision: debt.decision, by: "pick" })
            )
      }
    })
  })

/**
 * What a step said of decisions it still holds or lets go, where the words are wrong: named as not sent, or put on
 * the result's list of decisions confirmed before they were saved, though a request that carried it may have been
 * written; and a part the server did not apply, with no sentence that says so.
 */
const saidWrongly = (
  debts: ReadonlyArray<Debt>,
  before: (debt: Debt) => O.Option<Place>,
  { claims, event }: Pick<Judging, "claims" | "event">
): ReadonlyArray<Fault> => {
  const sure = Place.matchOrElse({ LeftOver: (left) => !left.unsure }, () => false)
  const notSent = (debt: Debt, by: NotSentBy): Fault =>
    Fault.cases.SaidNotSent.make({ rowId: debt.rowId, decision: debt.decision, by })
  return [
    ...A.map(
      A.filter(debts, (debt) => mayBeStored(debt) && isNamed(debt, claims.notSent)),
      (debt) => notSent(debt, "Outlived")
    ),
    ...A.map(
      A.filter(debts, (debt) => mayBeStored(debt) && placedAs(debt, sure) && !O.exists(before(debt), sure)),
      (debt) => notSent(debt, "LeftOver")
    ),
    ...(DraftEvent.$is("SaveAnswered")(event) ? partsLetGo(debts, event.id, event.notApplied, claims.accepts) : [])
  ]
}

/**
 * One step audited: the ledger after it, and the faults it found. The ledger is the one the step before left; the
 * event and the transition's answer are those of this step. Nothing else is read.
 *
 * @example audit(emptyLedger, DraftEvent.Opened({ kept: O.none() }), step(emptyDraft, DraftEvent.Opened({ kept: O.none() }))).faults // []
 */
export const audit: {
  (event: DraftEvent, stepped: Stepped): (ledger: Ledger) => Audited
  (ledger: Ledger, event: DraftEvent, stepped: Stepped): Audited
} = dual(3, (ledger: Ledger, event: DraftEvent, stepped: Stepped): Audited => {
  const { draft, effects } = stepped
  const at = ledger.steps + 1
  const start = owed(ledger)
  const claims = claimsOf(effects)
  const made = DraftEvent.$is("Decided")(event) ? decidedEntries(ledger.shown, event.changes) : []
  const kept = DraftEvent.$is("Opened")(event)
    ? O.match(event.kept, { onNone: (): ReadonlyArray<Entry> => [], onSome: keptEntries })
    : DraftEvent.$is("TakenUp")(event)
      ? keptEntries(event.kept)
      : []
  const begun: Fold = {
    debts: redecided(start, made, ledger.shown),
    tally: { entered: ledger.entered, ...ledger.exits, lost: ledger.lost },
    faults: []
  }
  // Her picks: before a picture is held a pick does nothing (lines are drawn over one).
  const marked = DraftEvent.$is("Settled")(event) && O.isSome(draft.held) ? picked(begun, event.picks) : begun
  const entered = A.reduce(
    kept,
    A.reduce(made, marked, (fold, entry) => entering(fold, entry, at, true)),
    (fold, entry) => entering(fold, entry, at, false)
  )
  const posted = A.reduce(requests(effects), entered.debts, (debts, request) => sent(debts, request, at))
  const heard: Fold = { ...entered, debts: worded(posted, event) }
  const refused = DraftEvent.$is("SaveRefused")(event) && claims.refused ? asOne(refusing(heard, `${event.id}`)) : heard
  const stood = placing(refused, placed(draft))
  // Where each debt stood before this step: by the debt it was then, whatever it has been folded into since.
  const before = (debt: Debt): O.Option<Place> =>
    O.flatMap(
      O.orElse(
        A.findFirst(start, (one) => isOf(one, debt)),
        () => A.findFirst(start, (one) => one.rowId === debt.rowId && sameDecision(one.decision, debt.decision))
      ),
      (one) => one.place
    )
  const wrong = saidWrongly(stood.debts, before, { claims, event })
  const keptAsRefused = DraftEvent.$is("Settled")(event) && O.isSome(draft.held) ? keptRefused(start, stood.debts, event.picks) : []
  const done = judging({ ...stood, faults: [...stood.faults, ...keptAsRefused, ...wrong] }, before, {
    ledger,
    event,
    draft,
    claims,
    made
  })
  return {
    ledger: {
      debts: A.groupBy(done.debts, (debt) => debt.rowId),
      shown: shown(draft),
      confirms: draft.confirms,
      exits: { stored: done.tally.stored, takenBack: done.tally.takenBack, told: done.tally.told },
      lost: done.tally.lost,
      forgotten: ledger.forgotten,
      entered: done.tally.entered,
      steps: at
    },
    faults: done.faults
  }
})

/**
 * A draft let go outside a step (the page loaded again, another person signed in, the import removed): what becomes of
 * every debt. One a notice named was told; one the browser kept is owed still, and comes in again when the next page
 * opens; any other is let go, a fault. An import she removed herself forgets them all, counted apart: neither a way out
 * nor a fault. After a reload the caller starts from `emptyLedger`.
 *
 * @example leaving(emptyLedger, { how: "reload", kept: O.none(), named: O.none() }).faults // []
 */
export const leaving: {
  (leave: Leave): (ledger: Ledger) => Audited
  (ledger: Ledger, leave: Leave): Audited
} = dual(2, (ledger: Ledger, leave: Leave): Audited => {
  const all = owed(ledger)
  if (leave.how === "forgotten") {
    return { ledger: { ...ledger, debts: {}, forgotten: ledger.forgotten + A.length(all) }, faults: [] }
  }
  const named = O.match(leave.named, { onNone: (): ReadonlyArray<OfRow> => [], onSome: eachNamed })
  // What a removed import's browser kept is of an import that is gone: only a notice accounts for a decision then.
  const kept = leave.how === "removed" ? [] : O.match(leave.kept, { onNone: () => [], onSome: keptEntries })
  const isKept = (debt: Debt): boolean =>
    A.some(kept, (entry) => entry.rowId === debt.rowId && isSaidOf(debt, entry.decision))
  const told = A.filter(all, (debt) => isNamed(debt, named))
  const stays = A.filter(all, (debt) => !isNamed(debt, named) && isKept(debt))
  const gone = A.filter(all, (debt) => !isNamed(debt, named) && !isKept(debt))
  return {
    ledger: {
      ...ledger,
      debts: A.groupBy(stays, (debt) => debt.rowId),
      exits: { ...ledger.exits, told: ledger.exits.told + A.length(told) },
      lost: ledger.lost + A.length(gone)
    },
    faults: A.map(gone, (debt) =>
      Fault.cases.LetGo.make({ rowId: debt.rowId, decision: debt.decision, last: debt.place })
    )
  }
})

// -- Words -----------------------------------------------------------------------------------------------------------

const placeWords: (place: Place) => string = Place.match({
  Unsent: () => "waiting to be sent",
  Flight: (flight) => `on its way with request ${flight.id}`,
  Line: (line) => (line.refused ? "refused, on its row's line" : "on its row's line"),
  Stray: (stray) => `owed its answer by request ${stray.id}`,
  LeftOver: () => "left over by the import that closed",
  SaidByClose: () => "said by the picture the draft ended on"
})

const pictureWords = {
  open: "the open import holds an equal value",
  answer: "a save's answer said the server holds an equal value",
  closed: "the closed import holds an equal value",
  reopened: "the import opened again holds an equal value",
  nothing: "no picture was held, and an undecided row read as held"
} as const

const saidWords = {
  Outlived: "the notice of decisions not sent",
  LeftOver: "the result's list of decisions confirmed before they were saved",
  Refused: "the refusal's words"
} as const

/**
 * A fault as one sentence, for whoever reads the audit: which row, which decision, and what went wrong.
 *
 * @example faultWords(Fault.cases.PartLetGo.make({ rowId: "row-55", part: "accept:unitCost" }))
 * // "Row 55: the server did not apply accept:unitCost, and nothing said so."
 */
export const faultWords: (fault: Fault) => string = Fault.match({
  LetGo: ({ decision, last, rowId }) =>
    `${rowLabel(rowId)}: ${decisionWords(decision)} was let go, not stored, not taken back and not told; ${O.match(last, {
      onNone: () => "the draft never held it",
      onSome: (place) => `it was last ${placeWords(place)}`
    })}.`,
  LetGoOnEqualValue: ({ decision, mayBeStored: may, picture, rowId }) =>
    `${rowLabel(rowId)}: ${decisionWords(decision)} was let go because ${pictureWords[picture]}; ${
      may ? "a request of hers may have written it" : "no request of hers can have written it"
    }.`,
  SaidNotSent: ({ by, decision, rowId }) =>
    `${rowLabel(rowId)}: ${decisionWords(decision)} was said to be not sent by ${saidWords[by]}, though a request that carried it may have been written.`,
  SaidKeptOfRefused: ({ by, decision, rowId }) =>
    `${rowLabel(rowId)}: ${decisionWords(decision)} was refused by the server, and ${
      by === "pick" ? "her pick kept it on its line" : "the draft was let go with it"
    }: it is never sent.`,
  PartLetGo: ({ part, rowId }) => `${rowLabel(rowId)}: the server did not apply ${part}, and nothing said so.`
})
