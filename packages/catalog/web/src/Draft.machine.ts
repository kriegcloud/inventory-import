// The review's draft for one import, as one pure transition. It says what to send and what to ask; it sends and asks
// nothing itself, so every ordering of what can happen is tested without a server. The model it is built on:
//
// 1. What is sent is what the person did. A save and a confirm carry the rows the person changed here and nothing else;
//    the server's picture is something the screen follows, never the base a difference is worked out from. A confirm
//    names the revision of the picture the screen holds, and is refused when the draft is at another.
// 2. The server decides whether a row that waited may be written. A row that waited (its save failed, it was kept
//    across a reload, a closed tab kept it, the person picked it on a line, somebody saved since it was pressed) goes
//    with `over`: the decisions this tab knows the server may hold of it. The server writes it only while it holds one
//    of them, and names it decided since otherwise. So nothing is asked before a row goes, and no picture is judged
//    first. A press that never waited goes without `over`: the last one stands.
// 3. What the server may hold of a row (`Side.seen`) is what it was known to hold when the person began deciding it,
//    then each decision of hers that was sent and whose fate is not known. An answer trims that to what it stored.
// 4. An answer belongs to its save or confirm by the id it was sent with. One of another id settles nothing here; what
//    it proves of the server is still used.
// 5. A decision of the person's is on the server, waiting (`unsent`, or on its way in `flight`), a side of its row's
//    line, or named. A row has a line while more than one answer of it is alive (this tab's, each closed tab's, and
//    what the server holds when that is none of them) or the server refused one. Every line comes from one rule
//    (`lined`), run after everything that happens: a side the server comes to hold goes, what somebody decided since is
//    said as theirs, and a line with nothing left to ask goes, its one decision waiting again.
// 6. A column matched again takes back what was decided before it, and the server judges that by the one revision a row
//    names. Each part of a decision keeps the revision it was made on; a row with parts from before and after a match is
//    sent as its older parts first, so the server judges them on their own revision, and whole once that is answered.
import * as A from "effect/Array"
import * as Data from "effect/Data"
import { dual } from "effect/Function"
import * as Eq from "effect/Equal"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import {
  type DecisionDelta,
  decisionFromFlags,
  hasKeep,
  isLeftOut,
  placeLeftOut,
  placeOpen,
  type SavedDecisions,
  StoredChoice,
  storedUndecided,
  type TakenBackKind
} from "@inventory/catalog-contract/Decision"

/** One row's decision, as the server keeps it. */
export type RowDecision = SavedDecisions[string]

/** What the person changed, row by row: a decision to save, or none where the row's decision was taken back. */
export type RowChanges = Readonly<Record<string, O.Option<RowDecision>>>

/** Several decisions of each row. */
export type Several = Readonly<Record<string, ReadonlyArray<O.Option<RowDecision>>>>

/** The server's decisions as one read or one answered save said them, with the draft's revision they belong to. */
export interface Picture {
  readonly revision: number
  readonly decisions: SavedDecisions
}

/**
 * A decision the server did not apply: a column it rests on was matched again after it was made. `kind` says which
 * part of the row's decision it was (an accept when not said); `field` the field whose column was matched again.
 */
export interface StaleAccept {
  readonly rowId: string
  readonly field: string
  readonly kind?: TakenBackKind
}

/** A row of a save the server did not write: it waited, and what the server holds of it now is none of its `over`. */
export interface DecidedSince {
  readonly rowId: string
  readonly theirs: O.Option<RowDecision>
}

/** For each of the person's rows, the revision of the picture its decision was made on, as a save names it. */
export type MadeOn = Readonly<Record<string, number>>

/** One decision of one row, the person's, that the server is not known to have. */
export interface Side {
  readonly decision: O.Option<RowDecision>
  /** The revision of the picture it was first decided on. */
  readonly madeOn: number
  /** The parts of it decided on another revision than that (`partsOf`), each with its own. */
  readonly dates: Readonly<Record<string, number>>
  /**
   * What the server may hold of the row that this decision stands over: first what the server was known to hold when
   * the person began deciding it, then each decision sent from its tab whose fate is not known.
   */
  readonly seen: ReadonlyArray<O.Option<RowDecision>>
  /** Pressed on the picture shown, and nothing says anybody saved since: it goes without `over`. */
  readonly live: boolean
  /** Decided in this tab; false for one a closed tab of the person's made. */
  readonly here: boolean
  /** Somebody else, or another tab, decided the row since: it is the person's to pick, never sent by itself. */
  readonly overtaken: boolean
  /**
   * The server's sentence, where it refused this decision: it is then never sent by a pick. A closed tab's refused one
   * that is `overtaken` was decided again in this tab: it goes once that decision is saved.
   */
  readonly refused: O.Option<string>
}

/** The person's decisions, one a row. */
export type Sides = Readonly<Record<string, Side>>

/**
 * One row's line above the review: the person's decisions of it that are alive, each once, and what the server holds
 * of it when that is none of them and somebody decided it since (`theirs`).
 */
export interface Line {
  readonly sides: ReadonlyArray<Side>
  readonly theirs: O.Option<O.Option<RowDecision>>
}

/** The lines above the review, by row. */
export type Lines = Readonly<Record<string, Line>>

/** Which answer of a row's line the person picked: what the server holds, or one of the sides, named by its decision. */
export type Keep = Data.TaggedEnum<{
  Theirs: {}
  Side: { readonly decision: O.Option<RowDecision> }
}>
export const Keep = Data.taggedEnum<Keep>()

/** One pick on one row's line. */
export interface LinePick {
  readonly rowId: string
  readonly keep: Keep
}

/**
 * Decisions of the person's to be named, row by row: one of each row, beside it whatever else of the same row was alive
 * (a closed tab's beside this tab's), each once; and, for a row decided since, what the import holds of it.
 */
export interface Named {
  readonly rows: RowChanges
  readonly beside: Several
  readonly theirs: RowChanges
  /**
   * Of the decisions named, those that were sent and whose fate is not known (the answer was lost, or the page was
   * loaded again before it came): the server may have written one before the import was confirmed. Such a decision is
   * never said to be not sent; it is said to be one that may or may not have been saved (`Said.MaybeSaved`). Left out
   * where there is none.
   */
  readonly unsure?: Several
}

/**
 * The person's decisions the server has not taken, as this browser keeps them between visits: after a reload they come
 * back as they were. `confirms`: how many confirms the import had in the picture they were decided over, none when that
 * is not known. `leftOver`: decisions left over by an import that was closed, kept only until the result has named them.
 */
export interface Waiting {
  readonly rows: Sides
  readonly lines: Lines
  readonly confirms: O.Option<number>
  readonly leftOver: O.Option<Named>
}

/** A save or a confirm that is out: the id it was sent with, and the rows it carries. */
export interface Flight {
  readonly id: number
  readonly rows: Sides
}

/**
 * A save nobody waits for any more: the rows it carried as they were sent (each on the revision it was made on), and
 * the rows of it nothing else accounts for (`owed`). The draft that closed with it out (or saw the import confirmed and
 * opened again since it was sent: `closedAt` is that picture's revision) named none of them: a row whose save is out is
 * not said to be not sent before its answer says so. Taken before the confirm, it was part of it; refused (the server
 * takes a save only in the opening it was decided in), lost, or decided otherwise before the confirm, it is named once,
 * then. A row she decides again since is accounted for by that decision.
 */
export interface Stray {
  readonly rows: Sides
  readonly owed: ReadonlyArray<string>
  readonly closedAt: number
}

/**
 * Why the last confirm was not made, as the screen says it: nothing was imported, and the newer picture is being
 * read (`read` false: the button waits for it) or has been read, with how many rows it decides otherwise (`apart`; a
 * match changes no row) and the accepts the server took back because their column was matched again.
 */
export interface HeldBack {
  readonly read: boolean
  readonly apart: number
  readonly accepts: ReadonlyArray<StaleAccept>
}

/**
 * One import's draft on this screen. What the screen shows is `held`, with the person's own changes over it in the
 * order they were made: `landed` (saved, but not yet in a picture the screen has read), `flight` and `unsent`; and this
 * tab's side of a line, where it stands over what the server holds.
 */
export interface Draft {
  /** The server's picture the screen follows: none until the import is first seen. */
  readonly held: O.Option<Picture>
  /**
   * What an answer said the server holds of some rows at `at`, kept over `held` until a picture of that revision or
   * later is read: somebody else saved in between, so `held` is behind and cannot be moved on by guessing.
   */
  readonly landed: O.Option<{
    readonly rows: RowChanges
    readonly at: number
    /**
     * The revision each row was said at. A row an earlier answer said is known as of that answer, not a later one's: a
     * match may have come between the two, and a decision made after it is not judged against the older word.
     */
    readonly said: Readonly<Record<string, number>>
  }>
  /** The save or the confirm that is out. One at a time: the next waits and then carries whatever changed since. */
  readonly flight: O.Option<Flight>
  /** The id of the last save or confirm sent: never used twice in a page, whatever ended or was let go since. */
  readonly lastId: number
  /** The saves sent and no longer waited for (the import was closed, or the draft let go): what each carried, by id. */
  readonly strays: Readonly<Record<string, Stray>>
  readonly unsent: Sides
  /** The lines above the review: a row is never in `unsent` while its line has a decision that can be sent. */
  readonly lines: Lines
  /** The revisions at which the pictures seen say a column was matched. */
  readonly matches: ReadonlyArray<number>
  /** What each match took back, as the last picture says it: the revision it wrote, and the rows it names. */
  readonly takenBack: ReadonlyArray<TakenBackAt>
  /**
   * A confirm was refused or lost without the server saying the draft had moved: nothing is sent until a picture
   * says whether the import can still be decided (a closed one names the rows; an open one has them sent).
   */
  readonly waitsForPicture: boolean
  /**
   * How many confirms the import had in the last picture seen (or, for rows kept from before a reload, the picture
   * they were decided over): none until known. More in a later picture means the import was confirmed since, and
   * opened again if it is open: rows still waiting from before that were never part of it.
   */
  readonly confirms: O.Option<number>
  /**
   * A picture that arrived while the confirm waited for the person's save, and changed nothing the screen shows: its
   * revision, so the save's answer can tell whether it was this save's own picture or a later one.
   */
  readonly seenWhileWaiting: O.Option<number>
  /** Goes up when the region must start again: the decisions under it changed, and not by the person's own hand. */
  readonly epoch: number
  /** A match made on this screen is on its way: the new view it brings is not announced as someone else's. */
  readonly matching: boolean
  /** The SKUs the person typed, as the server was last asked about them (`typedSkus`). */
  readonly typed: string
  /** The Review step is drawn. A draft nobody looks at is kept only while it holds something the server has not. */
  readonly onScreen: boolean
  /**
   * Where the person's confirm is: not pressed; `waiting` for their save that is out to be answered; or `out`, sent
   * with the rows in `flight`. While it waits, a picture that arrives from anywhere but that save holds it back.
   */
  readonly confirm: "idle" | "waiting" | "out"
  /**
   * The last confirm was not made because the import had changed since the picture it was pressed on: said on the
   * screen until the person confirms again (`HeldBack`).
   */
  readonly heldBack: O.Option<HeldBack>
  /** How many presses of the confirm the lines above the review have stopped: 0 once no line is left. */
  readonly stopped: number
  /**
   * What the screen showed when the person pressed the confirm: a held-back confirm counts the rows decided otherwise
   * since against it, not picture by picture (a row changed and changed back is not decided otherwise).
   */
  readonly pressedOn: SavedDecisions
  /**
   * The revision a held-back confirm's newer picture must reach: once the screen holds it, the line says it was read
   * and the button is free. The server's own word sets it (the revision it moved to, or the one the confirm named).
   */
  readonly heldUntil: number
  /** The revision the confirm that is out (or was last sent) named. */
  readonly confirmOn: number
  /**
   * A picture said the import was confirmed since the confirm that is out was pressed: if that confirm is not made, what
   * it carried was decided before another confirm, and is named, never sent into the import opened again.
   */
  readonly confirmOutlived: boolean
  /** The person's decisions an import that was closed never took: kept until the result has named them, never sent. */
  readonly leftOver: O.Option<Named>
  /**
   * A picture said the import was closed while this screen's own confirm was out: if that confirm turns out not to
   * be the one that closed it, the draft ends on this picture.
   */
  readonly closedSeen: O.Option<Picture>
  /** The draft ended because the import can no longer be decided: what is in `leftOver` waits to be named. */
  readonly ended: boolean
  /**
   * The decisions of the picture the draft ended on: rows taken up later from a tab that is gone are named as left
   * over unless that picture already holds them.
   */
  readonly endedOn: SavedDecisions
  /**
   * The person's decisions alive when the draft ended that the picture it ended on already said, so none was named. If
   * the import is opened again and says otherwise of one, it is named then (`arriving`), as it would have been had that
   * picture never come: a closed picture that arrives late must not let go a decision the reopened import lacks.
   */
  readonly saidByClose: O.Option<Named>
  /**
   * Decisions of a row this tab or a closed tab of the person's sent, whose fate is not known, kept from a line she
   * let go (a refused decision dismissed, what is saved kept): the next decision of the row stands over them too, so
   * what the server holds of them is never said as somebody else's.
   */
  readonly sentBefore: Readonly<Record<string, ReadonlyArray<O.Option<RowDecision>>>>
}

/** A draft of an import nobody has opened: nothing held, nothing of the person's. */
export const emptyDraft: Draft = {
  held: O.none(),
  landed: O.none(),
  flight: O.none(),
  lastId: 0,
  strays: {},
  unsent: {},
  lines: {},
  matches: [],
  takenBack: [],
  waitsForPicture: false,
  confirms: O.none(),
  seenWhileWaiting: O.none(),
  epoch: 0,
  matching: false,
  typed: "",
  onScreen: false,
  confirm: "idle",
  heldBack: O.none(),
  stopped: 0,
  pressedOn: {},
  heldUntil: 0,
  confirmOn: 0,
  confirmOutlived: false,
  leftOver: O.none(),
  closedSeen: O.none(),
  ended: false,
  endedOn: {},
  saidByClose: O.none(),
  sentBefore: {}
}

/** Everything that can happen to a draft. */
export type DraftEvent = Data.TaggedEnum<{
  /**
   * A step of the import that follows its draft is drawn, the first time or again. `kept`: what this browser kept from
   * before a reload, read when the step is drawn.
   */
  Opened: { readonly kept: O.Option<Waiting> }
  /** The Review step left the screen. */
  Left: {}
  /**
   * What a tab of the person's that is gone (closed or crashed) kept for this import, taken up by this tab; or, with
   * `here`, what this tab itself kept, read after its step had opened.
   */
  TakenUp: { readonly kept: Waiting; readonly here?: boolean }
  /** The person changed these rows. */
  Decided: { readonly changes: RowChanges }
  /**
   * The server answered the save of this id: the draft is at `revision`, and `changed` says whether this save is
   * what moved it there. When it changed nothing (the server already held every row as sent), `revision` is not the
   * person's own next one: it is wherever the draft had got to, with whatever others decided on the way.
   */
  SaveAnswered: {
    readonly id: number
    readonly revision: number
    readonly changed: boolean
    /** Parts of decisions in the save that the server did not apply. The rest of each row's decision is saved. */
    readonly notApplied: ReadonlyArray<StaleAccept>
    /** Rows that waited and were not written: decided otherwise since. */
    readonly decidedSince: ReadonlyArray<DecidedSince>
  }
  /** The save did not get through (the network, a server error): the rows are not lost, and wait. */
  SaveFailed: { readonly id: number }
  /**
   * The save was not taken because nobody is signed in: not a refusal. The rows wait, kept in this browser, and are
   * sent after the person signs in again.
   */
  SaveSignedOut: { readonly id: number }
  /** The person pressed "Save again". */
  SaveAgain: {}
  /**
   * The server refused the rows (the import was confirmed or removed meanwhile, the role was taken away), with its
   * sentence for the person.
   */
  SaveRefused: { readonly id: number; readonly reason: string }
  /** The person settled lines: which answer of each row stands. A refused decision is never sent by it. */
  Settled: { readonly picks: ReadonlyArray<LinePick> }
  /**
   * A picture of the import arrived: a read, a match's answer, a card's Continue. `open`: whether the import can
   * still be decided; a picture of one that cannot ends the draft.
   */
  ViewArrived: Picture & {
    readonly open: boolean
    /** How many times the import has been confirmed, taken back ones included: the view's history counts them. */
    readonly confirms: number
    /** True for the view the tab holds, given while it is asked anew: it is not that request's answer. */
    readonly waiting?: boolean
    /** The revisions fields' columns were matched on, as the view's choices say. */
    readonly matches?: ReadonlyArray<number>
    /**
     * What each match took back (`ImportView.takenBack`): the revision it wrote and the rows it names. A change to
     * one of those rows that lands with that revision is named as taken back, not as a change on another screen; any
     * other change in the same jump still is.
     */
    readonly takenBack?: ReadonlyArray<TakenBackAt>
  }
  MatchStarted: {}
  MatchEnded: {}
  /** The person pressed the confirm button. */
  ConfirmPressed: {}
  /**
   * The server made the confirm, and answered with the import as it now is: closed, with these decisions. Rows the
   * person decided while it was out were not part of it.
   */
  ConfirmDone: Picture & { readonly id: number }
  /** The server refused the confirm and wrote nothing: the draft is at another revision than the one it named. */
  ConfirmMoved: { readonly id: number }
  /**
   * The confirm did not get through, or was refused for another reason (the import is closed): what was written is
   * not known until the import is read again.
   */
  ConfirmFailed: { readonly id: number }
  /** The server refused the confirm and wrote nothing: it carried accepts made before their column was matched again. */
  ConfirmStale: { readonly id: number; readonly accepts: ReadonlyArray<StaleAccept> }
  /** The result screen has shown the rows that were left over. */
  LeftOverNamed: {}
}>
export const DraftEvent = Data.taggedEnum<DraftEvent>()

/** One match's take-back as the draft reads it: the revision the match wrote, and the rows it names. */
export interface TakenBackAt {
  readonly revision: number
  readonly rows: ReadonlyArray<string>
}

/** What the person is told, in the machine's own terms: said only when the thing it is about was really out. */
export type Said = Data.TaggedEnum<{
  /** A save did not get through: the rows are on the screen, not saved yet, and wait to be sent again. */
  NotSaved: {}
  /** A save was not taken because nobody is signed in: the rows wait, and are sent after sign-in. */
  SignedOut: {}
  /** The server refused a save: the rows it carried are on lines above the review, with `reason`. */
  Refused: { readonly reason: string }
  /** Decisions were not applied (a column they rest on was matched again): each row shows what it now reads. */
  AcceptsTakenBack: { readonly accepts: ReadonlyArray<StaleAccept> }
  /** Rows sent while the review is not on screen were decided otherwise since: they are on lines there. */
  DecidedSince: { readonly rows: ReadonlyArray<string> }
  /**
   * Rows sent while the review is not on screen were not written, and what the server holds of each is, as far as this
   * tab can tell, an earlier decision of the person's or what a match left of one: they are on lines there, which say
   * what is saved and not who saved it.
   */
  SavedOtherwise: { readonly rows: ReadonlyArray<string> }
  /**
   * The person's decisions outlived a confirm of the import (it was confirmed, and opened again, before they were
   * sent): they were not part of it and are not sent into it. Only decisions the server cannot have written: none of
   * them was sent with a fate not known.
   */
  Outlived: Named
  /**
   * The person's decisions from before a confirm of the import that were sent, and whose fate is not known (the answer
   * was lost, or the page loaded again before it came): each may or may not have been saved before the import was
   * confirmed, and nothing this tab holds can tell which. They are not sent into the import opened again; the person is
   * told to look at each row.
   */
  readonly MaybeSaved: Named
}>
export const Said = Data.taggedEnum<Said>()

/** What the transition asks of whoever runs it. */
export type DraftEffect = Data.TaggedEnum<{
  /**
   * Send these rows to the server, each made on the revision `madeOn` names and, where it waited, to be written over
   * what `over` names only; say how it went with `SaveAnswered`, `SaveFailed`, `SaveSignedOut` or `SaveRefused`, and
   * this id. `opening`: how many confirms the import had in the picture they were decided over. The server refuses the
   * save once it has had more: a press made before a confirm is never written into the import opened again.
   */
  Send: {
    readonly id: number
    readonly delta: DecisionDelta
    readonly madeOn: MadeOn
    readonly over: Several
    readonly opening: number
  }
  /** Tell the person. */
  Say: { readonly what: Said }
  /** Ask the server for the import again. */
  Ask: {}
  /** The person's own save moved the draft on by one: put that into the view held, with no request. */
  Put: Picture
  /** The decisions under the region changed: draw it again from what is shown now. `announce`: say it was elsewhere. */
  Restart: { readonly announce: boolean }
  /**
   * Confirm the import as the screen shows it: the picture of `revision`, with the person's rows the server has not
   * been sent. Sent once; say how it went with `ConfirmDone`, `ConfirmMoved`, `ConfirmStale` or `ConfirmFailed`, and
   * this id.
   */
  Confirm: {
    readonly id: number
    readonly revision: number
    readonly madeOn: MadeOn
    readonly delta: DecisionDelta
  }
}>
export const DraftEffect = Data.taggedEnum<DraftEffect>()

/** A transition's answer: the draft after it, and what to do. */
export interface Stepped {
  readonly draft: Draft
  readonly effects: ReadonlyArray<DraftEffect>
}

const none: ReadonlyArray<DraftEffect> = []

/** A draft with nothing to do about it. */
const only = (draft: Draft): Stepped => ({ draft, effects: none })

/** Two answers in a row: what the first did, then what the second does to its draft. */
const then = (first: Stepped, next: (draft: Draft) => Stepped): Stepped => {
  const second = next(first.draft)
  return { draft: second.draft, effects: [...first.effects, ...second.effects] }
}

// -- Decisions -------------------------------------------------------------------------------------------------------

/** The decisions with the person's changes over them: a decision set, or the row's decision gone. */
export const over: {
  (changes: RowChanges): (decisions: SavedDecisions) => SavedDecisions
  (decisions: SavedDecisions, changes: RowChanges): SavedDecisions
} = dual(2, (decisions: SavedDecisions, changes: RowChanges): SavedDecisions => {
  const next: Record<string, RowDecision> = { ...decisions }
  for (const [rowId, change] of R.toEntries(changes)) {
    if (O.isSome(change)) next[rowId] = change.value
    else delete next[rowId]
  }
  return next
})

/** The changes as the server takes them: the rows to save and the rows whose decision was taken back. */
export const deltaOf = (changes: RowChanges): DecisionDelta => {
  const set: Record<string, RowDecision> = {}
  const clear: Array<string> = []
  for (const [rowId, change] of R.toEntries(changes)) {
    if (O.isSome(change)) set[rowId] = change.value
    else clear.push(rowId)
  }
  return { set, clear }
}

/**
 * What an action changed, from the decisions the screen showed before it and after it: the rows whose decision is
 * another, and the rows that have none any more. Both are the screen's own; neither is the server's picture.
 *
 * @example changesBetween({ before: { a: kept }, after: { b: out } }) // { a: none, b: some(out) }
 */
export const changesBetween = (pair: {
  readonly before: SavedDecisions
  readonly after: SavedDecisions
}): RowChanges => {
  const changes: Record<string, O.Option<RowDecision>> = {}
  for (const [rowId, decision] of R.toEntries(pair.after)) {
    if (!O.exists(R.get(pair.before, rowId), (earlier) => Eq.equals(earlier, decision))) {
      changes[rowId] = O.some(decision)
    }
  }
  for (const rowId of R.keys(pair.before)) {
    if (!R.has(pair.after, rowId)) changes[rowId] = O.none()
  }
  return changes
}

/**
 * The SKUs the person typed, as one text: a change means the server must say again which items are already there.
 * Only the rows where one was typed count.
 */
export const typedSkus = (decisions: SavedDecisions): string =>
  A.join(
    A.flatMap(R.toEntries(decisions), ([rowId, decision]) =>
      decision.edits?.sku === undefined ? [] : [`${rowId}=${decision.edits.sku}`]
    ),
    "|"
  )

/** A row's decision with nothing in it. */
const nothingDecided: RowDecision = decisionFromFlags({})

/**
 * True when the two decisions of a row say the same: one with nothing in it says what none at all says.
 *
 * @example sameDecision(O.none(), O.some(decisionFromFlags({}))) // true
 */
export const sameDecision: {
  (other: O.Option<RowDecision>): (one: O.Option<RowDecision>) => boolean
  (one: O.Option<RowDecision>, other: O.Option<RowDecision>): boolean
} = dual(2, (one: O.Option<RowDecision>, other: O.Option<RowDecision>): boolean => {
  const said = (decision: O.Option<RowDecision>): RowDecision => O.getOrElse(decision, () => nothingDecided)
  return Eq.equals(said(one), said(other))
})

/** True when two screens show the same decision on every row: one with nothing in it reads as none. */
const sameShown = (one: SavedDecisions, other: SavedDecisions): boolean =>
  A.every(A.dedupe([...R.keys(one), ...R.keys(other)]), (rowId) => sameDecision(R.get(one, rowId), R.get(other, rowId)))

/** These decisions of a row, each once. */
const eachDecision = (several: ReadonlyArray<O.Option<RowDecision>>): ReadonlyArray<O.Option<RowDecision>> =>
  A.dedupeWith(several, (one, other) => sameDecision(one, other))

const hasDecision = (several: ReadonlyArray<O.Option<RowDecision>>, one: O.Option<RowDecision>): boolean =>
  A.some(several, (other) => sameDecision(other, one))

// -- The parts of a decision a match takes back, and when each was made ----------------------------------------------

/** Which of a decision's parts rest on a column: each accept and undone fix by its field, the stored answer, the keep. */
const partsOf = (change: O.Option<RowDecision>): ReadonlyArray<string> =>
  O.match(change, {
    onNone: () => [],
    onSome: (decision) => [
      ...A.map(decision.accepted, (field) => `accept:${field}`),
      ...A.map(decision.reverted, (field) => `undo:${field}`),
      ...StoredChoice.match(decision.stored, {
        undecided: () => [],
        keep: () => ["stored:keep"],
        replace: () => ["stored:replace"]
      }),
      ...(hasKeep(decision) ? ["twin"] : [])
    ]
  })

/** A decision with only those of its parts that rest on a column; what rests on none (left out, typed) stays. */
const withParts = (change: O.Option<RowDecision>, stays: (part: string) => boolean): O.Option<RowDecision> =>
  O.map(change, (decision) => ({
    ...decision,
    accepted: A.filter(decision.accepted, (field) => stays(`accept:${field}`)),
    reverted: A.filter(decision.reverted, (field) => stays(`undo:${field}`)),
    stored: StoredChoice.match(decision.stored, {
      undecided: () => decision.stored,
      keep: () => (stays("stored:keep") ? decision.stored : storedUndecided),
      replace: () => (stays("stored:replace") ? decision.stored : storedUndecided)
    }),
    place: !hasKeep(decision) || stays("twin") ? decision.place : isLeftOut(decision) ? placeLeftOut(false) : placeOpen
  }))

/** Which parts of each row's decision the server named as not applied. */
const partsNamed = (taken: ReadonlyArray<StaleAccept>): ((rowId: string) => (part: string) => boolean) => {
  const byRow = A.groupBy(taken, (one) => one.rowId)
  return (rowId) => {
    const named = A.flatMap(
      O.getOrElse(R.get(byRow, rowId), (): ReadonlyArray<StaleAccept> => []),
      ({ field, kind }) => {
        const parts: Record<TakenBackKind, ReadonlyArray<string>> = {
          accept: [`accept:${field}`],
          undo: [`undo:${field}`],
          stored: ["stored:keep", "stored:replace"],
          twin: ["twin"]
        }
        return parts[kind ?? "accept"]
      }
    )
    return (part) => A.contains(named, part)
  }
}

/** The revision one part of a decision was made on. */
const dateOf = (side: Side, part: string): number => O.getOrElse(R.get(side.dates, part), () => side.madeOn)

/** The revision of each part of a decision. */
const datesIn = (side: Side): ReadonlyArray<number> => A.map(partsOf(side.decision), (part) => dateOf(side, part))

/** The earliest revision a decision rests on: that of the earliest of its parts; of the decision, where it has none. */
const oldestOf = (side: Side): number =>
  A.match(datesIn(side), { onEmpty: () => side.madeOn, onNonEmpty: (dates) => Math.min(...dates) })

/** The first match that came between the parts of a decision: none where all were made before it, or all after. */
const matchWithin = (draft: Draft, side: Side): O.Option<number> => {
  const dates = datesIn(side)
  const oldest = oldestOf(side)
  return A.match(
    A.filter(draft.matches, (match) => match > oldest && A.some(dates, (date) => date >= match)),
    { onEmpty: O.none, onNonEmpty: (matches) => O.some(Math.min(...matches)) }
  )
}

/** What is sent of a decision now: its parts from before the first match within it, or all of it where there is none. */
const firstSent = (draft: Draft, side: Side): Side =>
  O.match(matchWithin(draft, side), {
    onNone: () => side,
    onSome: (match) => ({ ...side, decision: withParts(side.decision, (part) => dateOf(side, part) < match) })
  })

/** When each part of a new decision was made: a part the earlier one had keeps its revision, a new one is of now. */
const datesOf = (earlier: O.Option<Side>, decision: O.Option<RowDecision>, at: number): Side["dates"] =>
  O.match(earlier, {
    onNone: () => ({}),
    onSome: (side) => {
      const had = partsOf(side.decision)
      const dated = (part: string) => [part, A.contains(had, part) ? R.get(side.dates, part) : O.some(at)] as const
      return decision.pipe(partsOf, A.map(dated), R.fromEntries, R.getSomes)
    }
  })

// -- What the draft holds --------------------------------------------------------------------------------------------

const noSides: Sides = {}
const noRows: RowChanges = {}

/** The person's decisions, without when and over what they were made. */
const changesOf = (sides: Sides): RowChanges => R.map(sides, (side) => side.decision)

/** The rows that are out. */
const flying = (draft: Draft): Sides =>
  O.match(draft.flight, { onNone: () => noSides, onSome: (flight) => flight.rows })

/** The rows an answer said the server holds, over the picture held. */
const landedRows = (draft: Draft): RowChanges =>
  O.match(draft.landed, { onNone: () => noRows, onSome: (landed) => landed.rows })

/** The revision of the picture held, or 0 before one is. */
const heldAt = (draft: Draft): number => O.match(draft.held, { onNone: () => 0, onSome: (held) => held.revision })

/** The decisions of the picture held. */
const heldDecisions = (draft: Draft): SavedDecisions =>
  O.match(draft.held, { onNone: (): SavedDecisions => ({}), onSome: (held) => held.decisions })

/** The decisions the server is known to hold: the picture held, with what answers have said since over it. */
const known = (draft: Draft): SavedDecisions => over(heldDecisions(draft), landedRows(draft))

/** What the server is known to hold of one row. */
const knownOf = (draft: Draft, rowId: string): O.Option<RowDecision> =>
  O.getOrElse(R.get(landedRows(draft), rowId), () => R.get(heldDecisions(draft), rowId))

/** The revision what is known of a row was said at: by an answer since the picture held, or by that picture. */
const rowSaidAt = (draft: Draft, rowId: string): number =>
  O.match(draft.landed, {
    onNone: () => heldAt(draft),
    onSome: (landed) =>
      R.has(landed.rows, rowId) ? O.getOrElse(R.get(landed.said, rowId), () => landed.at) : heldAt(draft)
  })

/** True when what is known of a row is no older than the picture the decision was made on. */
const knows = (draft: Draft, rowId: string, side: Side): boolean => side.madeOn <= rowSaidAt(draft, rowId)

/** A decision the server did not refuse: it can be sent. */
const isGood = (side: Side): boolean => O.isNone(side.refused)

/** True when a match took parts of a decision back, and this is what it left of it. */
const leftByMatch = (before: O.Option<RowDecision>, after: O.Option<RowDecision>): boolean => {
  const left = partsOf(after)
  return sameDecision(
    withParts(before, (part) => A.contains(left, part)),
    after
  )
}

/**
 * True when what the server holds of a row is, as far as this tab can tell, what this decision stands over: one of the
 * decisions the server may hold of it from this tab, or what a match has left of one: a match that took it back from
 * what was stored, or any match the import had, whose parts the server did not apply when an earlier decision reached
 * it (a save whose answer was lost). The screen knows neither which field a match was of nor on which revision each
 * earlier decision was made, so it takes any part gone where a match was as gone by it; the server, which knows, has
 * the last word when the row is sent. Values do not say who wrote them: a colleague's equal decision reads the same.
 */
const ownEarlier = (draft: Draft, rowId: string, side: Side, theirs: O.Option<RowDecision>): boolean =>
  hasDecision(side.seen, theirs) ||
  ((A.some(draft.takenBack, (taken) => taken.revision > side.madeOn && A.contains(taken.rows, rowId)) ||
    A.some(draft.matches, (match) => match > 0)) &&
    A.some(side.seen, (before) => leftByMatch(before, theirs)))

/**
 * True when what the server holds of a row is what this decision stands over, so nobody decided the row since: one of
 * the decisions the server may hold of it, or what a match since has left of one. The server has the last word when the
 * row is sent; this is what the screen says before that.
 */
const standsOver = (draft: Draft, rowId: string, side: Side, theirs: O.Option<RowDecision>): boolean =>
  !side.overtaken && ownEarlier(draft, rowId, side, theirs)

/** The decisions that wait and the lines, changed row by row: copied once, however many rows change. */
interface Book {
  readonly unsent: Record<string, Side>
  readonly lines: Record<string, Line>
  readonly sentBefore: Record<string, ReadonlyArray<O.Option<RowDecision>>>
}

const editing = (draft: Draft, edit: (book: Book) => void): Draft => {
  const book: Book = { unsent: { ...draft.unsent }, lines: { ...draft.lines }, sentBefore: { ...draft.sentBefore } }
  edit(book)
  return { ...draft, ...book }
}

/** The sides of a row's line: none where it has no line. */
const sidesOf = (book: Pick<Draft, "lines">, rowId: string): ReadonlyArray<Side> =>
  O.match(R.get(book.lines, rowId), { onNone: () => [], onSome: (line) => line.sides })

/** A row's decision among those that wait: none where it has none any more. */
const putUnsent = (book: Book, rowId: string, side: O.Option<Side>): void => {
  if (O.isSome(side)) book.unsent[rowId] = side.value
  else delete book.unsent[rowId]
}

/** A row's sides on its line: no line where there are none. */
const putLine = (book: Book, rowId: string, sides: ReadonlyArray<Side>): void => {
  if (A.isReadonlyArrayNonEmpty(sides)) {
    book.lines[rowId] = { sides, theirs: O.flatMap(R.get(book.lines, rowId), (line) => line.theirs) }
  } else delete book.lines[rowId]
}

/** This tab's own side of a line that can be sent. */
const ownSide = (side: Side): boolean => side.here && isGood(side)

/**
 * The person's decision of a row that came after the one that is out: waiting behind it, or on the row's line. None
 * where the one that is out is the latest.
 */
const latest = (book: Pick<Draft, "unsent" | "lines">, rowId: string): O.Option<Side> =>
  O.orElse(R.get(book.unsent, rowId), () => A.findFirst(sidesOf(book, rowId), ownSide))

/** The decision that came after the one that is out, changed where it is: gone where `change` says none. */
const changeLatest = (book: Book, rowId: string, change: (side: Side) => O.Option<Side>): void =>
  O.match(R.get(book.unsent, rowId), {
    onSome: (side) => putUnsent(book, rowId, change(side)),
    onNone: () =>
      putLine(
        book,
        rowId,
        A.getSomes(A.map(sidesOf(book, rowId), (side) => (ownSide(side) ? change(side) : O.some(side))))
      )
  })

/** This tab's own side of a line, where it stands over what the server holds: the screen shows it. */
const shownSide = (draft: Draft, rowId: string): O.Option<Side> =>
  A.findFirst(sidesOf(draft, rowId), (side) => ownSide(side) && standsOver(draft, rowId, side, knownOf(draft, rowId)))

/** The person's changes that are not in a picture the screen has read yet, the latest over the earliest. */
export const mine = (draft: Draft): RowChanges => ({
  ...landedRows(draft),
  ...changesOf(flying(draft)),
  ...changesOf(draft.unsent),
  ...R.getSomes(R.map(draft.lines, (_line, rowId) => O.map(shownSide(draft, rowId), (side) => side.decision)))
})

/** What the screen shows: the server's decisions as held, with the person's own changes over them. */
export const shown = (draft: Draft): SavedDecisions => over(heldDecisions(draft), mine(draft))

/** True when the draft holds nothing of the person's that the server has not put in a picture the screen has read. */
export const settled = (draft: Draft): boolean =>
  O.isNone(draft.landed) && O.isNone(draft.flight) && R.isEmptyReadonlyRecord(draft.unsent)

/** Settled, and with no line: nothing of the person's is in this draft but what the server has. */
const holdsNothing = (draft: Draft): boolean => settled(draft) && R.isEmptyReadonlyRecord(draft.lines)

/** How many of the person's decisions wait after a save the server did not take: 0 while one is on its way. */
export const notSaved = (draft: Draft): number =>
  O.isSome(draft.flight) || draft.waitsForPicture ? 0 : A.length(A.filter(R.values(draft.unsent), (side) => !side.live))

/**
 * A line as the screen draws it, with this tab's decision of the row that is on its way (`going`: the line's picks wait
 * for its answer, which may change what the server holds), and whether what the server holds is somebody else's or
 * another tab's (`since`). It is not where this tab's own decision of the row stands over it: the server holds, as far
 * as this tab can tell, an earlier decision of the person's or what a match left of one, and could not tell it from
 * somebody else's. The line then says what is saved, and not who saved it.
 */
export interface LineShown extends Line {
  readonly going: O.Option<O.Option<RowDecision>>
  readonly since: boolean
}

/** The lines above the review, as the screen draws them. */
export const linesShown = (draft: Draft): Readonly<Record<string, LineShown>> =>
  R.map(draft.lines, (line, rowId) => ({
    ...line,
    going: O.map(R.get(flying(draft), rowId), (side) => side.decision),
    // Said as somebody else's or another tab's only against a decision of this tab's that does not stand over it, over
    // a picture that says what the matches took back: with none, this tab may have written it itself, and the line
    // says what is saved. An answer newer than the picture held says what is stored, not what a match in between took
    // back of hers: until a picture of that revision is read, the line says what is saved too.
    since: O.exists(line.theirs, (theirs) => {
      const own = A.filter(line.sides, (side) => side.here && isGood(side))
      return (
        O.isSome(draft.held) &&
        rowSaidAt(draft, rowId) <= heldAt(draft) &&
        A.isReadonlyArrayNonEmpty(own) &&
        !A.some(own, (side) => ownEarlier(draft, rowId, side, theirs)) &&
        !hasDecision(
          O.getOrElse(R.get(draft.sentBefore, rowId), () => []),
          theirs
        )
      )
    })
  }))

/** None of the rows that wait is live any more: somebody saved since they were pressed, or it is not known. */
const noneLive = (draft: Draft): Draft => ({
  ...draft,
  unsent: R.map(draft.unsent, (side) => ({ ...side, live: false }))
})

/**
 * The draft let go, or ended: nothing of it is left. Its epoch goes on (the next visit's region is another one), and so
 * do its ids: the save that was out is remembered, so its answer, when it comes, is never taken for another's.
 *
 * @example startAgain(draft).unsent // {}
 */
export const startAgain = (draft: Draft): Draft => ({
  ...emptyDraft,
  epoch: draft.epoch + 1,
  lastId: draft.lastId,
  // What this tab sent of a row and may be on the server is still so on the next visit.
  sentBefore: draft.sentBefore,
  // Whoever lets a draft go with a save out accounts for its rows (kept, or named); `closing` says which it did not.
  strays: O.match(draft.flight, {
    onNone: () => draft.strays,
    onSome: (flight) => ({ ...draft.strays, [flight.id]: { rows: flight.rows, owed: [], closedAt: 0 } })
  })
})

/** She decided these rows again: a stray's answer owes nothing of them any more, whatever became of that decision. */
const decidedAgain = (draft: Draft, rows: ReadonlyArray<string>): Draft =>
  R.isEmptyReadonlyRecord(draft.strays)
    ? draft
    : {
        ...draft,
        strays: R.map(draft.strays, (stray) => ({
          ...stray,
          owed: A.filter(stray.owed, (rowId) => !A.contains(rows, rowId))
        }))
      }

/**
 * True when a pick on a line decides its row: a pick of what is saved over a side that could be sent, or of such a side.
 * Dismissing a refusal decides nothing: what a save from before a confirm still owes of the row stays owed.
 */
const decidesRow = (draft: Draft, { keep, rowId }: LinePick): boolean => {
  if (R.has(flying(draft), rowId)) return false
  const sides = sidesOf(draft, rowId)
  return Keep.$match(keep, {
    Theirs: () => A.some(sides, isGood),
    Side: ({ decision }) => A.some(sides, (side) => isGood(side) && sameDecision(side.decision, decision))
  })
}

// -- The lines -------------------------------------------------------------------------------------------------------

/**
 * A side with one more of the same decision: what the server may hold of it from either. This tab's own keeps its
 * revisions; between closed tabs the later making stands (an accept made on a column matched since is not taken for one
 * made before; of two made on the same revision, the one taken up last), and so does whether the server refused it: a
 * decision made again in a tab and not refused there is no refused decision any more, and one refused there is.
 */
const together = (one: Side, other: Side): Side => {
  const later = one.here || (!other.here && one.madeOn > other.madeOn) ? one : other
  return {
    ...one,
    madeOn: later.madeOn,
    dates: later.dates,
    seen: eachDecision([...one.seen, ...other.seen]),
    overtaken: one.overtaken && other.overtaken,
    refused: later.refused
  }
}

/**
 * Sides with more of them: two closed tabs' same decision as one. A closed tab's beside this tab's same one stays, so
 * that it is still there when this tab decides the row again; it is read once (`lineWords`), and goes with this tab's.
 */
const withSides = (sides: ReadonlyArray<Side>, more: ReadonlyArray<Side>): ReadonlyArray<Side> =>
  A.reduce(more, sides, (line, one) => {
    const merges = (side: Side): boolean => side.here === one.here && sameDecision(side.decision, one.decision)
    return A.some(line, merges) ? A.map(line, (side) => (merges(side) ? together(side, one) : side)) : [...line, one]
  })

/** One row as everything known now has it: what waits, and its line. */
const linedRow = (draft: Draft, book: Book, rowId: string): void => {
  const theirs = knownOf(draft, rowId)
  const out = R.has(flying(draft), rowId)
  const waits = R.get(book.unsent, rowId)
  // A row that waits is sent, even where the picture shows its value already: values do not say who wrote them, and an
  // equal value somebody else saved is not hers. Sent, the server writes it as hers (what it holds is what the save
  // leaves of it), or answers that the row was decided otherwise since, and the line asks her which stands.
  const overtaken = (side: Side): boolean => knows(draft, rowId, side) && !standsOver(draft, rowId, side, theirs)
  // One the screen already knows was decided otherwise since asks before it is sent.
  const early = O.exists(waits, (side) => !side.live && !out && overtaken(side))
  const before = sidesOf(book, rowId)
  const asks = early || A.some(before, isGood)
  // A decision that waits to be sent here is sendable, whatever a closed tab was told of the same one.
  const all = A.map(
    withSides(asks ? A.map(A.fromOption(waits), (side) => ({ ...side, live: false })) : [], before),
    (side) =>
      asks && O.exists(waits, (one) => one.here === side.here && sameDecision(one.decision, side.decision))
        ? { ...side, refused: O.none() }
        : side
  )
  // A closed tab's refused decision the person decided again in this tab goes once nothing of this tab's of the row is
  // left to save: it was on the line while she decided, and her decision is on the server.
  const pendingHere = O.isSome(waits) || out || A.some(before, ownSide)
  const settledHere = (side: Side): boolean => !side.here && !isGood(side) && side.overtaken && !pendingHere
  // No decision of hers leaves the line because the server holds its value: values do not say who wrote them, and an
  // equal value somebody else saved is not hers. A refused one stays until she decides the row again or dismisses it;
  // one that can be sent goes, and the server writes it as hers or answers that the row was decided otherwise since.
  const sides = A.map(
    A.filter(all, (side) => !settledHere(side)),
    (side) => (isGood(side) && overtaken(side) ? { ...side, overtaken: true } : side)
  )
  const good = A.filter(sides, isGood)
  // What the server holds is an answer of its own where a side does not stand over it and none of them is it, or where a
  // save's answer said somebody else saved the same as hers (the line says so already, with what is held now).
  // (A refused side the same as what is held asks nothing of it: it is never sent.)
  const drawn = O.exists(R.get(book.lines, rowId), (line) =>
    O.exists(line.theirs, (then) => sameDecision(then, theirs))
  )
  const said =
    A.some(good, (side) => side.overtaken) && (drawn || !A.some(good, (side) => sameDecision(side.decision, theirs)))
  // One decision left, and nothing asked of it: it waits again, this tab's where it has one, with what the same decision
  // of the other tabs knows. A closed tab's refused decision beside this tab's good one holds nothing; this tab's
  // refused one beside a closed tab's is the person's to pick.
  const alike = (one: Side) => (side: Side) => isGood(side) && sameDecision(side.decision, one.decision)
  const first = O.orElse(
    A.findFirst(good, (side) => side.here),
    () => A.findFirst(good, () => A.every(sides, isGood))
  )
  const goes =
    A.length(eachDecision(A.map(good, (side) => side.decision))) === 1 && !said && !out
      ? O.map(first, (one) =>
          A.reduce(
            A.filter(good, (side) => side !== one),
            one,
            together
          )
        )
      : O.none<Side>()
  putLine(
    book,
    rowId,
    A.filter(sides, (side) => !O.exists(first, (one) => O.isSome(goes) && alike(one)(side)))
  )
  O.map(R.get(book.lines, rowId), (line) => {
    book.lines[rowId] = { ...line, theirs: said ? O.some(theirs) : O.none() }
  })
  if (asks) {
    putUnsent(
      book,
      rowId,
      O.map(goes, (side) => ({ ...side, live: false, overtaken: false }))
    )
  }
}

/** Every line as everything known now has it: before anything is sent, and after everything that happens. */
const lined = (draft: Draft): Draft => {
  if (O.isNone(draft.held) || draft.ended) return draft
  const next = holdsNothing(draft)
    ? draft
    : editing(draft, (book) => {
        for (const rowId of A.dedupe([...R.keys(book.lines), ...R.keys(book.unsent)])) linedRow(draft, book, rowId)
      })
  return next.stopped > 0 && R.isEmptyReadonlyRecord(next.lines) ? { ...next, stopped: 0 } : next
}

// -- Naming ----------------------------------------------------------------------------------------------------------

/** One decision of one row. */
type OfRow = readonly [rowId: string, decision: O.Option<RowDecision>]

/**
 * Decisions as they are named: one of each row, what else there was of it beside, each once; and theirs. `unsure`: the
 * decisions among them that were sent with a fate not known (`Named.unsure`); one of them also named as sure is unsure.
 */
const naming = (decisions: ReadonlyArray<OfRow>, theirs: RowChanges, unsure: ReadonlyArray<OfRow> = []): Named => {
  const rows: Record<string, O.Option<RowDecision>> = {}
  const beside: Record<string, ReadonlyArray<O.Option<RowDecision>>> = {}
  for (const [rowId, decision] of decisions) {
    const first = R.get(rows, rowId)
    const others = O.getOrElse(R.get(beside, rowId), (): ReadonlyArray<O.Option<RowDecision>> => [])
    if (O.isNone(first)) rows[rowId] = decision
    else if (!hasDecision([first.value, ...others], decision)) beside[rowId] = [...others, decision]
  }
  const named = (rowId: string): ReadonlyArray<O.Option<RowDecision>> => [
    ...A.fromOption(R.get(rows, rowId)),
    ...O.getOrElse(R.get(beside, rowId), (): ReadonlyArray<O.Option<RowDecision>> => [])
  ]
  const doubt: Record<string, ReadonlyArray<O.Option<RowDecision>>> = {}
  for (const [rowId, decision] of unsure) {
    const was = O.getOrElse(R.get(doubt, rowId), (): ReadonlyArray<O.Option<RowDecision>> => [])
    if (hasDecision(named(rowId), decision) && !hasDecision(was, decision)) doubt[rowId] = [...was, decision]
  }
  return {
    rows,
    beside,
    theirs: R.filter(theirs, (_decision, rowId) => R.has(rows, rowId)),
    ...(R.isEmptyReadonlyRecord(doubt) ? {} : { unsure: doubt })
  }
}

/** The decisions named, one by one: each row's first before what else there was of it. */
const eachNamed = (named: Named): ReadonlyArray<OfRow> => [
  ...R.toEntries(named.rows),
  ...A.flatMap(R.toEntries(named.beside), ([rowId, others]) => A.map(others, (one): OfRow => [rowId, one]))
]

/** The decisions of a naming that were sent with a fate not known, one by one. */
const unsureOf = (named: Named): ReadonlyArray<OfRow> =>
  O.match(O.fromUndefinedOr(named.unsure), {
    onNone: (): ReadonlyArray<OfRow> => [],
    onSome: (unsure) => A.flatMap(R.toEntries(unsure), ([rowId, all]) => A.map(all, (one): OfRow => [rowId, one]))
  })

/** True when a decision of a naming was sent with a fate not known. */
const isUnsure = (named: Named, [rowId, decision]: OfRow): boolean =>
  hasDecision(
    O.getOrElse(
      O.flatMap(O.fromUndefinedOr(named.unsure), R.get(rowId)),
      (): ReadonlyArray<O.Option<RowDecision>> => []
    ),
    decision
  )

/**
 * True when the server may hold this decision of hers: a decision of its tab sent before, whose fate is not known, is
 * among what it stands over, as sent or with parts a match took back (what the server writes of it then). Never said to
 * be not sent.
 */
const maySaved = (side: Side): boolean => {
  const parts = partsOf(side.decision)
  return A.some(
    side.seen,
    (one) =>
      sameDecision(one, side.decision) ||
      sameDecision(
        withParts(one, (part) => A.contains(parts, part)),
        side.decision
      )
  )
}

/**
 * A naming said to the person: what the server cannot have written as not sent (`Outlived`), and what it may have
 * written before the import was confirmed as such (`MaybeSaved`), each once.
 */
const sayNamed = (named: O.Option<Named>): ReadonlyArray<DraftEffect> =>
  O.match(named, {
    onNone: () => none,
    onSome: (all) => {
      const part = (unsure: boolean): O.Option<Named> => {
        const one = naming(
          A.filter(eachNamed(all), (decision) => isUnsure(all, decision) === unsure),
          all.theirs,
          unsureOf(all)
        )
        return R.isEmptyReadonlyRecord(one.rows) ? O.none() : O.some(one)
      }
      return [
        ...A.map(A.fromOption(part(false)), (what) => DraftEffect.Say({ what: Said.Outlived(what) })),
        ...A.map(A.fromOption(part(true)), (what) => DraftEffect.Say({ what: Said.MaybeSaved(what) }))
      ]
    }
  })

/**
 * Several namings as one: each decision of each row once.
 *
 * @example eachOnce([decisionsIn(own), decisionsIn(closedTabs)]).rows // { "row-12": some(left out) }
 */
export const eachOnce = (several: ReadonlyArray<Named>): Named =>
  naming(
    A.flatMap(several, eachNamed),
    A.reduce(several, noRows, (all, one) => ({ ...all, ...one.theirs })),
    A.flatMap(several, unsureOf)
  )

/**
 * Every decision of the person's in what a browser kept, to be named: waiting, a side of a line with what the server
 * held beside it, or left over by an import that was closed.
 *
 * @example decisionsIn(kept).rows // { "row-12": some(left out) }
 */
export const decisionsIn = (kept: Waiting): Named => {
  const sides: ReadonlyArray<readonly [string, Side]> = [
    ...R.toEntries(kept.rows),
    ...A.flatMap(R.toEntries(kept.lines), ([rowId, line]) => A.map(line.sides, (side) => [rowId, side] as const))
  ]
  const of = (all: ReadonlyArray<readonly [string, Side]>): ReadonlyArray<OfRow> =>
    A.map(all, ([rowId, side]): OfRow => [rowId, side.decision])
  return eachOnce([
    ...A.fromOption(kept.leftOver),
    naming(
      of(sides),
      R.getSomes(R.map(kept.lines, (line) => line.theirs)),
      // Sent before, with a fate not known, and not refused since: the server may hold it.
      of(A.filter(sides, ([, side]) => O.isNone(side.refused) && maySaved(side)))
    )
  ])
}

/** A naming as the import stands: the decisions it does not hold (what it holds was taken), and what it holds instead. */
const againstImport = (named: Named, decisions: SavedDecisions): O.Option<Named> => {
  const left = naming(
    A.filter(eachNamed(named), ([rowId, decision]) => !sameDecision(R.get(decisions, rowId), decision)),
    R.map(named.theirs, (_then, rowId) => R.get(decisions, rowId)),
    unsureOf(named)
  )
  return R.isEmptyReadonlyRecord(left.rows) ? O.none() : O.some(left)
}

/**
 * A naming of decisions that go unsent into the import opened again, as it stands: one the server may hold as hers (sent
 * with a fate not known) is left out where the import holds it; one no save of hers can have written is named though
 * the import holds an equal value. That value is somebody else's: values do not say who wrote them, and hers let go on
 * it would be lost without a word when they decide the row otherwise.
 */
const asImportHolds = (named: Named, decisions: SavedDecisions): O.Option<Named> => {
  const all = eachNamed(named)
  const theirs = R.map(named.theirs, (_then, rowId) => R.get(decisions, rowId))
  const notHers = A.filter(all, (one) => !isUnsure(named, one))
  return joined([
    againstImport(
      naming(
        A.filter(all, (one) => isUnsure(named, one)),
        named.theirs,
        unsureOf(named)
      ),
      decisions
    ),
    A.isReadonlyArrayNonEmpty(notHers) ? O.some(naming(notHers, theirs)) : O.none()
  ])
}

/** The decisions of a naming the import already holds: the rest of `againstImport`. */
const saidByImport = (named: Named, decisions: SavedDecisions): O.Option<Named> => {
  const said = naming(
    A.filter(eachNamed(named), ([rowId, decision]) => sameDecision(R.get(decisions, rowId), decision)),
    noRows,
    unsureOf(named)
  )
  return R.isEmptyReadonlyRecord(said.rows) ? O.none() : O.some(said)
}

/** Several namings of which there may be none, as one. */
const joined = (several: ReadonlyArray<O.Option<Named>>): O.Option<Named> => {
  const some = A.getSomes(several)
  return A.isReadonlyArrayNonEmpty(some) ? O.some(eachOnce(some)) : O.none()
}

/**
 * What is left over once she has decided these rows again: in a draft that ended, nothing (the result has named it);
 * in one that goes on, the rest, still to be named.
 */
const decidedOver = (draft: Draft, rowIds: ReadonlyArray<string>): O.Option<Named> =>
  draft.ended
    ? O.none()
    : O.flatMap(draft.leftOver, (named) => {
        const rest = naming(
          A.filter(eachNamed(named), ([rowId]) => !A.contains(rowIds, rowId)),
          R.filter(named.theirs, (_then, rowId) => !A.contains(rowIds, rowId)),
          unsureOf(named)
        )
        return R.isEmptyReadonlyRecord(rest.rows) ? O.none() : O.some(rest)
      })

/** What was left over so far, with more of it. */
const leaving = (draft: Draft, more: O.Option<Named>): O.Option<Named> => {
  const several = A.getSomes([draft.leftOver, more])
  return A.isReadonlyArrayNonEmpty(several) ? O.some(eachOnce(several)) : O.none()
}

/**
 * The person's decisions the server has not taken (waiting, on their way, on a line; or left over by an import that was
 * closed), for this browser to keep: none when there are none. The fate of a save that is out is not known after a
 * reload: what it carries may be on the server.
 */
export const waiting = (draft: Draft): O.Option<Waiting> => {
  if (draft.ended) {
    const left = joined([draft.leftOver, O.flatMap(strayOwed(draft), (named) => againstImport(named, draft.endedOn))])
    return O.map(left, (named) => ({
      rows: noSides,
      lines: {},
      confirms: draft.confirms,
      leftOver: O.some(named)
    }))
  }
  // A confirm out that the import was confirmed since outlives: what it carries of rows decided nowhere since was
  // decided before that confirm. No answer comes after a reload to say whether it was made, so those rows are kept to be
  // named, never sent into the import opened again (`confirmOutlived`).
  const outlived = draft.confirmOutlived && O.isNone(draft.closedSeen) ? owedRows(draft) : []
  const flown = R.filter(flying(draft), (_side, rowId) => !A.contains(outlived, rowId))
  const { lines, unsent: rows } = landingUnknown(draft, flown)
  // That confirm may be the one made: each of its rows may have been written with it (`Named.unsure`).
  const carried = A.flatMap(outlived, (rowId) =>
    A.fromOption(O.map(R.get(flying(draft), rowId), (side): OfRow => [rowId, side.decision]))
  )
  const left = joined([
    strayOwed(draft),
    A.isReadonlyArrayNonEmpty(carried) ? O.some(naming(carried, noRows, carried)) : O.none()
  ])
  return R.isEmptyReadonlyRecord(rows) && R.isEmptyReadonlyRecord(lines) && O.isNone(left)
    ? O.none()
    : O.some({ rows, lines, confirms: draft.confirms, leftOver: left })
}

/**
 * What the saves out from before a confirm still owe her, with no later decision of hers over them: after a reload no
 * answer comes to say whether each was part of that confirm, so they are kept to be named (`leftOver`), never sent
 * into the import opened again.
 */
const strayOwed = (draft: Draft): O.Option<Named> => {
  const out = flying(draft)
  const owed = A.flatMap(R.values(draft.strays), (stray) =>
    A.flatMap(stray.owed, (rowId) =>
      O.isSome(latest(draft, rowId)) || R.has(out, rowId)
        ? []
        : A.fromOption(O.map(R.get(stray.rows, rowId), (side): OfRow => [rowId, side.decision]))
    )
  )
  // After a reload no answer comes: each may have been written before the confirm (`Named.unsure`).
  return A.isReadonlyArrayNonEmpty(owed) ? O.some(naming(owed, noRows, owed)) : O.none()
}

// -- Saves -----------------------------------------------------------------------------------------------------------

/** The most decisions a row may name as what it may be written over, as the contract bounds it. */
const overBound = 50

/**
 * What a row that waited may be written over: what the server may hold of it from this tab (`Side.seen`), the decision
 * sent before and still of a fate not known among them, so a save of hers partly written (a part not applied, or taken
 * back by a match since) and whose answer was lost is found as hers. The server judges each named decision with what a
 * match, or the save itself, did not apply of it. A decision never sent is never named: a first send names only what
 * the server was known to hold. Named by value, a colleague's decision equal to one of these is written over as hers;
 * the server cannot tell the two apart.
 */
const overOf = (side: Side): ReadonlyArray<O.Option<RowDecision>> => A.takeRight(eachDecision(side.seen), overBound)

/** Sends what waits when nothing is out: one save carries every row changed since the last one was sent. */
const sending = (input: Draft): Stepped => {
  const draft = lined(input)
  if (O.isSome(draft.flight) || R.isEmptyReadonlyRecord(draft.unsent)) return only(draft)
  // With no picture held (the draft was let go, and the step has not read the import since) nothing says whether the
  // import can still be decided; nor while a picture is awaited after a confirm that was refused or lost.
  if (O.isNone(draft.held) || draft.waitsForPicture) return { draft, effects: [DraftEffect.Ask()] }
  const rows = R.map(draft.unsent, (side) => firstSent(draft, side))
  const id = draft.lastId + 1
  return {
    draft: {
      ...draft,
      lastId: id,
      flight: O.some({ id, rows }),
      unsent: R.filter(draft.unsent, (side) => O.isSome(matchWithin(draft, side)))
    },
    effects: [
      DraftEffect.Send({
        id,
        delta: deltaOf(changesOf(rows)),
        madeOn: R.map(rows, oldestOf),
        over: R.map(
          R.filter(rows, (side) => !side.live),
          overOf
        ),
        // Every row that waits was decided in the opening the picture held is in: one from before a confirm since was
        // named when that picture came (`arriving`).
        opening: O.getOrElse(draft.confirms, () => 0)
      })
    ]
  }
}

/**
 * The rows that were out go back under whatever was decided since, with what the server may now hold of each: none of
 * them is live any more.
 */
const backToUnsent = (draft: Draft, rows: Sides, mayHold: (sent: Side) => Side["seen"]): Draft =>
  editing(noneLive({ ...draft, flight: O.none() }), (book) => {
    for (const [rowId, sent] of R.toEntries(rows)) {
      if (O.isSome(latest(book, rowId))) {
        changeLatest(book, rowId, (side) => O.some({ ...side, seen: eachDecision([...side.seen, ...mayHold(sent)]) }))
      } else {
        book.unsent[rowId] = { ...sent, live: false, seen: eachDecision([...sent.seen, ...mayHold(sent)]) }
      }
    }
  })

/** Back, with a fate not known: the server may hold each of them. */
const landingUnknown = (draft: Draft, rows: Sides): Draft => backToUnsent(draft, rows, (sent) => [sent.decision])

/** Back, with the server's word that it wrote none of them. */
const notLanded = (draft: Draft, rows: Sides): Draft => backToUnsent(draft, rows, () => [])

/** The rows out with this id: none where another save or confirm is out, or none is. */
const outWith = (draft: Draft, id: number): O.Option<Sides> =>
  O.map(
    O.filter(draft.flight, (flight) => flight.id === id),
    (flight) => flight.rows
  )

/** An answer nobody waits for any more has come: nothing is remembered of its save. */
const withoutStray = (draft: Draft, id: number): Draft =>
  R.has(draft.strays, `${id}`) ? { ...draft, strays: R.remove(draft.strays, `${id}`) } : draft

/** The save that was out did not get through: its rows wait, and a confirm that waited for it is not made. */
const failing = (draft: Draft, id: number, said: Said, lost: boolean): Stepped =>
  O.match(outWith(draft, id), {
    onNone: () => strayNotWritten(draft, id, lost),
    onSome: (rows) => ({
      draft: { ...landingUnknown(draft, rows), confirm: "idle" },
      effects: [DraftEffect.Say({ what: said })]
    })
  })

/** What a save stored: its rows, without the parts the server did not apply and the rows it did not write. */
const storedOf = (rows: RowChanges, event: Answer): RowChanges => {
  const since = R.fromEntries(A.map(event.decidedSince, (row) => [row.rowId, true] as const))
  const gone = partsNamed(event.notApplied)
  return R.map(
    R.filter(rows, (_change, rowId) => !R.has(since, rowId)),
    (change, rowId) => {
      const isGone = gone(rowId)
      return withParts(change, (part) => !isGone(part))
    }
  )
}

/**
 * A decision made again over one that was sent, without the parts of that one the server did not apply (a part made
 * again since is another one); the parts that stand were judged at `judgedAt`.
 */
const withoutSentParts = (input: {
  readonly side: Side
  readonly sent: Side
  readonly gone: (part: string) => boolean
  readonly judgedAt: number
}): Side => {
  const { gone, judgedAt, sent, side } = input
  const sentParts = partsOf(sent.decision)
  const carried = (part: string): boolean => A.contains(sentParts, part) && dateOf(side, part) === dateOf(sent, part)
  const decision = withParts(side.decision, (part) => !(gone(part) && carried(part)))
  const dated = (part: string) =>
    [part, carried(part) ? Math.max(dateOf(side, part), judgedAt) : dateOf(side, part)] as const
  return { ...side, decision, dates: decision.pipe(partsOf, A.map(dated), R.fromEntries) }
}

/**
 * What an answer said the server holds of these rows, kept over the picture held until one of its revision is read.
 * Answers land in the order of their revisions: one save is out at a time, and a save from before a close is taken only
 * in the opening it was made in, so its answer lands before the screen reads the import opened again, or not at all
 * (it is older than the picture held). An older answer never lands over a newer one's word, and nothing here checks it.
 */
const landing = (draft: Draft, rows: RowChanges, at: number): Draft => {
  const said = O.match(draft.landed, { onNone: () => ({}), onSome: (landed) => landed.said })
  return {
    ...noneLive(draft),
    landed: O.some({
      rows: { ...landedRows(draft), ...rows },
      at: Math.max(at, O.match(draft.landed, { onNone: () => 0, onSome: (landed) => landed.at })),
      said: { ...said, ...R.map(rows, () => at) }
    })
  }
}

/**
 * What answers said of rows, without the rows a picture of this revision says as well or later: the picture is the
 * newer word of each of those, though another row may still be said after it.
 */
const landedAfter = (draft: Draft, revision: number): Draft["landed"] =>
  O.flatMap(draft.landed, (landed) => {
    const said = R.filter(landed.said, (when) => when > revision)
    const rows = R.filter(landed.rows, (_change, rowId) => R.has(said, rowId))
    return R.isEmptyReadonlyRecord(rows)
      ? O.none()
      : O.some({ rows, said, at: A.reduce(R.values(said), revision + 1, Math.max) })
  })

type Answer = Data.TaggedEnum.Value<DraftEvent, "SaveAnswered">

/** An answer to a save nobody waits for any more (the draft ended, or was let go, with it out): what it proves. */
const answeringStray = (draft: Draft, event: Answer): Stepped =>
  O.match(R.get(draft.strays, `${event.id}`), {
    onNone: () => only(draft),
    onSome: (stray) => {
      const rows = changesOf(stray.rows)
      const stored = storedOf(rows, event)
      const also = (side: Side, rowId: string): Side =>
        O.match(R.get(stored, rowId), {
          onNone: () => side,
          onSome: (one) => ({ ...side, seen: eachDecision([...side.seen, one]) })
        })
      const moved: Draft = {
        ...withoutStray(draft, event.id),
        flight: O.map(draft.flight, (flight) => ({ ...flight, rows: R.map(flight.rows, also) })),
        unsent: R.map(draft.unsent, also),
        lines: R.map(draft.lines, (line, rowId) => ({ ...line, sides: A.map(line.sides, (side) => also(side, rowId)) }))
      }
      // A row it sent that somebody decided since was not written: hers is still with her, never dropped because the
      // draft it went out from is gone. Only a row nothing has accounted for (`Stray.owed`): the closed picture held it
      // as sent, the answer was judged after that picture (in the import opened again), and she has not decided it
      // since. Where the draft has ended it is named; otherwise it is a line with theirs.
      const notWritten = A.filter(
        event.decidedSince,
        ({ rowId, theirs }) =>
          A.contains(stray.owed, rowId) && O.exists(R.get(rows, rowId), (sent) => !sameDecision(sent, theirs))
      )
      const since = A.filter(notWritten, () => event.revision > stray.closedAt)
      // Judged before the close: it was not part of the confirm, and is named once, as the close would have named it.
      const beforeClose = A.filter(notWritten, () => event.revision <= stray.closedAt)
      const sent = (rowId: string): O.Option<RowDecision> => O.flatten(R.get(rows, rowId))
      // What the server holds of each row it names as decided since, at the answer's revision.
      const decided: RowChanges = R.fromEntries(
        A.map(
          A.filter(event.decidedSince, ({ rowId }) => R.has(rows, rowId)),
          ({ rowId, theirs }) => [rowId, theirs] as const
        )
      )
      const next: Draft = !A.isReadonlyArrayNonEmpty(since)
        ? moved
        : moved.ended
          ? {
              ...moved,
              leftOver: leaving(
                moved,
                againstImport(
                  naming(
                    A.map(since, ({ rowId }): OfRow => [rowId, sent(rowId)]),
                    R.fromEntries(A.map(since, ({ rowId, theirs }) => [rowId, theirs] as const))
                  ),
                  moved.endedOn
                )
              )
            }
          : editing(moved, (book) => {
              for (const { rowId, theirs } of since) {
                // A decision of hers made in this tab since stands in its place. A closed tab's, taken up and waiting
                // or on its way, does not: the two are sides of one line, as when a tab is taken up beside this one's.
                const standing = [...A.fromOption(latest(book, rowId)), ...A.fromOption(R.get(flying(moved), rowId))]
                if (A.some(standing, (side) => side.here)) continue
                O.map(R.get(stray.rows, rowId), (one) => {
                  // As it was sent, on the revisions it was made on (a side is never re-dated). Not written, so it put
                  // nothing there; and what somebody decided since is not seen until the line shows it to her.
                  // Beside a closed tab's decision that stands, it is the older of the two and not this tab's latest:
                  // that one's answer puts it on the line beside this, and neither takes the other's place.
                  const side: Side = {
                    ...one,
                    seen: [],
                    live: false,
                    here: !A.isReadonlyArrayNonEmpty(standing),
                    overtaken: false,
                    refused: O.none()
                  }
                  book.lines[rowId] = { sides: withSides([side], sidesOf(book, rowId)), theirs: O.some(theirs) }
                })
              }
            })
      // Not written, as the answer says; one sent before it with a fate not known may have been.
      const named = owedNamed(
        next,
        ...owedOf(
          A.filterMap(beforeClose, ({ rowId }) => sideOf(stray.rows, rowId)),
          false
        )
      )
      // What it says the server holds is kept over an older picture until the newer one is read: of the rows it wrote,
      // and of those somebody decided since, so a line it draws still stands over what is known until then.
      return O.isNone(named.draft.held) || event.revision <= heldAt(named.draft)
        ? named
        : {
            draft: landing(named.draft, { ...stored, ...decided }, event.revision),
            effects: [...named.effects, DraftEffect.Ask()]
          }
    }
  })

/** The answer to the save that was out: what the server holds of each of its rows now. */
const answering = (draft: Draft, sent: Sides, event: Answer): Stepped => {
  const { changed, notApplied, revision } = event
  const gone = partsNamed(notApplied)
  // A row decided since, unless what the server holds of it is what was sent and may be a save of hers it took before
  // (sent before, its fate not known). Equal to what was sent, and never sent before, it is somebody else's: it asks.
  const decided: RowChanges = R.filter(
    R.fromEntries(A.map(event.decidedSince, ({ rowId, theirs }) => [rowId, theirs] as const)),
    (_theirs, rowId) => R.has(sent, rowId)
  )
  const mayBeHers = (rowId: string, side: Side): boolean =>
    hasDecision([...side.seen, ...O.getOrElse(R.get(draft.sentBefore, rowId), () => [])], side.decision)
  const since = R.filter(
    decided,
    (theirs, rowId) =>
      !O.exists(R.get(sent, rowId), (side) => sameDecision(side.decision, theirs) && mayBeHers(rowId, side))
  )
  const proved: RowChanges = { ...storedOf(changesOf(sent), event), ...decided }
  // What the person decided of the same rows since they were sent stands over what the server now holds of each.
  const answered = editing({ ...draft, flight: O.none() }, (book) => {
    for (const [rowId, side] of R.toEntries(sent)) {
      if (R.has(since, rowId)) {
        const asks: Side = { ...O.getOrElse(latest(book, rowId), () => side), overtaken: true, live: false }
        const others = A.filter(sidesOf(book, rowId), (one) => !ownSide(one))
        delete book.unsent[rowId]
        putLine(book, rowId, withSides([asks], others))
        // Somebody else's equal to hers: the line says what they saved, as one that differs does.
        const theirs = O.flatten(R.get(since, rowId))
        if (sameDecision(asks.decision, theirs)) {
          O.map(R.get(book.lines, rowId), (line) => {
            book.lines[rowId] = { ...line, theirs: O.some(theirs) }
          })
        }
      } else {
        const saved = O.flatten(R.get(proved, rowId))
        const isGone = gone(rowId)
        // A picture read since this save shows the row decided otherwise: a decision of hers made on it, equal to what
        // this older save wrote, is a new one over that, and is sent (the server no longer holds what the save wrote).
        const shownOtherwise = O.exists(
          draft.held,
          (held) => held.revision > revision && !sameDecision(R.get(held.decisions, rowId), saved)
        )
        changeLatest(book, rowId, (later) => {
          const left = withoutSentParts({ side: later, sent: side, gone: isGone, judgedAt: revision })
          if (!sameDecision(left.decision, saved)) return O.some({ ...left, seen: [saved] })
          return shownOtherwise ? O.some({ ...left, seen: eachDecision([saved, ...left.seen]) }) : O.none()
        })
        // A closed tab's other decision of the row still asks beside it: what the server holds now is this tab's own,
        // and is this tab's side of the line, never said as somebody else's.
        const closedAsks = A.some(
          sidesOf(book, rowId),
          (one) => !one.here && isGood(one) && !sameDecision(one.decision, saved)
        )
        if (O.isNone(latest(book, rowId)) && closedAsks) {
          const own: Side = { ...side, decision: saved, seen: [saved], live: false, overtaken: false, here: true }
          putLine(book, rowId, withSides([own], sidesOf(book, rowId)))
        }
      }
    }
  })
  const moved = O.match(answered.held, {
    // No picture to move on: the rows wait over whatever is read next.
    onNone: (): Stepped => ({ draft: landing(answered, proved, revision), effects: [DraftEffect.Ask()] }),
    onSome: (held): Stepped => {
      // A picture read after the save is already held: the rows are in it.
      if (revision <= held.revision) return only(answered)
      // This save moved the draft, to the next revision after the one held: nobody else saved in between, so the
      // picture moves on by the person's own rows, with no request. A save that changed nothing moved nothing: its
      // revision is somebody else's, and says nothing of what the picture held lacks.
      if (changed && revision === held.revision + 1 && O.isNone(answered.landed)) {
        // A row the server answered with what the picture already holds (decided since, with nothing in it) keeps the
        // picture's own word for it.
        const moves = R.filter(
          proved,
          (change, rowId) => !(R.has(decided, rowId) && sameDecision(change, R.get(held.decisions, rowId)))
        )
        const picture = { revision, decisions: over(held.decisions, moves) }
        return { draft: { ...answered, held: O.some(picture) }, effects: [DraftEffect.Put(picture)] }
      }
      // Somebody else saved in between, or the save changed nothing and the draft is further on than the picture held:
      // that picture is behind. The rows stay on screen over it, and the import is asked again, at once.
      return { draft: landing(answered, proved, revision), effects: [DraftEffect.Ask()] }
    }
  })
  // A SKU the person typed may belong to an item that is already there: ask the server which are, once it has the
  // SKU. What is still on its way or unsent is not asked about yet: the answer would not have it.
  const typed = typedSkus(known(moved.draft))
  const effects: ReadonlyArray<DraftEffect> = [
    ...moved.effects,
    ...(A.isReadonlyArrayNonEmpty(notApplied)
      ? [DraftEffect.Say({ what: Said.AcceptsTakenBack({ accepts: notApplied }) })]
      : none),
    ...(draft.onScreen || R.isEmptyReadonlyRecord(since) ? none : saidOf(linesShown(moved.draft), R.keys(since))),
    ...(typed === draft.typed ? none : [DraftEffect.Ask()])
  ]
  const next = lined({ ...moved.draft, typed })
  if (next.confirm !== "waiting") return then(then({ draft: next, effects }, sending), (after) => only(letGo(after)))
  // The confirm that waited for this save goes now, on the picture the save left, when that picture is the person's
  // own doing: moved on by this save alone, or not moved at all, and no picture later than the save's own came while
  // it waited. Otherwise the import changed in between, and the confirm is held back: read already when the later
  // picture is the one held, and otherwise once the screen holds the picture this save left. A line stops it first.
  const later = O.exists(next.seenWhileWaiting, (seen) => seen > revision)
  const own = O.isNone(next.landed) && !A.isReadonlyArrayNonEmpty(notApplied) && !later
  if (own || !R.isEmptyReadonlyRecord(next.lines)) {
    return then(then({ draft: next, effects }, confirming), (after) =>
      after.confirm === "idle" ? sending(after) : only(after)
    )
  }
  const heldBack = holdingBack(next, { until: revision, accepts: notApplied })
  const read = O.exists(heldBack.heldBack, (why) => why.read)
  return then({ draft: heldBack, effects: read ? effects : [...effects, DraftEffect.Ask()] }, sending)
}

/** Rows not written because they were decided otherwise, said off the review by what their lines can say of them. */
const saidOf = (
  lines: Readonly<Record<string, LineShown>>,
  rows: ReadonlyArray<string>
): ReadonlyArray<DraftEffect> => {
  const saidSince = (rowId: string): boolean => O.exists(R.get(lines, rowId), (line) => line.since)
  const since = A.filter(rows, saidSince)
  const saved = A.filter(rows, (rowId) => !saidSince(rowId))
  return [
    ...(A.isReadonlyArrayNonEmpty(since) ? [DraftEffect.Say({ what: Said.DecidedSince({ rows: since }) })] : none),
    ...(A.isReadonlyArrayNonEmpty(saved) ? [DraftEffect.Say({ what: Said.SavedOtherwise({ rows: saved }) })] : none)
  ]
}

// -- The confirm -----------------------------------------------------------------------------------------------------

/**
 * The confirm is not made: the import changed since the picture it was pressed on. Said on the screen: nothing was
 * imported, and the newer picture is asked for (`read` false) or has been read, with the rows `counted` as decided
 * otherwise so far and any accepts taken back. The person's rows are saved as any decision is.
 */
const holdingBack = (
  draft: Draft,
  why: { readonly until: number; readonly accepts?: ReadonlyArray<StaleAccept> }
): Draft => {
  const before = O.getOrElse(draft.heldBack, (): HeldBack => ({ read: false, apart: 0, accepts: [] }))
  return reached({
    ...draft,
    confirm: "idle",
    seenWhileWaiting: O.none(),
    heldUntil: O.isSome(draft.heldBack) ? Math.max(draft.heldUntil, why.until) : why.until,
    heldBack: O.some({ read: false, apart: before.apart, accepts: [...before.accepts, ...(why.accepts ?? [])] })
  })
}

/**
 * A held-back confirm, as the screen holds it now: read once the picture held has reached the revision it waits for
 * (and read from then on), with the rows the server decides otherwise than when the person pressed.
 */
const reached = (draft: Draft): Draft =>
  O.match(draft.heldBack, {
    onNone: () => draft,
    onSome: (why) => {
      const read = why.read || (O.isSome(draft.held) && heldAt(draft) >= draft.heldUntil)
      // Rows whose decisions were taken back are named apart, not counted again here.
      const apart = R.keys(
        R.filter(
          changesBetween({ before: draft.pressedOn, after: shown(draft) }),
          (_change, rowId) => !A.some(why.accepts, (taken) => taken.rowId === rowId)
        )
      ).length
      return read === why.read && apart === why.apart ? draft : { ...draft, heldBack: O.some({ ...why, read, apart }) }
    }
  })

/**
 * True when a row can ride with a confirm on the picture held: the server does not judge a confirm's rows one by one,
 * it makes it only while it is at that picture, so what a row that waited stands over is compared with that very
 * picture. A row with parts from before and after a match, or over what a match may have left, is the server's to judge
 * first.
 */
const rides = (draft: Draft, side: Side, rowId: string): boolean => {
  const theirs = R.get(heldDecisions(draft), rowId)
  return (
    O.isNone(matchWithin(draft, side)) &&
    (side.live || sameDecision(side.decision, theirs) || hasDecision(side.seen, theirs))
  )
}

/**
 * Sends the confirm, when the screen holds a picture with nothing of the person's on its way over it: it names that
 * picture's revision and carries the rows not sent yet, which are what the screen shows over it. The rows ride in
 * `flight`, so no save goes out beside the confirm. Nothing is confirmed while a line asks (Benjamin, 2026-11-21: "Wait
 * until she picks"), whether pressed now or waiting on a save.
 */
const confirming = (input: Draft): Stepped => {
  const draft = lined(input)
  if (!R.isEmptyReadonlyRecord(draft.lines)) {
    return only({ ...draft, confirm: "idle", seenWhileWaiting: O.none(), stopped: draft.stopped + 1 })
  }
  if (O.isNone(draft.held)) return only({ ...draft, confirm: "idle" })
  if (!R.every(draft.unsent, (side, rowId) => rides(draft, side, rowId))) {
    const saved = sending({ ...draft, confirm: "waiting" })
    return O.isSome(saved.draft.flight) ? saved : { ...saved, draft: { ...saved.draft, confirm: "idle" } }
  }
  const id = draft.lastId + 1
  const { revision } = draft.held.value
  return {
    draft: {
      ...draft,
      lastId: id,
      flight: O.some({ id, rows: draft.unsent }),
      unsent: {},
      confirm: "out",
      seenWhileWaiting: O.none(),
      confirmOn: revision
    },
    effects: [
      DraftEffect.Confirm({
        id,
        revision,
        madeOn: R.map(draft.unsent, oldestOf),
        delta: deltaOf(changesOf(draft.unsent))
      })
    ]
  }
}

/** The confirm of this id was not made: its rows go back, and the draft ends where a picture said so meanwhile. */
const notConfirmed = (
  draft: Draft,
  id: number,
  by: {
    readonly back: (draft: Draft, rows: Sides) => Draft
    readonly then: (back: Draft, rows: Sides) => Stepped
    /** The answer was lost, or refused for a reason that does not say nothing was written: the save may have been. */
    readonly lost: boolean
  }
): Stepped =>
  O.match(outWith(draft, id), {
    onNone: () => only(withoutStray(draft, id)),
    onSome: (rows) => {
      // Pressed before another confirm: what it carried was decided then. Each row of it with no later decision of hers
      // is named once, as a save from before a confirm is (`strayNotWritten`), and never sent.
      // (Seen closed since, the draft ends on that picture below, which names what it does not hold.)
      if (draft.confirmOutlived && O.isNone(draft.closedSeen)) {
        const owed = owedRows(draft)
        // What waited behind the confirm waited: it goes as such, not as a live press.
        const cleared: Draft = noneLive({ ...draft, flight: O.none(), confirm: "idle", confirmOutlived: false })
        const named = owedNamed(
          cleared,
          ...owedOf(
            A.filterMap(owed, (rowId) => sideOf(rows, rowId)),
            by.lost
          )
        )
        return then(named, sending)
      }
      const back: Draft = { ...by.back(draft, rows), confirm: "idle", confirmOutlived: false }
      return O.match(draft.closedSeen, { onNone: () => by.then(back, rows), onSome: (seen) => closing(back, seen) })
    }
  })

// -- Pictures --------------------------------------------------------------------------------------------------------

/** A draft nobody looks at keeps nothing once the server has everything. */
const letGo = (draft: Draft): Draft =>
  !draft.onScreen && holdsNothing(draft) && draft.confirm === "idle" && O.isSome(draft.held) && O.isNone(draft.leftOver)
    ? startAgain(draft)
    : draft

/** After a change to what is held or the person's: the region starts again if what the screen shows is another. */
const restarting = (input: { readonly before: Draft; readonly after: Draft; readonly announce: boolean }): Stepped =>
  Eq.equals(shown(input.before), shown(input.after))
    ? only(input.after)
    : {
        draft: { ...input.after, epoch: input.after.epoch + 1 },
        effects: [DraftEffect.Restart({ announce: input.announce })]
      }

/** The rows of the save that is out with no later decision of hers over them: what only its answer accounts for. */
const owedRows = (draft: Draft): ReadonlyArray<string> =>
  O.match(draft.flight, {
    onNone: () => [],
    onSome: (flight) => A.filter(R.keys(flight.rows), (rowId) => O.isNone(latest(draft, rowId)))
  })

/** The draft without the rows its save that is out owes: they are not judged with the rest. */
const withoutOwed = (draft: Draft, owed: ReadonlyArray<string>): Draft => ({
  ...draft,
  flight: O.map(draft.flight, (flight) => ({
    ...flight,
    rows: R.filter(flight.rows, (_side, rowId) => !A.contains(owed, rowId))
  }))
})

/**
 * Rows a save from before a confirm owed, now that its answer says they were not written (refused, lost, or decided
 * otherwise before the confirm): named once, as the close would have named them had their fate been known then. Into
 * a draft that ended, against its closed picture; into the import opened again, against what is known of it; with no
 * picture held, all of them.
 */
const owedNamed = (draft: Draft, decisions: ReadonlyArray<OfRow>, unsure: ReadonlyArray<OfRow>): Stepped => {
  if (!A.isReadonlyArrayNonEmpty(decisions)) return only(draft)
  const named = naming(decisions, noRows, unsure)
  if (draft.ended) {
    return only({
      ...draft,
      leftOver: leaving(draft, againstImport(named, draft.endedOn)),
      saidByClose: joined([draft.saidByClose, saidByImport(named, draft.endedOn)])
    })
  }
  // One equal to a decision this tab holds still (a closed tab's, taken up since) is that one's: not named.
  const against = O.flatMap(O.isSome(draft.held) ? asImportHolds(named, known(draft)) : O.some(named), (left) =>
    notHeld(draft, left)
  )
  return { draft, effects: sayNamed(against) }
}

/** The side of a row among these, with its row: none where there is none. */
const sideOf = (sides: Sides, rowId: string): Result.Result<readonly [string, Side], void> =>
  O.match(R.get(sides, rowId), {
    onNone: () => Result.failVoid,
    onSome: (side) => Result.succeed([rowId, side] as const)
  })

/**
 * What a save's sides owe her, to be named, and which of them the server may hold: all, where its answer was lost; else
 * each sent before with a fate not known (`maySaved`).
 */
const owedOf = (
  sides: ReadonlyArray<readonly [string, Side]>,
  lost: boolean
): readonly [ReadonlyArray<OfRow>, ReadonlyArray<OfRow>] => {
  const of = (all: ReadonlyArray<readonly [string, Side]>): ReadonlyArray<OfRow> =>
    A.map(all, ([rowId, side]): OfRow => [rowId, side.decision])
  return [of(sides), of(lost ? sides : A.filter(sides, ([, side]) => maySaved(side)))]
}

/**
 * A stray's save was refused, or lost: what it still owed is named once, and nothing is remembered of it. Refused, it
 * was not written; lost, it may have been, before the import was confirmed (`lost`).
 */
const strayNotWritten = (draft: Draft, id: number, lost: boolean): Stepped =>
  O.match(R.get(draft.strays, `${id}`), {
    onNone: () => only(draft),
    onSome: (stray) =>
      owedNamed(
        withoutStray(draft, id),
        ...owedOf(
          A.filterMap(stray.owed, (rowId) => sideOf(stray.rows, rowId)),
          lost
        )
      )
  })

/**
 * The lines with only the sides this tab was refused (`refused`), or only the others. Such a side was named when the
 * server refused it (`Said.Refused`, and its line): a close or a confirm since does not name it again. A closed tab's
 * refused side was told in that tab, not here: it is named with the rest.
 */
const refusedApart = (lines: Readonly<Record<string, Line>>, refused: boolean): Readonly<Record<string, Line>> =>
  R.filter(
    R.map(lines, (line): Line => ({
      sides: A.filter(line.sides, (side) => (side.here && O.isSome(side.refused)) === refused),
      theirs: refused ? O.none() : line.theirs
    })),
    (line) => A.isReadonlyArrayNonEmpty(line.sides)
  )

/**
 * The import can no longer be decided (somebody confirmed it, or it was taken back): the draft ends, and nothing is
 * sent to it. Every decision of the person's the server never took is kept aside to be named, each line whole, unless
 * the picture already says it: that was part of what was written.
 */
const closing = (draft: Draft, picture: Picture): Stepped => {
  // The save that is out becomes a stray. Each of its rows stands under a later decision of hers, named here, or is
  // owed its answer: what the save did with it is not known yet, and it is named only once that answer says.
  const owed = owedRows(draft)
  // A save out from an earlier opening is answered on its own (`Stray`): what it owes is not judged here.
  // A refused side was named when it was refused: not again.
  const alive = O.map(
    waiting({ ...withoutOwed(draft, owed), ended: false, strays: {}, lines: refusedApart(draft.lines, false) }),
    decisionsIn
  )
  const ended = startAgain(draft)
  const strays = O.match(draft.flight, {
    onNone: () => ended.strays,
    onSome: (flight): Draft["strays"] => ({
      ...ended.strays,
      [flight.id]: { rows: flight.rows, owed, closedAt: picture.revision }
    })
  })
  // What an earlier closed picture said of hers is judged again against this one (the import was opened, decided
  // otherwise and confirmed again with no open picture read between): what this one no longer holds is left over, to be
  // named; what it still holds stays said by the close.
  const said = [...A.fromOption(alive), ...A.fromOption(draft.saidByClose)]
  return {
    draft: {
      ...ended,
      strays,
      onScreen: draft.onScreen,
      leftOver: leaving(draft, joined(A.map(said, (named) => againstImport(named, picture.decisions)))),
      saidByClose: joined(A.map(said, (named) => saidByImport(named, picture.decisions))),
      ended: true,
      endedOn: picture.decisions
    },
    effects: [DraftEffect.Restart({ announce: false })]
  }
}

/** A picture of an import that can still be decided: the draft follows it. */
const following = (draft: Draft, picture: Picture, takenBack: ReadonlyArray<TakenBackAt>): Stepped =>
  O.match(draft.held, {
    // The first picture seen is where the region starts.
    onNone: () => {
      const after = { ...draft, held: O.some(picture), landed: landedAfter(draft, picture.revision) }
      return only({ ...after, typed: typedSkus(known(after)) })
    },
    onSome: (held) => {
      // An earlier answer that arrives late never replaces a later one.
      if (picture.revision < held.revision) return only(draft)
      // The same revision said differently: the server's word stands. The picture held was moved on by the
      // person's own save, and that save changed nothing the server did not already have from someone else.
      if (picture.revision === held.revision && Eq.equals(picture.decisions, held.decisions)) return only(draft)
      const after = lined({
        // Somebody may have decided a row that waits: it goes over what it was pressed on, and nothing else.
        ...noneLive(draft),
        held: O.some(picture),
        // The person's saved rows are in a picture of their revision or later, each row by its own.
        landed: landedAfter(draft, picture.revision)
      })
      const apart = R.keys(changesBetween({ before: shown(draft), after: shown(after) }))
      // The rows the matches of this jump took back: a change to one of them is theirs, said as taken back. Any other
      // row the jump changed is somebody else's, and said so.
      const explained = A.flatMap(takenBack, (taken): ReadonlyArray<string> =>
        taken.revision > held.revision && taken.revision <= picture.revision ? taken.rows : []
      )
      return restarting({
        before: draft,
        after:
          // A confirm held back already: this is the newer picture, read, with the rows it decides otherwise.
          O.isSome(draft.heldBack)
            ? reached(after)
            : draft.confirm === "waiting"
              ? A.isReadonlyArrayNonEmpty(apart)
                ? // A newer picture from elsewhere holds the confirm back: it is the newer picture, read.
                  holdingBack(after, { until: picture.revision })
                : // Nothing shown changed: it may be the picture the person's own save leaves. Its answer tells.
                  { ...after, seenWhileWaiting: O.some(picture.revision) }
              : after,
        announce: !draft.matching && A.some(apart, (rowId) => !A.contains(explained, rowId))
      })
    }
  })

const arriving = (draft: Draft, event: Data.TaggedEnum.Value<DraftEvent, "ViewArrived">): Stepped => {
  const { confirms, decisions, revision } = event
  const picture: Picture = { revision, decisions }
  // A picture older than what an answer has said already is late: the import was opened again since, or it says
  // nothing new.
  const knownAt = Math.max(heldAt(draft), O.match(draft.landed, { onNone: () => 0, onSome: (landed) => landed.at }))
  if (!event.open && revision < knownAt) return only(draft)
  // A confirm out while the import was confirmed since it was pressed: if it is not the one made, what it carries was
  // decided before that confirm (`confirmOutlived`).
  const outlivesConfirm =
    draft.confirmOutlived || (draft.confirm === "out" && O.exists(draft.confirms, (before) => confirms > before))
  // The confirm that is out is this screen's own: its answer says whether it is the one that closed the import. The
  // count of confirms stays the one of the picture she is shown: what she decides on it meanwhile was decided in that
  // opening, and is never sent into the import opened again as made in this one.
  if (!event.open) {
    return draft.confirm === "out"
      ? only({ ...draft, closedSeen: O.some(picture), confirmOutlived: outlivesConfirm })
      : closing(draft, picture)
  }
  // Open again after it had ended (reopened to review again): what was left over is said now, unless the result has
  // named it already, and is not sent into the reopened import.
  const reopened: Draft = draft.ended
    ? { ...draft, ended: false, endedOn: {}, leftOver: O.none(), saidByClose: O.none() }
    : draft
  // What the closed picture already said of hers, and the reopened import says otherwise, is named with it: had that
  // picture not come first, it would be named as outlived below. A closed picture that arrives late then decides
  // nothing of what is said to her.
  // In a draft that goes on, what is left over is what saves from before a confirm owed, kept across a reload with no
  // answer to say what became of them: named now.
  // Either way, one equal to a decision this tab holds still (a closed tab's, taken up since) is that one's: not named.
  const unnamed = O.flatMap(
    draft.ended
      ? joined([draft.leftOver, O.flatMap(draft.saidByClose, (named) => againstImport(named, decisions))])
      : draft.leftOver,
    (named) => notHeld({ ...reopened, leftOver: O.none() }, named)
  )
  // The import was confirmed since the person's decisions were made, and opened again: they were not part of that
  // confirm, and are not sent into the reopened import. They are named, each line whole, and let go.
  const confirmedSince = O.exists(reopened.confirms, (before) => confirms > before)
  const { unsent: rows } = reopened
  // A line's refused side was named when the server refused it: it stays on its line, and is not named again.
  const lines = refusedApart(reopened.lines, false)
  const refusedLines = refusedApart(reopened.lines, true)
  // A decision equal to one of hers out with the confirm is judged with that confirm, not named here. (A save that is
  // out becomes a stray below, owing only the rows decided nowhere since: these are named.)
  const outlived = confirmedSince
    ? O.flatMap(
        asImportHolds(decisionsIn({ rows, lines, confirms: O.none(), leftOver: O.none() }), decisions),
        (named) =>
          notHeld(
            {
              ...reopened,
              unsent: {},
              lines: {},
              // A save that is out becomes a stray owing its rows decided nowhere since: one equal to those is judged
              // with its answer. A confirm that is out is judged with all it carries.
              flight:
                reopened.confirm === "out"
                  ? reopened.flight
                  : O.map(reopened.flight, (flight) => ({
                      ...flight,
                      rows: R.filter(flight.rows, (_side, rowId) => A.contains(owedRows(reopened), rowId))
                    }))
            },
            named
          )
      )
    : O.none<Named>()
  const isAnswer = event.waiting !== true
  // A save of hers out from before that confirm is no longer waited for: what it carries was decided in the opening
  // before, and its answer says whether it was part of that confirm (`Stray`). A confirm of hers that is out stays.
  const strayed: Draft =
    confirmedSince && reopened.confirm !== "out"
      ? O.match(reopened.flight, {
          onNone: () => reopened,
          onSome: (flight) => ({
            ...reopened,
            flight: O.none(),
            confirm: "idle",
            strays: {
              ...reopened.strays,
              [flight.id]: { rows: flight.rows, owed: owedRows(reopened), closedAt: revision }
            }
          })
        })
      : reopened
  const followed: Draft = {
    ...strayed,
    confirmOutlived: strayed.confirm === "out" && outlivesConfirm,
    leftOver: O.none(),
    ...(confirmedSince ? { unsent: {}, lines: refusedLines } : {}),
    confirms: O.some(confirms),
    matches: A.dedupe([...strayed.matches, ...(event.matches ?? [])]),
    takenBack: event.takenBack ?? [],
    waitsForPicture: strayed.waitsForPicture && !(isAnswer && revision >= heldAt(strayed)),
    // A closed picture seen while the confirm was out, and since outdated by this open one (the import was opened
    // again): the confirm's answer no longer ends the draft on it.
    closedSeen: O.filter(strayed.closedSeen, (seen) => seen.revision > revision)
  }
  const named = sayNamed(joined([unnamed, outlived]))
  const arrived = then({ draft: followed, effects: named }, (now) => following(now, picture, event.takenBack ?? []))
  // An answer of the server's: it can be reached, so what waits goes. The view the tab holds, given while it is asked
  // anew, is no answer: the one that is out brings it.
  return isAnswer ? then(arrived, sending) : arrived
}

// -- The person's own presses ----------------------------------------------------------------------------------------

/** The person decided one row: it waits, or it is this tab's side of the row's line where a closed tab's still asks. */
const deciding = (draft: Draft, book: Book, rowId: string, decision: O.Option<RowDecision>): void => {
  const at = heldAt(draft)
  const theirs = knownOf(draft, rowId)
  const out = R.get(flying(draft), rowId)
  const waits = R.get(book.unsent, rowId)
  // The decision this one rests on: the one the screen showed, where it is hers and not on the server yet.
  const rests = O.orElse(
    O.orElse(waits, () => shownSide(draft, rowId)),
    () => out
  )
  // A closed tab's refused decision is decided again by this one: it stays on the line until this one is saved.
  const rest = A.map(
    A.filter(sidesOf(book, rowId), (one) => !one.here),
    (one) => (isGood(one) ? one : { ...one, overtaken: true })
  )
  const replaced = A.filter(sidesOf(book, rowId), (one) => one.here)
  const side: Side = {
    decision,
    // Made over one of hers that waits, on the revision that one was made on: a closed tab's may be newer than the
    // picture this tab holds, and the screen never takes that older picture for news about it.
    madeOn: O.match(rests, { onNone: () => at, onSome: (one) => one.madeOn }),
    dates: datesOf(rests, decision, at),
    // Over what the server was known to hold when she began; where her earlier one was not shown (refused, or decided
    // since), over what the screen showed instead, and what the earlier one may have left there. Pressed on a screen
    // that showed what the server holds, it stands over that too: she saw it.
    // A decision of hers that is out may be on the server by the time this one goes.
    seen: eachDecision([
      ...O.match(rests, {
        onNone: () => [
          theirs,
          ...A.flatMap(replaced, (one) => one.seen),
          ...O.getOrElse(R.get(book.sentBefore, rowId), () => [])
        ],
        onSome: (one) => [...one.seen, ...(sameDecision(R.get(shown(draft), rowId), theirs) ? [theirs] : [])]
      }),
      ...A.map(A.fromOption(out), (one) => one.decision)
    ]),
    // Made over one of hers that waited, it waited too; made beside a closed tab's decision of the row (taken up since
    // the one it rests on was pressed), it goes over what it names, never as a live press.
    live:
      !A.isReadonlyArrayNonEmpty(rest) &&
      O.match(rests, {
        onNone: () => O.isSome(draft.held) && O.isNone(draft.landed),
        onSome: (one) => one.live
      }),
    here: true,
    overtaken: false,
    refused: O.none()
  }
  // Decided back to what the server is known to hold, with nothing sent that says otherwise: there is nothing to send (a
  // clear would take back a decision somebody else may have made on that row since).
  const undone = O.isNone(out) && Eq.equals(decision, theirs) && A.every(side.seen, (one) => Eq.equals(one, decision))
  delete book.sentBefore[rowId]
  const own = undone ? O.none<Side>() : O.some(side)
  if (A.some(rest, isGood)) {
    delete book.unsent[rowId]
    putLine(book, rowId, [...A.map(A.fromOption(own), (one) => ({ ...one, live: false })), ...rest])
  } else {
    putLine(book, rowId, rest)
    putUnsent(book, rowId, own)
  }
}

/**
 * One line settled by the person's pick; the other answers on it, which it names, are let go. A side is sent as the
 * person's decision: on the revision it was made on (never re-dated), over what its own tab knows the server may hold
 * and what the line showed the server to hold. A refused side is never sent: it stays, alone, until it is dismissed or
 * the row is decided again. A pick the line does not have changes nothing, nor one made while this tab's decision of the
 * row is on its way.
 */
const picking = (draft: Draft, book: Book, { keep, rowId }: LinePick): void => {
  // This tab's decision of the row is on its way: its answer may change what the server holds, and a pick made now
  // could be undone by it. The line's picks wait for that answer (`lineWords`), and a press made anyway does nothing.
  if (R.has(flying(draft), rowId)) return
  const line = R.get(book.lines, rowId)
  const sides = sidesOf(book, rowId)
  // What the sides let go may have put on the server: this tab's, and what a closed tab sent whose fate is not known.
  const mayHold = (one: Side): ReadonlyArray<O.Option<RowDecision>> =>
    one.here ? one.seen : hasDecision(one.seen, one.decision) ? [one.decision] : []
  // What is saved stays: the line goes, and what its sides may have put on the server is remembered.
  const keepSaved = (): void => {
    book.sentBefore[rowId] = A.takeRight(
      eachDecision([...O.getOrElse(R.get(book.sentBefore, rowId), () => []), ...A.flatMap(sides, mayHold)]),
      overBound
    )
    delete book.lines[rowId]
  }
  Keep.$match(keep, {
    Theirs: keepSaved,
    Side: ({ decision }) =>
      void O.map(
        A.findFirst(sides, (side) => sameDecision(side.decision, decision)),
        (side) => {
          if (!isGood(side)) {
            book.lines[rowId] = { sides: [side], theirs: O.none() }
            return
          }
          // A decision of hers whose value the server holds already is sent all the same: values do not say who wrote
          // them, and the picture may be older than what the server holds now. The server writes it as hers, or answers
          // that the row was decided otherwise since, and the line asks again.
          const theirs = knownOf(draft, rowId)
          const said =
            O.exists(line, (one) => O.isSome(one.theirs)) || A.some(sides, (one) => sameDecision(one.decision, theirs))
          delete book.lines[rowId]
          // Over what its own tab knows the server may hold, what the line showed it to hold, and what the other sides
          // she lets go may have put there (a closed tab's sent, its fate not known): never what another tab only saw.
          const others = A.flatMap(
            A.filter(sides, (one) => one !== side),
            mayHold
          )
          book.unsent[rowId] = {
            ...side,
            seen: eachDecision([...side.seen, ...(said ? [theirs] : []), ...others]),
            // Hers from this tab now, whichever tab made it: this tab sends it.
            here: true,
            overtaken: false,
            live: false
          }
        }
      )
  })
}

/**
 * One row of a tab's entry, taken up, and none of its decisions lost, whatever this tab holds of the row: with nothing
 * of it here, the row is as it was there; beside a decision or a line of this tab's, each is a side of the row's line,
 * unless it is the same decision.
 */
const takingUp = (
  draft: Draft,
  book: Book,
  row: { readonly rowId: string; readonly kept: Waiting; readonly here: boolean }
): void => {
  const { here, kept, rowId } = row
  const own = latest(book, rowId)
  const out = R.get(flying(draft), rowId)
  const line = sidesOf(book, rowId)
  const asHere = (side: Side): Side => ({ ...side, here: here && side.here && O.isNone(own), live: false })
  const waits = A.map(A.fromOption(R.get(kept.rows, rowId)), asHere)
  const sides = A.map(sidesOf(kept, rowId), asHere)
  if (O.isNone(own) && O.isNone(out) && !A.isReadonlyArrayNonEmpty(line)) {
    putUnsent(book, rowId, A.head(waits))
    putLine(book, rowId, sides)
    return
  }
  // Beside this tab's own, which stays what it is until the line asks (`lined`): each is a side of the row's line, the
  // same decision as this tab's too, so that it is still there if this tab decides the row again.
  putLine(book, rowId, withSides(line, [...waits, ...sides]))
}

/**
 * A naming without the decisions this tab holds of its own, the same, waiting, on their way or on a line: those are
 * hers still, judged with this tab's, and naming them now would say "not sent" of one that waits to be.
 */
const notHeld = (draft: Draft, named: Named): O.Option<Named> => {
  const holds = (rowId: string, decision: O.Option<RowDecision>): boolean =>
    A.some(
      [
        ...A.fromOption(R.get(draft.unsent, rowId)),
        ...A.fromOption(R.get(flying(draft), rowId)),
        ...R.get(draft.lines, rowId).pipe(
          O.map((line) => line.sides),
          O.getOrElse((): ReadonlyArray<Side> => [])
        )
      ],
      (side) => sameDecision(side.decision, decision)
    )
  const left = naming(
    A.filter(eachNamed(named), ([rowId, decision]) => !holds(rowId, decision)),
    named.theirs,
    unsureOf(named)
  )
  return R.isEmptyReadonlyRecord(left.rows) ? O.none() : O.some(left)
}

/** What a tab kept, taken up: never dropped without a word. */
const takingUpAll = (draft: Draft, kept: Waiting, here: boolean): Stepped => {
  const theirs = decisionsIn(kept)
  // Into a draft that ended, the rows its closed picture does not hold are left over, named by the result.
  if (draft.ended) {
    return only({
      ...draft,
      leftOver: leaving(draft, againstImport(theirs, draft.endedOn)),
      saidByClose: joined([draft.saidByClose, saidByImport(theirs, draft.endedOn)])
    })
  }
  // Rows a closed import left over, or of an import confirmed since, are named and let go: never sent. A row is let go
  // unnamed only where what she is shown holds it, and so does the closed picture read while this screen's confirm is
  // out: the picture she is shown is from before that confirm, and the closed one may hold somebody else's value.
  const againstBoth = (named: Named): O.Option<Named> =>
    joined([
      againstImport(named, known(draft)),
      O.flatMap(draft.closedSeen, (seen) => againstImport(named, seen.decisions))
    ])
  const outlived = O.exists(kept.confirms, (before) => O.exists(draft.confirms, (now) => now > before))
  const waits = !R.isEmptyReadonlyRecord(kept.rows) || !R.isEmptyReadonlyRecord(kept.lines)
  if (outlived || (O.isSome(kept.leftOver) && !waits)) {
    return {
      draft,
      effects: sayNamed(O.flatMap(againstBoth(theirs), (named) => notHeld(draft, named)))
    }
  }
  // What saves from before a confirm owed, kept beside rows that wait, is named; the rows that wait are taken up.
  if (O.isSome(kept.leftOver)) {
    const named = sayNamed(O.flatMap(againstBoth(kept.leftOver.value), (left) => notHeld(draft, left)))
    const rest = takingUpAll(draft, { ...kept, leftOver: O.none() }, here)
    return { draft: rest.draft, effects: [...named, ...rest.effects] }
  }
  const taken = editing(draft, (book) => {
    for (const rowId of A.dedupe([...R.keys(kept.rows), ...R.keys(kept.lines)])) {
      takingUp(draft, book, { rowId, kept, here })
    }
  })
  const next = { ...taken, confirms: O.orElse(taken.confirms, () => kept.confirms) }
  // With no picture held yet, the first one sends them.
  return O.isSome(draft.held) ? sending(next) : only(next)
}

// -- The transition --------------------------------------------------------------------------------------------------

/**
 * What one event does to a draft, and what to do about it.
 *
 * @example step(emptyDraft, DraftEvent.ViewArrived({ revision: 4, decisions: {}, open: true, confirms: 0 })).draft.held // some: revision 4
 */
export const step: {
  (event: DraftEvent): (draft: Draft) => Stepped
  (draft: Draft, event: DraftEvent): Stepped
} = dual(2, (draft: Draft, event: DraftEvent): Stepped => {
  const stepped = transition(draft, event)
  // The import is asked for once per event, however many parts of the transition want a fresh picture.
  const asks = A.findFirstIndex(stepped.effects, DraftEffect.$is("Ask"))
  const effects = O.match(asks, {
    onNone: () => stepped.effects,
    onSome: (first) => A.filter(stepped.effects, (effect, at) => at === first || !DraftEffect.$is("Ask")(effect))
  })
  return told(draft, event, { draft: reached(lined(stepped.draft)), effects })
})

/**
 * The rule every transition is held to, whatever it did: when what the screen shows is another thing after an event
 * that was not the person's own decision, the region is told to start again. Its own state (the decisions it drew,
 * their undo history) would otherwise go on saying what it said, while the totals and the confirm say the new
 * thing. A transition that says so itself (with its own `announce`) is left as it is.
 */
const told = (before: Draft, event: DraftEvent, stepped: Stepped): Stepped => {
  if (A.some(stepped.effects, DraftEffect.$is("Restart")) || O.isNone(before.held)) return stepped
  // The person's own press is drawn by the region as she made it; where the screen shows another thing for it (the row
  // went onto a line: somebody decided it since), the region is drawn again from what is shown.
  if (DraftEvent.$is("Decided")(event)) {
    return sameShown(over(shown(before), event.changes), shown(stepped.draft))
      ? stepped
      : {
          draft: { ...stepped.draft, epoch: stepped.draft.epoch + 1 },
          effects: [...stepped.effects, DraftEffect.Restart({ announce: false })]
        }
  }
  // The draft was let go while nobody looked: the next visit reads it anew, and the region must too. A return inside
  // the idle time would otherwise find the region as it was, over a view that may have changed meanwhile.
  if (O.isNone(stepped.draft.held)) {
    return stepped.draft.onScreen
      ? stepped
      : { draft: stepped.draft, effects: [...stepped.effects, DraftEffect.Restart({ announce: false })] }
  }
  if (Eq.equals(shown(before), shown(stepped.draft))) return stepped
  // Said as a change on another screen only where it was one: not the person's own pick or press, a save refused, or
  // accepts taken back (said in their own words).
  const elsewhere =
    !DraftEvent.$is("Settled")(event) &&
    !DraftEvent.$is("ConfirmPressed")(event) &&
    !DraftEvent.$is("SaveRefused")(event) &&
    !A.some(stepped.effects, (effect) => DraftEffect.$is("Say")(effect) && Said.$is("AcceptsTakenBack")(effect.what))
  return {
    draft: { ...stepped.draft, epoch: stepped.draft.epoch + 1 },
    effects: [...stepped.effects, DraftEffect.Restart({ announce: elsewhere })]
  }
}

const transition = (draft: Draft, event: DraftEvent): Stepped =>
  DraftEvent.$match(event, {
    // What this browser kept from before a reload comes back as it was. Nothing is sent here: the picture the step
    // finds arrives next, and says whether the import can still be decided.
    Opened: ({ kept }) => {
      const opened: Draft = { ...draft, onScreen: true }
      if (!holdsNothing(opened) || O.isNone(kept)) return only(opened)
      const { confirms, leftOver, lines, rows } = kept.value
      // Kept with nothing waiting beside it, what was left over is of an import that ended. Beside rows that wait, it is
      // what saves from before a confirm owed: named on the picture that comes next (`arriving`), never sent.
      return only(
        O.isSome(leftOver) && R.isEmptyReadonlyRecord(rows) && R.isEmptyReadonlyRecord(lines)
          ? { ...opened, leftOver, ended: true }
          : { ...opened, unsent: rows, lines, confirms, leftOver }
      )
    },
    Left: () => only(letGo({ ...draft, onScreen: false, matching: false })),
    TakenUp: ({ here, kept }) => takingUpAll(draft, kept, here === true),
    LeftOverNamed: () => only(draft.ended ? { ...draft, leftOver: O.none() } : draft),
    MatchStarted: () => only({ ...draft, matching: true }),
    MatchEnded: () => only({ ...draft, matching: false }),
    // The person's rows, the latest over the earliest; sent at once unless a save is out, with whatever waits.
    // A press that leaves an undecided row undecided is no decision: nothing is sent, and nothing named.
    Decided: ({ changes }) => {
      const now = shown(draft)
      const decided = R.filter(
        changes,
        (decision, rowId) => !(sameDecision(R.get(now, rowId), O.none()) && sameDecision(decision, O.none()))
      )
      if (R.isEmptyReadonlyRecord(decided)) return only(draft)
      // A save from before a confirm owes no row decided again over what it carried: this tab's decision, or a closed
      // tab's the screen showed. A closed tab's the screen no longer shows is still owed, and named if not written.
      const replaced = A.filter(R.keys(decided), (rowId) =>
        A.every(
          R.values(draft.strays),
          (stray) =>
            !A.contains(stray.owed, rowId) ||
            O.exists(R.get(stray.rows, rowId), (side) => side.here || sameDecision(side.decision, R.get(now, rowId)))
        )
      )
      return sending(
        editing(decidedAgain({ ...draft, leftOver: decidedOver(draft, R.keys(decided)) }, replaced), (book) => {
          for (const [rowId, decision] of R.toEntries(decided)) deciding(draft, book, rowId, decision)
        })
      )
    },
    // Lines are drawn over a picture: before one is held, a row's own waiting decision is not on its line yet, and a
    // pick would drop it unseen.
    Settled: ({ picks }) =>
      O.isNone(draft.held)
        ? only(draft)
        : sending(
            editing(
              decidedAgain(
                draft,
                A.map(
                  A.filter(picks, (pick) => decidesRow(draft, pick)),
                  (pick) => pick.rowId
                )
              ),
              (book) => {
                for (const pick of picks) picking(draft, book, pick)
              }
            )
          ),
    SaveAgain: () => sending(draft),
    // Lost: whether the server wrote it is not known.
    SaveFailed: ({ id }) => failing(draft, id, Said.NotSaved(), true),
    // Nobody signed in: the rows wait as after a failure, and are sent once a save is taken again.
    SaveSignedOut: ({ id }) => failing(draft, id, Said.SignedOut(), false),
    // The screen goes back to the decisions the server holds, and the import is asked again. The rows the refused save
    // carried stay on their lines with the server's sentence (beside a closed tab's where one is alive: "Keep both, she
    // picks", Benjamin, 2026-11-21), unless decided again since. The rows behind it, never sent, still wait.
    SaveRefused: ({ id, reason }) =>
      O.match(outWith(draft, id), {
        onNone: () => strayNotWritten(draft, id, false),
        onSome: (rows): Stepped => ({
          draft: {
            ...editing(noneLive({ ...draft, flight: O.none() }), (book) => {
              for (const [rowId, sent] of R.toEntries(rows)) {
                if (O.isSome(latest(book, rowId))) continue
                // Sent from this tab and refused here, it is this tab's: told by the refusal, never named again
                // (`refusedApart`), whichever tab made it.
                const refused: Side = { ...sent, live: false, here: true, refused: O.some(reason) }
                // The server's word is the newest of the same decision: refused, whichever tab also had it.
                putLine(
                  book,
                  rowId,
                  A.map(withSides([refused], sidesOf(book, rowId)), (side) =>
                    sameDecision(side.decision, refused.decision)
                      ? { ...side, here: true, refused: refused.refused }
                      : side
                  )
                )
              }
            }),
            confirm: "idle"
          },
          effects: [DraftEffect.Say({ what: Said.Refused({ reason }) }), DraftEffect.Ask()]
        })
      }),
    SaveAnswered: (answer) =>
      O.match(outWith(draft, answer.id), {
        onNone: () => answeringStray(draft, answer),
        onSome: (sent) => answering(draft, sent, answer)
      }),
    ConfirmPressed: () => {
      // While the newer picture is being read after a confirm that was not made, the button waits for it.
      if (draft.confirm !== "idle" || O.isNone(draft.held) || O.exists(draft.heldBack, (why) => !why.read)) {
        return only(draft)
      }
      const pressed: Draft = { ...draft, heldBack: O.none(), pressedOn: shown(draft) }
      // A line asks: said at once, whatever is out.
      if (!R.isEmptyReadonlyRecord(pressed.lines)) return confirming(pressed)
      // Their own save is out: the confirm waits for its answer, and goes on the picture that save leaves.
      if (O.isSome(pressed.flight)) return only({ ...pressed, confirm: "waiting" })
      // The picture held is known to be behind (somebody else saved before the person's last save): the newer one
      // is asked for, and the confirm waits for the person to have seen it.
      if (O.isSome(pressed.landed)) {
        return { draft: holdingBack(pressed, { until: pressed.landed.value.at }), effects: [DraftEffect.Ask()] }
      }
      return confirming(pressed)
    },
    // The draft ends on the picture the confirm answered with: rows the person decided while it was out were not part
    // of it, and the result names them; the rows it carried are in that picture, and are not.
    ConfirmDone: ({ decisions, id, revision }) =>
      O.isNone(outWith(draft, id))
        ? only(withoutStray(draft, id))
        : closing({ ...draft, confirm: "idle", flight: O.none() }, { revision, decisions }),
    // Nothing was written. The newer picture is asked for, and the person's rows are saved as any decision is.
    ConfirmMoved: ({ id }) =>
      notConfirmed(draft, id, {
        lost: false,
        back: notLanded,
        // The server is past the revision the confirm named: the newer picture is one after it, at least.
        then: (back) =>
          then(sending(holdingBack(back, { until: draft.confirmOn + 1 })), (after) => ({
            draft: after,
            effects: [DraftEffect.Ask()]
          }))
      }),
    // Refused for another reason than a moved draft (the import is closed), or the answer was lost on its way back:
    // what was written is not known. Nothing is sent and nothing offered as a save: the import is asked for, and a
    // closed picture names what it does not hold; an open one has the rows sent.
    ConfirmFailed: ({ id }) =>
      notConfirmed(draft, id, {
        lost: true,
        back: landingUnknown,
        then: (back) => ({ draft: { ...back, waitsForPicture: true }, effects: [DraftEffect.Ask()] })
      }),
    // Nothing was written. The accepts are taken out of the rows the confirm carried, which are then saved as any
    // decision is (a row left with only what the server holds is not sent); the person is told which, and confirms
    // again. The server checked the revision first: it is the one the confirm named, so nothing newer is to be read.
    ConfirmStale: ({ accepts, id }) =>
      notConfirmed(draft, id, {
        lost: false,
        back: notLanded,
        then: (back, rows) => {
          const gone = partsNamed(accepts)
          const stripped = editing(back, (book) => {
            for (const [rowId, sent] of R.toEntries(rows)) {
              const isGone = gone(rowId)
              changeLatest(book, rowId, (side) => {
                const left = withoutSentParts({ side, sent, gone: isGone, judgedAt: 0 })
                // Only accepts over what the server may hold are emptied: what is left is no decision of hers. Where she
                // decided more (left out a row whose accept she had sent), what is left is hers, though the picture
                // holds an equal value: values do not say who wrote them, and it is sent.
                const emptied =
                  !Eq.equals(left.decision, side.decision) &&
                  sameDecision(left.decision, knownOf(back, rowId)) &&
                  A.every(left.seen, (one) =>
                    sameDecision(
                      withParts(one, (part) => !isGone(part)),
                      left.decision
                    )
                  )
                return emptied ? O.none() : O.some(left)
              })
            }
          })
          return then(sending(holdingBack(stripped, { until: draft.confirmOn, accepts })), (after) => ({
            draft: after,
            effects: [DraftEffect.Say({ what: Said.AcceptsTakenBack({ accepts }) }), DraftEffect.Ask()]
          }))
        }
      }),
    ViewArrived: (event) => arriving(draft, event)
  })
