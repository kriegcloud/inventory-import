// The review's draft for one import, as one pure transition: what this screen holds of the server's decisions, what
// the person changed here that the server has not confirmed yet, and what each thing that can happen (a decision, a
// save answered, failed or refused, a view arriving, leaving and coming back) does to both. It says what to send and
// what to ask; it sends and asks nothing itself, so every ordering of those events can be tested without a server.
//
// The one rule a reader must not break: what is sent is what the person did. A save carries the rows the person
// changed on this screen and nothing else, and so does a confirm: it names the revision of the picture the screen
// holds and carries the person's rows the server has not been sent, never the picture itself. The server's picture is
// something the screen follows; it is never the base a difference is worked out from, so a picture that is behind
// can never take back another person's decision, and a confirm never writes a decision the screen had not shown.
import * as A from "effect/Array"
import * as Data from "effect/Data"
import { dual } from "effect/Function"
import * as Eq from "effect/Equal"
import * as O from "effect/Option"
import * as R from "effect/Record"
import {
  type DecisionDelta,
  decisionFromFlags,
  decisionToFlags,
  type SavedDecisions,
  type TakenBackKind
} from "@inventory/catalog-contract/Decision"

/** One row's decision, as the server keeps it. */
export type RowDecision = SavedDecisions[string]

/** What the person changed, row by row: a decision to save, or none where the row's decision was taken back. */
export type RowChanges = Readonly<Record<string, O.Option<RowDecision>>>

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

/**
 * Why one of the person's rows has a line above the review (Benjamin, 2026-11-20, group 3): the server refused this
 * tab's decision of it, with its sentence; or this tab's decision waited, and was decided otherwise since by someone
 * else or another tab (`theirs`, what the server holds now, followed picture by picture), and the person picks which
 * stands; or this tab's decision is as it was (waiting, on its way or saved), and a tab of theirs that is gone had
 * decided the row otherwise (`HeldRow.closed`), and the person picks which stands ("Hold it, show both, ask").
 */
export type Hold = Data.TaggedEnum<{
  Refused: { readonly reason: string }
  Elsewhere: { readonly theirs: O.Option<RowDecision> }
  OtherTab: {}
}>
export const Hold = Data.taggedEnum<Hold>()

/**
 * A decision of a row that a tab of the person's that is gone made and the server has not taken, on the row's line
 * beside this tab's own until the person picks ("Keep both, she picks", Benjamin, 2026-11-21): never sent, and never
 * let go, by itself.
 */
export interface ClosedTab {
  readonly decision: O.Option<RowDecision>
  readonly madeOn: number
  /** The values the server may have of the row from that tab (`Draft.seen`): none where that is not known. */
  readonly seen: O.Option<ReadonlyArray<O.Option<RowDecision>>>
  /** The server's sentence, where it refused this decision in that tab: it is then never sent by a pick. */
  readonly refused: O.Option<string>
}

/** One match's take-back as the draft reads it: the revision the match wrote, and the rows it names. */
export interface TakenBackAt {
  readonly revision: number
  readonly rows: ReadonlyArray<string>
}

/**
 * One row's line above the review: this tab's decision of it, the revision that was made on, why the line is there,
 * and every other decision of the row still alive from tabs of the person's that are gone. A line `Hold.OtherTab` has
 * at least one of those; each differs from this tab's and from the others.
 */
export interface HeldRow {
  readonly mine: O.Option<RowDecision>
  readonly madeOn: number
  readonly why: Hold
  readonly closed: ReadonlyArray<ClosedTab>
}

/**
 * Which decision of a row's line the person picked: this tab's (`Mine`); what the server holds, which lets the
 * person's go (`Theirs`: "Keep theirs", and "Dismiss" of a refused row alone); or a closed tab's, named by the decision
 * itself, since the decisions on one line all differ.
 */
export type Keep = Data.TaggedEnum<{
  Mine: {}
  Theirs: {}
  Closed: { readonly decision: O.Option<RowDecision> }
}>
export const Keep = Data.taggedEnum<Keep>()

/**
 * Decisions of the person's to be named, row by row: one of each row, and beside it whatever else of the same row was
 * alive (a closed tab's beside this tab's), each once.
 */
export interface Named {
  readonly rows: RowChanges
  readonly beside: Readonly<Record<string, ReadonlyArray<O.Option<RowDecision>>>>
}

/** The person's rows on hold, by row. */
export type HeldRows = Readonly<Record<string, HeldRow>>

/** For each row, the values it is known to have had: the server's when the person began deciding it, then theirs. */
export type Seen = Readonly<Record<string, ReadonlyArray<O.Option<RowDecision>>>>

/** For each of the person's rows, the revision of the picture the screen held when the row was last decided. */
export type MadeOn = Readonly<Record<string, number>>

/**
 * The person's rows the server has not taken, as this browser keeps them between visits: after a reload they come
 * back as the person's waiting rows and are sent again. `madeOn` says, row by row, the revision each was decided on;
 * `confirms` how many confirms the import had in the picture they were decided over, none when that is not known.
 */
export interface Waiting {
  readonly rows: RowChanges
  readonly madeOn: MadeOn
  readonly confirms: O.Option<number>
  /**
   * True for rows left over by an import that was closed, kept only until the result has named them: they are never
   * sent again.
   */
  readonly leftOver: boolean
  /** Rows left over: what else of each row was alive beside the decision in `rows`, to be named with it. */
  readonly beside: Named["beside"]
  /** For each row, the values it is known to have had (`Draft.seen`): absent where that is not known. */
  readonly seen: Seen
  /** The person's rows on hold: kept, never sent, until the person picks or dismisses. */
  readonly held: HeldRows
}

/**
 * One import's draft on this screen. What the screen shows is `held`, with the person's own changes over it in the
 * order they were made: `landed` (saved, but not yet in a picture the screen has read), `flight` (the save that is
 * out) and `unsent` (changed since, or waiting after a save that failed).
 */
export interface Draft {
  /** The server's picture the screen follows: none until the import is first seen. */
  readonly held: O.Option<Picture>
  /**
   * The person's rows the server confirmed at `at`, kept over `held` until a picture of that revision or later is
   * read: the answer said somebody else saved in between, so `held` is behind and cannot be moved on by guessing.
   */
  readonly landed: O.Option<{ readonly rows: RowChanges; readonly at: number }>
  /** The save that is out. One at a time: the next waits and then carries whatever changed since. */
  readonly flight: O.Option<RowChanges>
  readonly unsent: RowChanges
  /**
   * For each row in `unsent`, and in `flight`, the revision the screen held when it was last decided: what a save and
   * a confirm name as each row's `madeOn`, so the server can tell an accept made before its field's column was matched
   * again. One revision per row: a row decided long ago never makes a newer row's accept look stale, and the reverse.
   */
  readonly unsentOn: MadeOn
  readonly flightOn: MadeOn
  /**
   * A confirm was refused or lost without the server saying the draft had moved: nothing is sent until a picture
   * says whether the import can still be decided (a closed one names the rows; an open one has them sent).
   */
  readonly waitsForPicture: boolean
  /**
   * Rows of the person's that went out in a save or a confirm whose fate is not known (it failed or was lost, so the
   * server may have taken it), or that came back from before a reload. Decided back to what the screen knew, such a
   * row is still sent: what the server holds of it is not known.
   */
  readonly sentBefore: ReadonlyArray<string>
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
  /** A save failed in a way that may pass: the person's rows wait in `unsent` for "Save again" or the next decision. */
  readonly stalled: boolean
  /**
   * The person's rows that wait (after a save that failed or was refused before them, a confirm not made, a reload,
   * or taken up from a tab that is gone), each with the revision of the picture held when it began to wait. Such a
   * row is never sent until a fresh picture (an answer, not the view given again) at least as new as that one has
   * been checked for a decision made elsewhere since (Benjamin, 2026-11-20, G2): the import is asked for instead.
   */
  readonly waits: MadeOn
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
  /**
   * The last confirm was not made because a line above the review asks which of two decisions of a row stands (a gone
   * tab's beside this tab's): said on the screen until those lines are settled, when the person imports again.
   */
  readonly heldForLines: boolean
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
   * The step was just drawn (again): the next picture is the view the tab already held, given again, however it is
   * marked. It checks no waiting row (a decision made since may not be in it) and says nothing of what a lost or
   * refused confirm wrote.
   */
  readonly redrawn: boolean
  /**
   * The person's rows that were never saved because the import was closed meanwhile (somebody else confirmed it),
   * or because the server refused them: kept until the result screen has named them, never sent.
   */
  readonly leftOver: O.Option<RowChanges>
  /** What else of those rows was alive beside it (a closed tab's decision of the same row): named with it. */
  readonly leftOverBeside: Named["beside"]
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
   * The person's rows on hold (a refused save, or a waiting row decided otherwise elsewhere since): not shown as
   * standing, not sent, not carried by a confirm, until the person decides the row again, picks theirs or dismisses
   * it. Kept in this browser like the waiting rows: a decision is on the server or still with the person, never
   * neither.
   */
  readonly onHold: HeldRows
  /**
   * For each of the person's rows, every value the server may have of it from this tab since the person began
   * deciding it: what the server was known to hold of it then, and each decision of the person's that was sent (any
   * of which a save that failed may have written). A value that never left the browser is not in it. A waiting row
   * whose picture holds none of them was decided elsewhere since.
   */
  readonly seen: Seen
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

/** A draft of an import nobody has opened: nothing held, nothing of the person's. */
export const emptyDraft: Draft = {
  held: O.none(),
  landed: O.none(),
  flight: O.none(),
  unsent: {},
  unsentOn: {},
  flightOn: {},
  waitsForPicture: false,
  sentBefore: [],
  confirms: O.none(),
  seenWhileWaiting: O.none(),
  stalled: false,
  waits: {},
  epoch: 0,
  matching: false,
  typed: "",
  onScreen: false,
  confirm: "idle",
  heldBack: O.none(),
  heldForLines: false,
  leftOver: O.none(),
  leftOverBeside: {},
  closedSeen: O.none(),
  ended: false,
  endedOn: {},
  onHold: {},
  seen: {},
  pressedOn: {},
  heldUntil: 0,
  confirmOn: 0,
  redrawn: false
}

/** Everything that can happen to a draft. */
export type DraftEvent = Data.TaggedEnum<{
  /**
   * A step of the import that follows its draft is drawn, the first time or again. `kept`: the waiting rows this
   * browser kept from before a reload, read when the step is drawn.
   */
  Opened: { readonly kept: O.Option<Waiting> }
  /** The Review step left the screen. */
  Left: {}
  /**
   * The waiting rows a tab of the person's that is gone (closed or crashed) kept for this import, taken up by this
   * tab: this tab's own where it holds nothing of the row, and on the row's line beside this tab's where it does.
   */
  TakenUp: { readonly kept: Waiting }
  /** The person changed these rows. */
  Decided: { readonly changes: RowChanges }
  /**
   * The server answered the save that was out: the draft is at `revision`, and `changed` says whether this save is
   * what moved it there. When it changed nothing (the server already held every row as sent), `revision` is not the
   * person's own next one: it is wherever the draft had got to, with whatever others decided on the way.
   */
  SaveAnswered: {
    readonly revision: number
    readonly changed: boolean
    /** Accepts in the save that the server did not apply. The rest of each row's decision is saved. */
    readonly notApplied: ReadonlyArray<StaleAccept>
  }
  /** The save did not get through (the network, a server error): the rows are not lost, and wait. */
  SaveFailed: {}
  /**
   * The save was not taken because nobody is signed in: not a refusal. The rows wait, kept in this browser, and are
   * sent after the person signs in again.
   */
  SaveSignedOut: {}
  /** The person pressed "Save again". */
  SaveAgain: {}
  /**
   * The server refused the rows (the import was confirmed or removed meanwhile, the role was taken away), with its
   * sentence for the person.
   */
  SaveRefused: { readonly reason: string }
  /** The person settled a row's line: which decision of it stands. A refused decision is never sent by it. */
  HoldSettled: { readonly rowId: string; readonly keep: Keep }
  /**
   * A picture of the import arrived: a read, a match's answer, a card's Continue. `open`: whether the import can
   * still be decided; a picture of one that cannot ends the draft.
   */
  ViewArrived: Picture & {
    readonly open: boolean
    /** How many times the import has been confirmed, taken back ones included: the view's history counts them. */
    readonly confirms: number
    /**
     * True for the view the tab already held, given again while it is asked anew (a return to the tab, the step drawn
     * again): it says nothing new of what the server holds, and checks no waiting row.
     */
    readonly waiting?: boolean
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
  ConfirmDone: Picture
  /** The server refused the confirm and wrote nothing: the draft is at another revision than the one it named. */
  ConfirmMoved: {}
  /**
   * The confirm did not get through, or was refused for another reason (the import is closed): what was written is
   * not known until the import is read again.
   */
  ConfirmFailed: {}
  /** The server refused the confirm and wrote nothing: it carried accepts made before their column was matched again. */
  ConfirmStale: { readonly accepts: ReadonlyArray<StaleAccept> }
  /** The result screen has shown the rows that were left over. */
  LeftOverNamed: {}
}>
export const DraftEvent = Data.taggedEnum<DraftEvent>()

/** What the person is told, in the machine's own terms: said only when the thing it is about was really out. */
export type Said = Data.TaggedEnum<{
  /** A save did not get through: the rows are on the screen, not saved yet, and wait to be sent again. */
  NotSaved: {}
  /** A save was not taken because nobody is signed in: the rows wait, and are sent after sign-in. */
  SignedOut: {}
  /**
   * The server refused a save: the rows it carried are held with `reason`, listed above the review until the person
   * decides them again or dismisses them; the review shows what is saved.
   */
  Refused: { readonly reason: string }
  /** Decisions were not applied (a column they rest on was matched again): each row shows what it now reads. */
  AcceptsTakenBack: { readonly accepts: ReadonlyArray<StaleAccept> }
  /**
   * The person's waiting rows outlived a confirm of the import (it was confirmed, and opened again, before they were
   * sent): they were not part of it and are not sent into it.
   */
  Outlived: Named
}>
export const Said = Data.taggedEnum<Said>()

/** What the transition asks of whoever runs it. */
export type DraftEffect = Data.TaggedEnum<{
  /**
   * Send these rows to the server, made on the revision `madeOn`, and say how it went with `SaveAnswered`,
   * `SaveFailed` or `SaveRefused`.
   */
  Send: { readonly delta: DecisionDelta; readonly madeOn: MadeOn }
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
   * been sent. Sent once; say how it went with `ConfirmDone`, `ConfirmMoved` or `ConfirmFailed`.
   */
  Confirm: { readonly revision: number; readonly madeOn: MadeOn; readonly delta: DecisionDelta }
}>
export const DraftEffect = Data.taggedEnum<DraftEffect>()

/** A transition's answer: the draft after it, and what to do. */
export interface Stepped {
  readonly draft: Draft
  readonly effects: ReadonlyArray<DraftEffect>
}

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

/** The person's changes that are not in a picture the screen has read yet, the latest over the earliest. */
export const mine = (draft: Draft): RowChanges => ({
  ...O.match(draft.landed, { onNone: (): RowChanges => ({}), onSome: (landed) => landed.rows }),
  ...O.getOrElse(draft.flight, (): RowChanges => ({})),
  ...draft.unsent
})

/** What the screen shows: the server's decisions as held, with the person's own changes over them. */
export const shown = (draft: Draft): SavedDecisions =>
  over(O.match(draft.held, { onNone: (): SavedDecisions => ({}), onSome: (held) => held.decisions }), mine(draft))

/** The rows the server has not confirmed: what a confirm must carry beside the decisions shown. */
export const unconfirmed = (draft: Draft): RowChanges => ({
  ...O.getOrElse(draft.flight, (): RowChanges => ({})),
  ...draft.unsent
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

const none: ReadonlyArray<DraftEffect> = []

/** A row's decision with nothing in it. */
const nothingDecided: RowDecision = decisionFromFlags({})

/** The kind of decision a taken-back one was: an accept when the server did not say. */
const kindOf = (taken: StaleAccept): TakenBackKind => taken.kind ?? "accept"

/**
 * One decision without the parts the server did not apply: an accept or an undone fix of the field named, a Replace or
 * Keep-stored (the row is undecided again), a keep-one-of-two (the row is open again; one left out stays left out).
 */
const withoutTaken = (decision: RowDecision, taken: ReadonlyArray<StaleAccept>): RowDecision => {
  if (!A.isReadonlyArrayNonEmpty(taken)) return decision
  const is = (kind: TakenBackKind, field?: string) =>
    A.some(taken, (one) => kindOf(one) === kind && (field === undefined || one.field === field))
  const { accepted, kept, reverted, stored, ...rest } = decisionToFlags(decision)
  const keepAccepted = A.filter(accepted ?? [], (field) => !is("accept", field))
  const keepReverted = A.filter(reverted ?? [], (field) => !is("undo", field))
  return decisionFromFlags({
    ...rest,
    ...(kept === true && !is("twin") ? { kept } : {}),
    ...(stored === undefined || is("stored") ? {} : { stored }),
    ...(A.isReadonlyArrayNonEmpty(keepAccepted) ? { accepted: keepAccepted } : {}),
    ...(A.isReadonlyArrayNonEmpty(keepReverted) ? { reverted: keepReverted } : {})
  })
}

/** The rows with the decisions the server did not apply taken out of each. */
const withoutAccepts = (rows: RowChanges, stale: ReadonlyArray<StaleAccept>): RowChanges =>
  A.isReadonlyArrayNonEmpty(stale)
    ? R.map(rows, (change, rowId) =>
        O.map(change, (decision) =>
          withoutTaken(
            decision,
            A.filter(stale, (taken) => taken.rowId === rowId)
          )
        )
      )
    : rows

/**
 * The rows not sent yet without the decisions the server did not apply. A row whose only decision was one of those is
 * a decision the person never made once it is taken out: nothing is sent for it, and its entry goes.
 */
const strippingUnsent = (input: Draft, stale: ReadonlyArray<StaleAccept>): Draft => {
  // This tab's decision, as a line asking between tabs remembers it, loses them too: "Keep this tab's" never sends one
  // again.
  const draft: Draft = {
    ...input,
    onHold: R.map(input.onHold, (held, rowId) =>
      asksBetweenTabs(held)
        ? { ...held, mine: O.flatten(R.get(withoutAccepts({ [rowId]: held.mine }, stale), rowId)) }
        : held
    )
  }
  const stripped = withoutAccepts(draft.unsent, stale)
  const emptied = R.filter(
    stripped,
    (change, rowId) =>
      O.exists(change, (decision) => Eq.equals(decision, nothingDecided)) &&
      // Emptied by the strip, not decided empty by the person ("Put row back" is an empty decision of their own).
      !Eq.equals(R.get(draft.unsent, rowId), O.some(change))
  )
  if (R.isEmptyReadonlyRecord(emptied)) return { ...draft, unsent: stripped }
  const stillDecided = (_value: unknown, rowId: string): boolean => !R.has(emptied, rowId)
  return {
    ...draft,
    unsent: R.filter(stripped, stillDecided),
    unsentOn: R.filter(draft.unsentOn, stillDecided),
    waits: R.filter(draft.waits, stillDecided),
    sentBefore: A.filter(draft.sentBefore, (rowId) => stillDecided(undefined, rowId))
  }
}

/** The rows' own revisions, for those rows only. */
const madeOnOf = (rows: RowChanges, made: MadeOn): MadeOn => R.filter(made, (_revision, rowId) => R.has(rows, rowId))

/** The revision of the picture held, or 0 before one is. */
const heldAt = (draft: Draft): number => O.match(draft.held, { onNone: () => 0, onSome: (held) => held.revision })

/** The decisions the server is known to hold: the picture held, with the rows it has confirmed since over it. */
const known = (draft: Draft): SavedDecisions =>
  over(
    O.match(draft.held, { onNone: (): SavedDecisions => ({}), onSome: (held) => held.decisions }),
    O.match(draft.landed, { onNone: (): RowChanges => ({}), onSome: (landed) => landed.rows })
  )

/**
 * The person's rows the server has not taken (the save that is out, and what waits behind it; or, once the import
 * was closed, the rows left over that the result has not named yet), for this browser to keep: none when there are
 * none.
 */
export const waiting = (draft: Draft): O.Option<Waiting> => {
  // A draft that ended because the import was closed keeps the rows left over until the result has named them: a
  // reload before that brings them back, and the closed import names them again.
  if (draft.ended) {
    return O.map(draft.leftOver, (rows) => ({
      rows,
      madeOn: {},
      confirms: draft.confirms,
      leftOver: true,
      beside: draft.leftOverBeside,
      seen: {},
      held: {}
    }))
  }
  // A row on hold is kept as that: its copy on its way is an earlier decision, and never comes back as waiting. A line
  // that asks between this tab's and a closed tab's is the exception: this tab's is kept as it waits, never neither.
  const rows = R.filter(unconfirmed(draft), (_change, rowId) => ownBesideHold(draft, rowId))
  if (R.isEmptyReadonlyRecord(rows) && R.isEmptyReadonlyRecord(draft.onHold)) return O.none()
  // A row waiting again over the one on its way is the person's latest decision of it, made on its own revision.
  return O.some({
    rows,
    madeOn: madeOnOf(rows, { ...draft.flightOn, ...draft.unsentOn }),
    confirms: draft.confirms,
    leftOver: false,
    beside: {},
    // The values seen of a row on hold too: what the server may have of it is asked again when the person picks.
    seen: R.filter(draft.seen, (_values, rowId) => R.has(rows, rowId) || R.has(draft.onHold, rowId)),
    held: draft.onHold
  })
}

/** True for a line that asks between this tab's decision, which is as it was, and closed tabs' of the same row. */
const asksBetweenTabs = (held: HeldRow): boolean => Hold.$is("OtherTab")(held.why)

/**
 * True when the row's line asks between this tab's own decision, as it was, and closed tabs'. This tab's own decision
 * then stays (waiting, kept in this browser, back from a failed save), and is never sent, confirmed or checked while
 * the line asks. A row of this tab's that was refused, or decided elsewhere since, is held itself instead, and never
 * sits beside a decision of the row on its way or unsent: deciding the row again settles it.
 */
const besideOwn = (draft: Draft, rowId: string): boolean => O.exists(R.get(draft.onHold, rowId), asksBetweenTabs)

/** True when this tab's own decision of the row is its own to keep: no line, or only one asking between tabs. */
const ownBesideHold = (draft: Draft, rowId: string): boolean => !R.has(draft.onHold, rowId) || besideOwn(draft, rowId)

/** True when the draft holds nothing of the person's that the server has not put in a picture the screen has read. */
export const settled = (draft: Draft): boolean =>
  O.isNone(draft.landed) && O.isNone(draft.flight) && R.isEmptyReadonlyRecord(draft.unsent)

/** Settled, and with no row of the person's on hold: nothing of theirs is in this draft but what the server has. */
const holdsNothing = (draft: Draft): boolean => settled(draft) && R.isEmptyReadonlyRecord(draft.onHold)

/** One decision of one row. */
type OfRow = readonly [rowId: string, decision: O.Option<RowDecision>]

/** Decisions as they are named: one of each row, what else there was of it beside, each once. */
const naming = (decisions: ReadonlyArray<OfRow>): Named => {
  const rows: Record<string, O.Option<RowDecision>> = {}
  const beside: Record<string, ReadonlyArray<O.Option<RowDecision>>> = {}
  for (const [rowId, decision] of decisions) {
    const first = R.get(rows, rowId)
    const others = O.getOrElse(R.get(beside, rowId), (): Named["beside"][string] => [])
    if (O.isNone(first)) rows[rowId] = decision
    else if (!A.some([first.value, ...others], (one) => Eq.equals(one, decision))) beside[rowId] = [...others, decision]
  }
  return { rows, beside }
}

/** The decisions named, one by one: each row's first before what else there was of it. */
const eachNamed = (named: Named): ReadonlyArray<OfRow> => [
  ...R.toEntries(named.rows),
  ...A.flatMap(R.toEntries(named.beside), ([rowId, others]) => A.map(others, (one): OfRow => [rowId, one]))
]

/**
 * The person's decisions the server has not taken, every one: each row that waits (or is on its way), each row on hold
 * (this tab's decision, unless the line only asks between it and others: it then waits, or is saved), and each closed
 * tab's on a line.
 */
const alive = (input: { readonly rows: RowChanges; readonly held: HeldRows }): ReadonlyArray<OfRow> => [
  // A row on hold is the person's latest decision of it: a copy on its way is an earlier one.
  ...A.filter(R.toEntries(input.rows), ([rowId]) =>
    O.match(R.get(input.held, rowId), { onNone: () => true, onSome: asksBetweenTabs })
  ),
  ...A.flatMap(R.toEntries(input.held), ([rowId, held]): ReadonlyArray<OfRow> => [
    ...(asksBetweenTabs(held) ? [] : [[rowId, held.mine] as const]),
    ...A.map(held.closed, (one): OfRow => [rowId, one.decision])
  ])
]

/**
 * Several namings as one: each decision of each row once.
 *
 * @example eachOnce([decisionsIn(own), decisionsIn(closedTabs)]).rows // { "row-12": some(left out) }
 */
export const eachOnce = (several: ReadonlyArray<Named>): Named => naming(A.flatMap(several, eachNamed))

/** The decisions the picture does not hold: what it holds was taken. */
const notIn = (decisions: ReadonlyArray<OfRow>, picture: SavedDecisions): ReadonlyArray<OfRow> =>
  A.filter(decisions, ([rowId, decision]) => !Eq.equals(R.get(picture, rowId), decision))

/**
 * Every decision of the person's in what a browser kept, to be named: waiting, on hold, a closed tab's on a line, or
 * left over by an import that was closed.
 *
 * @example decisionsIn(kept).rows // { "row-12": some(left out) }
 */
export const decisionsIn = (kept: Waiting): Named =>
  naming([...alive(kept), ...eachNamed({ rows: {}, beside: kept.beside })])

/** The rows left over so far, and what else of them, one by one. */
const leftSoFar = (draft: Draft): ReadonlyArray<OfRow> =>
  eachNamed({ rows: O.getOrElse(draft.leftOver, (): RowChanges => ({})), beside: draft.leftOverBeside })

/** A draft with these decisions left over, to be named by the result: none where there are none. */
const leaving = (decisions: ReadonlyArray<OfRow>): Pick<Draft, "leftOver" | "leftOverBeside"> => {
  const named = naming(decisions)
  return {
    leftOver: R.isEmptyReadonlyRecord(named.rows) ? O.none() : O.some(named.rows),
    leftOverBeside: named.beside
  }
}

/**
 * Sends what is unsent when nothing is out: each save carries the rows changed since the last one was sent, each
 * with its own revision. Nothing is sent while a picture is awaited after a confirm that was refused or lost.
 */
const sending = (draft: Draft): Stepped => {
  if (O.isSome(draft.flight) || R.isEmptyReadonlyRecord(draft.unsent)) return { draft, effects: none }
  // No picture held (the draft was let go, and the step has not read the import since): nothing goes, since nothing
  // says what the rows were decided over or whether the import can still be decided. The import is asked for.
  if (O.isNone(draft.held)) return { draft, effects: [DraftEffect.Ask()] }
  // The picture that says whether the import can still be decided is asked for (again): never a request loop, since
  // a picture that is not the step's own redraw answers it.
  if (draft.waitsForPicture) return { draft, effects: [DraftEffect.Ask()] }
  // A row whose line above the review asks which decision stands (a gone tab's beside this tab's) goes nowhere until
  // the person picks. A waiting row goes only once a fresh picture has checked it: the import is asked for, and the
  // rest go now.
  const asking = (rowId: string): boolean => besideOwn(draft, rowId)
  const ready = R.filter(draft.unsent, (_change, rowId) => !R.has(draft.waits, rowId) && !asking(rowId))
  const waitingRows = R.filter(draft.unsent, (_change, rowId) => R.has(draft.waits, rowId) && !asking(rowId))
  const ask: ReadonlyArray<DraftEffect> = R.isEmptyReadonlyRecord(waitingRows) ? none : [DraftEffect.Ask()]
  if (R.isEmptyReadonlyRecord(ready)) return { draft, effects: ask }
  const madeOn = madeOnOf(ready, draft.unsentOn)
  const left = R.filter(draft.unsent, (_change, rowId) => !R.has(ready, rowId))
  return {
    draft: {
      ...sentFrom(draft, ready),
      flight: O.some(ready),
      flightOn: madeOn,
      unsent: left,
      unsentOn: madeOnOf(left, draft.unsentOn),
      stalled: draft.stalled && !R.isEmptyReadonlyRecord(left)
    },
    effects: [DraftEffect.Send({ delta: deltaOf(ready), madeOn }), ...ask]
  }
}

/**
 * The rows about to go out are added to what the server may have of them from this tab (`seen`): a row the person
 * begins with starts from what the server was known to hold of it.
 */
const sentFrom = (draft: Draft, rows: RowChanges): Draft => {
  if (R.isEmptyReadonlyRecord(rows)) return draft
  const held = known(draft)
  return {
    ...draft,
    seen: {
      ...draft.seen,
      ...R.map(rows, (change, rowId) => [
        ...O.getOrElse(R.get(draft.seen, rowId), (): Seen[string] => [R.get(held, rowId)]),
        change
      ])
    }
  }
}

/** The rows wait from the picture held now, unless they already wait from an earlier one. */
const waitingFrom = (draft: Draft, rows: ReadonlyArray<string>): Draft =>
  A.isReadonlyArrayNonEmpty(rows)
    ? { ...draft, waits: { ...R.fromEntries(A.map(rows, (rowId) => [rowId, heldAt(draft)] as const)), ...draft.waits } }
    : draft

/**
 * The waiting rows a picture says were decided otherwise since: by someone else or another tab, not as the person
 * did, and to none of the values the server may have of them from this tab. A row whose values are not known (kept
 * by an older page) is not held.
 */
const decidedElsewhere = (draft: Draft, rows: RowChanges, decisions: SavedDecisions): RowChanges =>
  R.filter(rows, (mine, rowId) => {
    const theirs = R.get(decisions, rowId)
    return (
      !Eq.equals(theirs, mine) &&
      O.exists(R.get(draft.seen, rowId), (values) => !A.some(values, (value) => Eq.equals(value, theirs)))
    )
  })

/** The closed tabs' decisions on a row's line: none where it has no line. */
const closedOn = (draft: Draft, rowId: string): ReadonlyArray<ClosedTab> =>
  O.match(R.get(draft.onHold, rowId), { onNone: (): ReadonlyArray<ClosedTab> => [], onSome: (held) => held.closed })

/**
 * The rows put on hold as decided elsewhere since, with what the picture holds of each: out of what waits, each kept
 * with the revision its decision was made on, until the person picks.
 */
const holdingElsewhere = (draft: Draft, rows: RowChanges, decisions: SavedDecisions): Draft => {
  if (R.isEmptyReadonlyRecord(rows)) return draft
  const notHeld = (_value: unknown, rowId: string): boolean => !R.has(rows, rowId)
  const unsent = R.filter(draft.unsent, notHeld)
  return {
    ...draft,
    unsent,
    unsentOn: R.filter(draft.unsentOn, notHeld),
    waits: R.filter(draft.waits, notHeld),
    sentBefore: A.filter(draft.sentBefore, (rowId) => !R.has(rows, rowId)),
    stalled: draft.stalled && !R.isEmptyReadonlyRecord(unsent),
    onHold: {
      ...draft.onHold,
      ...R.map(rows, (mine, rowId) => ({
        mine,
        madeOn: O.getOrElse(R.get(draft.unsentOn, rowId), () => heldAt(draft)),
        why: Hold.Elsewhere({ theirs: R.get(decisions, rowId) }),
        closed: closedOn(draft, rowId)
      }))
    }
  }
}

/**
 * The rows on hold as the picture held now has them: a hold for a decision made elsewhere names what the server
 * holds now, and lets go once the server holds the person's own decision (nothing differs any more). A closed tab's
 * decision on that line is not let go with it: the line then asks between that one and this tab's, which is saved.
 */
const followingHolds = (draft: Draft): Draft =>
  O.match(draft.held, {
    onNone: () => draft,
    onSome: (held) => {
      // A refused row is not the server's to settle: it stays until the person decides it again or dismisses it. Nor
      // is a gone tab's decision held beside this tab's: the server holding either says nothing of which the person
      // wants, and letting it go would send this tab's (or drop it) unasked.
      const settledThere = (one: HeldRow, rowId: string): boolean =>
        Hold.$is("Elsewhere")(one.why) && Eq.equals(R.get(held.decisions, rowId), one.mine)
      const next = R.map(
        R.filter(draft.onHold, (one, rowId) => !settledThere(one, rowId) || A.isReadonlyArrayNonEmpty(one.closed)),
        (one, rowId): HeldRow =>
          settledThere(one, rowId)
            ? { ...one, why: Hold.OtherTab() }
            : Hold.$is("Elsewhere")(one.why)
              ? { ...one, why: Hold.Elsewhere({ theirs: R.get(held.decisions, rowId) }) }
              : one
      )
      return Eq.equals(next, draft.onHold) ? draft : { ...draft, onHold: next }
    }
  })

/**
 * The rows of the save or the confirm that was out go back under whatever was changed since, with their revisions. A
 * row put on hold while they were out stays on hold: the person settles it. A row of this tab's beside a gone tab's
 * held decision goes back as this tab's own. Every row that goes back, and every row behind it, waits: what the
 * server holds of it is not known until a fresh picture says.
 */
const backToUnsent = (draft: Draft, sent: RowChanges): Draft => {
  const rows = R.filter(sent, (_row, rowId) => ownBesideHold(draft, rowId))
  const back: Draft = {
    ...draft,
    sentBefore: A.dedupe([...draft.sentBefore, ...R.keys(rows)]),
    flight: O.none(),
    unsent: { ...rows, ...draft.unsent },
    unsentOn: { ...madeOnOf(rows, draft.flightOn), ...draft.unsentOn },
    flightOn: {}
  }
  return waitingFrom(back, R.keys(back.unsent))
}

/**
 * A draft nobody looks at keeps nothing once the server has everything. Its epoch goes on: the next visit's region
 * is another one, never taken for one drawn before.
 */
const letGo = (draft: Draft): Draft =>
  !draft.onScreen && holdsNothing(draft) && draft.confirm === "idle" && O.isSome(draft.held) && O.isNone(draft.leftOver)
    ? { ...emptyDraft, epoch: draft.epoch + 1 }
    : draft

/** The draft with its confirm at another stage. */
const confirmAt = (draft: Draft, confirm: Draft["confirm"]): Draft => ({ ...draft, confirm })

/** How many rows are decided otherwise in `after` than in `before`. */
const rowsApart = (before: SavedDecisions, after: SavedDecisions): number =>
  R.keys(changesBetween({ before, after })).length

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
 * Sends the confirm, when the screen holds a picture with nothing of the person's on its way over it: it names that
 * picture's revision and carries the rows not sent yet, which are what the screen shows over it. The rows ride in
 * `flight`, so no save goes out beside the confirm.
 */
const confirming = (draft: Draft): Stepped =>
  O.match(draft.held, {
    onNone: () => ({ draft: confirmAt(draft, "idle"), effects: none }),
    onSome: (held) => {
      // A row whose line above the review asks which decision stands (a gone tab's beside this tab's) is settled
      // first: a confirm would carry one of them unasked. Nothing is confirmed, whether pressed now or waiting on a
      // save: the screen says why until the lines are settled, and the person imports then.
      if (linesAsk(draft)) {
        return { draft: { ...confirmAt(draft, "idle"), heldForLines: true, seenWhileWaiting: O.none() }, effects: none }
      }
      // A waiting row is checked against the picture the confirm names: the server makes the confirm only while it is
      // still at that picture's revision, so what it holds then is what the picture holds. A row decided elsewhere
      // since is held, and nothing is confirmed: the person picks first.
      const elsewhere = decidedElsewhere(
        draft,
        R.filter(draft.unsent, (_change, rowId) => R.has(draft.waits, rowId)),
        held.decisions
      )
      if (!R.isEmptyReadonlyRecord(elsewhere)) {
        const holding = confirmAt(holdingElsewhere(draft, elsewhere, held.decisions), "idle")
        return {
          draft: { ...holding, heldForLines: true, epoch: holding.epoch + 1 },
          effects: [DraftEffect.Restart({ announce: false })]
        }
      }
      // Each row it carries names the revision it was decided on.
      const madeOn = madeOnOf(draft.unsent, draft.unsentOn)
      return {
        draft: confirmAt(
          {
            ...sentFrom(draft, draft.unsent),
            waits: {},
            flight: O.some(draft.unsent),
            flightOn: madeOn,
            unsent: {},
            unsentOn: {},
            stalled: false,
            seenWhileWaiting: O.none(),
            confirmOn: held.revision
          },
          "out"
        ),
        effects: [DraftEffect.Confirm({ revision: held.revision, madeOn, delta: deltaOf(draft.unsent) })]
      }
    }
  })

/**
 * True while a line above the review asks which decision of a row stands: a closed tab's beside this tab's, or a
 * waiting row decided elsewhere since. A confirm would carry one of them, or none, unasked.
 */
const linesAsk = (draft: Draft): boolean =>
  A.some(R.values(draft.onHold), (held) => Hold.$is("Elsewhere")(held.why) || A.isReadonlyArrayNonEmpty(held.closed))

/** A confirm held for the lines above the review is free again once no line asks. */
const linesSettled = (draft: Draft): Draft =>
  draft.heldForLines && !linesAsk(draft) ? { ...draft, heldForLines: false } : draft

/** The rows that rode with a confirm that was not made go back under whatever was changed since. */
const unconfirming = (draft: Draft): Draft =>
  confirmAt(
    backToUnsent(
      draft,
      O.getOrElse(draft.flight, (): RowChanges => ({}))
    ),
    "idle"
  )

/** After a change to what is held or the person's: the region starts again if what the screen shows is another. */
const restarting = (input: { readonly before: Draft; readonly after: Draft; readonly announce: boolean }): Stepped =>
  Eq.equals(shown(input.before), shown(input.after))
    ? { draft: input.after, effects: none }
    : {
        draft: { ...input.after, epoch: input.after.epoch + 1 },
        effects: [DraftEffect.Restart({ announce: input.announce })]
      }

/** Two answers in a row: what the first did, then what the second does to its draft. */
const then = (first: Stepped, next: (draft: Draft) => Stepped): Stepped => {
  const second = next(first.draft)
  return { draft: second.draft, effects: [...first.effects, ...second.effects] }
}

/**
 * What one event does to a draft, and what to do about it.
 *
 * @example step(emptyDraft, DraftEvent.ViewArrived({ revision: 4, decisions: {} })).draft.held // some: revision 4
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
  return told(draft, event, { draft: linesSettled(reached(stepped.draft)), effects })
})

/**
 * The rule every transition is held to, whatever it did: when what the screen shows is another thing after an event
 * that was not the person's own decision, the region is told to start again. Its own state (the decisions it drew,
 * their undo history) would otherwise go on saying what it said, while the totals and the confirm say the new
 * thing. A transition that says so itself (with its own `announce`) is left as it is.
 */
const told = (before: Draft, event: DraftEvent, stepped: Stepped): Stepped => {
  if (DraftEvent.$is("Decided")(event) || A.some(stepped.effects, DraftEffect.$is("Restart"))) return stepped
  if (O.isNone(before.held)) return stepped
  // The draft was let go while nobody looked: the next visit reads it anew, and the region must too. A return inside
  // the idle time would otherwise find the region as it was, over a view that may have changed meanwhile.
  if (O.isNone(stepped.draft.held)) {
    return stepped.draft.onScreen
      ? stepped
      : { draft: stepped.draft, effects: [...stepped.effects, DraftEffect.Restart({ announce: false })] }
  }
  return Eq.equals(shown(before), shown(stepped.draft))
    ? stepped
    : {
        draft: { ...stepped.draft, epoch: stepped.draft.epoch + 1 },
        // Accepts taken back are said in their own words, not as a change on another screen.
        effects: [...stepped.effects, DraftEffect.Restart({ announce: !A.some(stepped.effects, saysAccepts) })]
      }
}

const saysAccepts = (effect: DraftEffect): boolean =>
  DraftEffect.$is("Say")(effect) && Said.$is("AcceptsTakenBack")(effect.what)

/**
 * The import can no longer be decided (somebody confirmed it, or it was taken back): the draft ends, and nothing is
 * sent to it. The person's rows the server never took are kept aside to be named, unless the picture already
 * says them: those were part of what was written.
 */
const closing = (draft: Draft, picture: Picture): Stepped => {
  const left = [...leftSoFar(draft), ...alive({ rows: unconfirmed(draft), held: draft.onHold })]
  return {
    draft: {
      ...emptyDraft,
      onScreen: draft.onScreen,
      epoch: draft.epoch + 1,
      ...leaving(notIn(left, picture.decisions)),
      ended: true,
      endedOn: picture.decisions
    },
    effects: [DraftEffect.Restart({ announce: false })]
  }
}

/**
 * A picture of an import that can still be decided: the draft follows it. `takenBack`: the revisions at which a match
 * took decisions back; a change that lands with one of them is named as taken back, not as another screen's.
 */
const following = (draft: Draft, picture: Picture, takenBack: ReadonlyArray<TakenBackAt> = []): Stepped =>
  O.match(draft.held, {
    // The first picture seen is where the region starts.
    onNone: () => {
      const landed = O.filter(draft.landed, (rows) => rows.at > picture.revision)
      const after = { ...draft, held: O.some(picture), landed }
      return { draft: { ...after, typed: typedSkus(known(after)) }, effects: none }
    },
    onSome: (held) => {
      // An earlier answer that arrives late never replaces a later one.
      if (picture.revision < held.revision) return { draft, effects: none }
      // The same revision said differently: the server's word stands. The picture held was moved on by the
      // person's own save, and that save changed nothing the server did not already have from someone else.
      if (picture.revision === held.revision && Eq.equals(picture.decisions, held.decisions)) {
        return { draft, effects: none }
      }
      const after: Draft = {
        ...draft,
        held: O.some(picture),
        // The person's saved rows are in a picture of their revision or later.
        landed: O.filter(draft.landed, (rows) => rows.at > picture.revision)
      }
      const apart = rowsApart(shown(draft), shown(after))
      // The rows the matches of this jump took back: a change to one of them is theirs, said as taken back. Any other
      // row the jump changed is somebody else's, and said so.
      const inJump: ReadonlyArray<TakenBackAt> = A.filter(
        takenBack,
        (taken) => taken.revision > held.revision && taken.revision <= picture.revision
      )
      const explained = A.flatMap(inJump, (taken): ReadonlyArray<string> => taken.rows)
      const unexplained = A.some(
        R.keys(changesBetween({ before: shown(draft), after: shown(after) })),
        (rowId) => !A.contains(explained, rowId)
      )
      return restarting({
        before: draft,
        after:
          // A confirm held back already: this is the newer picture, read, with the rows it decides otherwise.
          O.isSome(draft.heldBack)
            ? reached(after)
            : draft.confirm === "waiting"
              ? apart === 0
                ? // Nothing shown changed: it may be the picture the person's own save leaves. Its answer tells.
                  { ...after, seenWhileWaiting: O.some(picture.revision) }
                : // A newer picture from elsewhere holds the confirm back: it is the newer picture, read.
                  holdingBack(after, { until: picture.revision })
              : after,
        announce: !draft.matching && unexplained
      })
    }
  })

/**
 * The save that was out did not get through: its rows go back under whatever was changed since, and wait. A confirm
 * that waited for it is not made: the person is told, and presses again.
 */
const failing = (draft: Draft, said: Said): Stepped =>
  draft.confirm === "out"
    ? { draft, effects: none }
    : O.match(draft.flight, {
        onNone: () => ({ draft, effects: none }),
        onSome: (rows) => ({
          draft: confirmAt({ ...backToUnsent(draft, rows), stalled: true }, "idle"),
          effects: [DraftEffect.Say({ what: said })]
        })
      })

/** True when the two decisions of a row say the same: one with nothing in it says what none at all says. */
const sameDecision = (one: O.Option<RowDecision>, other: O.Option<RowDecision>): boolean => {
  const something = (decision: RowDecision): boolean => !Eq.equals(decision, nothingDecided)
  return Eq.equals(O.filter(one, something), O.filter(other, something))
}

/** This tab's decision on a row's line, as one of the decisions the line asks between. */
const ownAsSide = (input: { readonly draft: Draft; readonly held: HeldRow; readonly rowId: string }): ClosedTab => ({
  decision: input.held.mine,
  madeOn: input.held.madeOn,
  seen: R.get(input.draft.seen, input.rowId),
  refused: Hold.$is("Refused")(input.held.why) ? O.some(input.held.why.reason) : O.none()
})

/**
 * A decision the person picked on a line that did not show what the server holds (a closed tab's, or this tab's where
 * it is neither on its way nor on the server): it waits, under its own revision, and goes once a fresh picture has
 * checked the row (G2). Decided elsewhere since means by none of the tabs the line named: what any of them may have
 * written is not somebody else's decision. Where nothing is known of what the tab saw (an older page), it is not held.
 */
const picked = (input: {
  readonly draft: Draft
  readonly rowId: string
  readonly one: ClosedTab
  readonly line: ReadonlyArray<ClosedTab>
}): Stepped => {
  const { draft, line, one, rowId } = input
  const written = A.flatMap(line, (side): Seen[string] => [
    ...O.getOrElse(side.seen, (): Seen[string] => []),
    ...(O.isSome(side.refused) ? [] : [side.decision])
  ])
  const seen: Seen = O.match(one.seen, {
    onNone: () => R.remove(draft.seen, rowId),
    onSome: (values) => ({ ...draft.seen, [rowId]: [...values, ...written] })
  })
  return sending(
    waitingFrom(
      {
        ...draft,
        unsent: { ...draft.unsent, [rowId]: one.decision },
        unsentOn: { ...draft.unsentOn, [rowId]: one.madeOn },
        waits: R.remove(draft.waits, rowId),
        seen,
        // Sent by the tab that is gone, or not: not known.
        sentBefore: A.dedupe([...draft.sentBefore, rowId]),
        stalled: true
      },
      [rowId]
    )
  )
}

/**
 * A row's line settled by the person's pick; the other decisions on it, which the line names, are let go. Theirs: the
 * screen already shows what the server holds. This tab's refused decision stays as the ordinary refused line, and a
 * closed tab's refused one becomes that: a value the server refused is never sent by a pick. Any other pick is sent as
 * the person's decision, under the revision it was made on (never re-dated: a column matched again since still takes
 * back what it rested on, and the answer names it): at once where the line showed what the server holds, and otherwise
 * once a fresh picture has checked the row (`picked`). A pick the line does not offer changes nothing.
 */
const settling = (input: {
  readonly draft: Draft
  readonly held: HeldRow
  readonly keep: Keep
  readonly rowId: string
}): Stepped => {
  const { draft, held, keep, rowId } = input
  const unchanged: Stepped = { draft, effects: none }
  const without: Draft = { ...draft, onHold: R.remove(draft.onHold, rowId) }
  const alone = !A.isReadonlyArrayNonEmpty(held.closed)
  const own = ownAsSide(input)
  const line = (next: HeldRow): Stepped => ({
    draft: { ...draft, onHold: { ...draft.onHold, [rowId]: next } },
    effects: none
  })
  const sendNow = (one: ClosedTab): Stepped =>
    transition(
      { ...without, unsentOn: { ...without.unsentOn, [rowId]: one.madeOn } },
      DraftEvent.Decided({ changes: { [rowId]: one.decision } })
    )
  const sendChecked = (one: ClosedTab): Stepped => picked({ draft: without, rowId, one, line: [own, ...held.closed] })
  const closedPicked = (one: ClosedTab): Stepped =>
    O.match(one.refused, {
      onNone: () => (Hold.$is("Elsewhere")(held.why) ? sendNow(one) : sendChecked(one)),
      onSome: (reason) =>
        Hold.$is("Refused")(held.why)
          ? line({ mine: one.decision, madeOn: one.madeOn, why: Hold.Refused({ reason }), closed: [] })
          : unchanged
    })
  return Keep.$match(keep, {
    Theirs: () =>
      Hold.$match(held.why, {
        Refused: () => (alone ? sending(without) : unchanged),
        Elsewhere: () => sending(without),
        OtherTab: () => unchanged
      }),
    Mine: () =>
      Hold.$match(held.why, {
        Refused: () => (alone ? unchanged : line({ ...held, closed: [] })),
        Elsewhere: () => sendNow(own),
        // This tab's decision goes as it waits; where it is neither on its way any more nor on the server, it is
        // decided again, so it is on the server or waiting, never neither.
        OtherTab: () =>
          R.has(mine(without), rowId) || sameDecision(R.get(known(without), rowId), held.mine)
            ? sending(without)
            : sendChecked(own)
      }),
    Closed: ({ decision }) =>
      O.match(
        A.findFirst(held.closed, (one) => Eq.equals(one.decision, decision)),
        { onNone: () => unchanged, onSome: closedPicked }
      )
  })
}

/**
 * The decisions of one row that a gone tab's entry holds, each as a closed tab's: its own (waiting, refused with the
 * sentence, held as decided elsewhere, or saved and not what this screen knows the server to hold), then those it held
 * of tabs gone before it.
 */
const sidesIn = (input: {
  readonly draft: Draft
  readonly kept: Waiting
  readonly rowId: string
}): ReadonlyArray<ClosedTab> => {
  const { draft, kept, rowId } = input
  const seen = R.get(kept.seen, rowId)
  const waits = O.map(R.get(kept.rows, rowId), (decision): ClosedTab => ({
    decision,
    madeOn: O.getOrElse(R.get(kept.madeOn, rowId), () => heldAt(draft)),
    seen,
    refused: O.none()
  }))
  return O.match(R.get(kept.held, rowId), {
    onNone: () => A.fromOption(waits),
    onSome: (held) => {
      const own = (refused: O.Option<string>): ReadonlyArray<ClosedTab> => [
        { decision: held.mine, madeOn: held.madeOn, seen, refused }
      ]
      const theirs = Hold.$match(held.why, {
        Refused: ({ reason }) => own(O.some(reason)),
        Elsewhere: () => own(O.none()),
        OtherTab: () =>
          O.match(waits, {
            onSome: A.of,
            // Saved by that tab, and held by the server as this screen knows it: it is on the server.
            onNone: () => (sameDecision(R.get(known(draft), rowId), held.mine) ? [] : own(O.none()))
          })
      })
      return [...theirs, ...held.closed]
    }
  })
}

/**
 * The closed tabs' decisions on a line with more of them: each decision once, and never the one this tab holds of the
 * row itself (decided the same in two tabs, nothing is lost). One refused in any of the tabs that made it is refused:
 * a pick never sends it.
 */
const closedWith = (input: {
  readonly own: O.Option<RowDecision>
  readonly closed: ReadonlyArray<ClosedTab>
  readonly more: ReadonlyArray<ClosedTab>
}): ReadonlyArray<ClosedTab> =>
  A.reduce(input.more, input.closed, (line, one) => {
    const same = (side: ClosedTab): boolean => Eq.equals(side.decision, one.decision)
    if (Eq.equals(one.decision, input.own)) return line
    if (!A.some(line, same)) return [...line, one]
    return A.map(line, (side) =>
      same(side)
        ? {
            ...side,
            madeOn: Math.min(side.madeOn, one.madeOn),
            seen: O.zipWith(side.seen, one.seen, (here, there) => [...here, ...there]),
            refused: O.orElse(side.refused, () => one.refused)
          }
        : side
    )
  })

/**
 * One row of a gone tab's entry, taken up. What this tab holds of it decides where each decision goes, and none of
 * them is lost, however many tabs decided the row:
 *
 * | This tab holds of the row                      | The entry's own decision                 | What it held of tabs gone before |
 * | ---------------------------------------------- | ---------------------------------------- | -------------------------------- |
 * | nothing                                        | this tab's now, as it was there: waiting, refused, held | stays on the row's line |
 * | its own: waiting, on its way, or saved unread  | on a line beside it, unless the same     | on that line                     |
 * | a line: its own refused                        | on that line, unless the same            | on that line                     |
 * | a line: its own decided elsewhere since        | on that line, unless the same            | on that line                     |
 * | a line: asking between tabs                    | on that line, unless already there       | on that line                     |
 */
const takingUp = (input: { readonly draft: Draft; readonly kept: Waiting; readonly rowId: string }): Draft => {
  const { draft, rowId } = input
  const own = R.get(mine(draft), rowId)
  const line = R.get(draft.onHold, rowId)
  if (O.isNone(own) && O.isNone(line)) return adopting(input)
  const held: HeldRow = O.getOrElse(line, () => ({
    mine: O.flatten(own),
    madeOn: O.getOrElse(
      O.orElse(R.get(draft.unsentOn, rowId), () => R.get(draft.flightOn, rowId)),
      () => heldAt(draft)
    ),
    why: Hold.OtherTab(),
    closed: []
  }))
  const closed = closedWith({ own: held.mine, closed: held.closed, more: sidesIn(input) })
  return A.isReadonlyArrayNonEmpty(closed)
    ? { ...draft, onHold: { ...draft.onHold, [rowId]: { ...held, closed } } }
    : draft
}

/** A row this tab holds nothing of: what the gone tab held of it becomes this tab's, its line with it. */
const adopting = (input: { readonly draft: Draft; readonly kept: Waiting; readonly rowId: string }): Draft => {
  const { draft, kept, rowId } = input
  const adopted: Draft = {
    ...draft,
    onHold: { ...draft.onHold, ...R.filter(kept.held, (_held, heldRow) => heldRow === rowId) },
    // A row taken up is checked by what the gone tab may have sent of it, never by what this tab once saw of the row:
    // that would let a decision made since look like one of the gone tab's own.
    seen: {
      ...R.remove(draft.seen, rowId),
      ...R.filter(kept.seen, (_values, seenRow) => seenRow === rowId)
    }
  }
  return O.match(R.get(kept.rows, rowId), {
    onNone: () => adopted,
    onSome: (decision) =>
      waitingFrom(
        {
          ...adopted,
          unsent: { ...draft.unsent, [rowId]: decision },
          unsentOn: {
            ...draft.unsentOn,
            [rowId]: O.getOrElse(R.get(kept.madeOn, rowId), () => heldAt(draft))
          },
          // Sent by the tab that is gone, or not: not known.
          sentBefore: A.dedupe([...draft.sentBefore, rowId]),
          stalled: true
        },
        [rowId]
      )
  })
}

const transition = (draft: Draft, event: DraftEvent): Stepped =>
  DraftEvent.$match(event, {
    // What this browser kept from before a reload comes back as the person's waiting rows, not saved yet. Nothing
    // is sent here: the picture the step finds arrives next, and says whether the import can still be decided.
    Opened: ({ kept }) => {
      const opened: Draft = { ...draft, onScreen: true, redrawn: true }
      if (!holdsNothing(opened) || O.isNone(kept)) return { draft: opened, effects: none }
      return {
        // Rows a closed import left over come back as that, to be named: they are not the person's waiting rows.
        draft: kept.value.leftOver
          ? { ...opened, leftOver: O.some(kept.value.rows), leftOverBeside: kept.value.beside, ended: true }
          : {
              ...opened,
              unsent: kept.value.rows,
              unsentOn: kept.value.madeOn,
              seen: kept.value.seen,
              onHold: kept.value.held,
              // Sent before the reload, or not: not known. Each waits for a fresh picture to check it.
              sentBefore: R.keys(kept.value.rows),
              waits: R.map(kept.value.rows, () => 0),
              confirms: kept.value.confirms,
              stalled: !R.isEmptyReadonlyRecord(kept.value.rows)
            },
        effects: none
      }
    },
    Left: () => ({ draft: letGo({ ...draft, onScreen: false, matching: false }), effects: none }),
    // Rows a gone tab kept: never dropped without a word (Benjamin, 2026-11-20, answers 4 and 5, G2, G4; 2026-11-21).
    // Into a draft that ended, the rows its closed picture does not hold are left over, named by the result; rows a
    // closed import left over are named, never sent; rows of an import confirmed since are named and let go. The rest
    // is taken up row by row (`takingUp`), and goes once a fresh picture has checked it.
    TakenUp: ({ kept }) => {
      const theirs = decisionsIn(kept)
      if (draft.ended) {
        return {
          draft: { ...draft, ...leaving([...leftSoFar(draft), ...notIn(eachNamed(theirs), draft.endedOn)]) },
          effects: none
        }
      }
      const outlived =
        kept.leftOver || O.exists(kept.confirms, (before) => O.exists(draft.confirms, (now) => now > before))
      if (outlived) {
        return R.isEmptyReadonlyRecord(theirs.rows)
          ? { draft, effects: none }
          : { draft, effects: [DraftEffect.Say({ what: Said.Outlived(theirs) })] }
      }
      const rows = A.dedupe([...R.keys(kept.rows), ...R.keys(kept.held)])
      const next = followingHolds(A.reduce(rows, draft, (before, rowId) => takingUp({ draft: before, kept, rowId })))
      // With a picture held, the import is asked for: the fresh picture checks them. Otherwise the first one does.
      return O.isSome(draft.held) ? sending(next) : { draft: next, effects: none }
    },
    LeftOverNamed: () => ({
      draft: draft.ended ? { ...draft, leftOver: O.none(), leftOverBeside: {} } : draft,
      effects: none
    }),
    // The draft ends on the picture the confirm answered with: rows the person decided while it was out were not part
    // of it, and the result names them; the rows it carried are in that picture, and are not.
    ConfirmDone: ({ decisions, revision }) =>
      draft.confirm !== "out" ? { draft, effects: none } : closing(confirmAt(draft, "idle"), { revision, decisions }),
    ConfirmPressed: () => {
      // While the newer picture is being read after a confirm that was not made, the button waits for it.
      if (draft.confirm !== "idle" || O.isNone(draft.held) || O.exists(draft.heldBack, (why) => !why.read)) {
        return { draft, effects: none }
      }
      const pressed: Draft = { ...draft, heldBack: O.none(), heldForLines: false, pressedOn: shown(draft) }
      // Their own save is out: the confirm waits for its answer, and goes on the picture that save leaves.
      if (O.isSome(pressed.flight)) return { draft: confirmAt(pressed, "waiting"), effects: none }
      // The picture held is known to be behind (somebody else saved before the person's last save): the newer one
      // is asked for, and the confirm waits for the person to have seen it.
      if (O.isSome(pressed.landed)) {
        return {
          draft: holdingBack(pressed, { until: pressed.landed.value.at }),
          effects: [DraftEffect.Ask()]
        }
      }
      return confirming(pressed)
    },
    // Nothing was written. The newer picture is asked for, and the person's rows are saved as any decision is.
    ConfirmMoved: () =>
      draft.confirm !== "out"
        ? { draft, effects: none }
        : O.isSome(draft.closedSeen)
          ? closing(unconfirming(draft), draft.closedSeen.value)
          : // The server is past the revision the confirm named: the newer picture is one after it, at least.
            then(sending(holdingBack(unconfirming(draft), { until: draft.confirmOn + 1 })), (after) => ({
              draft: after,
              effects: [DraftEffect.Ask()]
            })),
    // Refused for another reason than a moved draft (the import is closed), or the answer was lost on its way back:
    // what was written is not known. Nothing is sent: the rows wait, and the import is asked for. A closed picture
    // ends the draft and names what it does not hold; an open one has the rows sent.
    ConfirmFailed: () =>
      draft.confirm !== "out"
        ? { draft, effects: none }
        : O.isSome(draft.closedSeen)
          ? closing(unconfirming(draft), draft.closedSeen.value)
          : // The rows wait on the screen, and nothing is offered as a save: the import may be closed (refused as
            // imported already, or made with its answer lost). The picture asked for says: a closed one names the
            // rows, an open one (a confirm that wrote nothing answers the same revision) has them sent.
            { draft: { ...unconfirming(draft), waitsForPicture: true, stalled: false }, effects: [DraftEffect.Ask()] },
    // Nothing was written. The accepts are taken out of the rows the confirm carried, which are then saved as any
    // decision is; the person is told which, and confirms again.
    // The confirm is held back as a moved draft's is: the line above the review says nothing was imported and names
    // the accepts, once the newer picture (the match the person had not seen) is read.
    ConfirmStale: ({ accepts }) => {
      if (draft.confirm !== "out") return { draft, effects: none }
      if (O.isSome(draft.closedSeen)) return closing(unconfirming(draft), draft.closedSeen.value)
      const back = unconfirming(draft)
      return then(
        sending(
          // The server checked the revision first: it is the one the confirm named, so nothing newer is to be read.
          holdingBack(strippingUnsent(back, accepts), { until: draft.confirmOn, accepts })
        ),
        (after) => ({
          draft: after,
          effects: [DraftEffect.Say({ what: Said.AcceptsTakenBack({ accepts }) }), DraftEffect.Ask()]
        })
      )
    },
    MatchStarted: () => ({ draft: { ...draft, matching: true }, effects: none }),
    MatchEnded: () => ({ draft: { ...draft, matching: false }, effects: none }),
    // The person's rows, the latest over the earliest; sent at once unless a save is out. Each row decided is made on the picture held now. A row decided back to what the server is known to hold, and
    // not on its way, was never sent: its entry goes, and nothing is sent for it (a clear would take back a decision
    // somebody else may have made on that row since).
    Decided: ({ changes }) => {
      const flying = O.getOrElse(draft.flight, (): RowChanges => ({}))
      const held = known(draft)
      const undone = (change: O.Option<RowDecision>, rowId: string): boolean =>
        !R.has(flying, rowId) && !A.contains(draft.sentBefore, rowId) && Eq.equals(change, R.get(held, rowId))
      const unsent = R.filter(
        { ...draft.unsent, ...changes },
        (change, rowId) => !(R.has(changes, rowId) && undone(change, rowId))
      )
      const at = heldAt(draft)
      // A row decided again over the person's own decision that is waiting or on its way rests on that decision: it
      // keeps the revision that one was made on, so a column matched again since still takes back what it rested on
      // (never moved forward). A row the person begins deciding is made on the picture held now.
      const madeOn = R.map(changes, (_change, rowId) =>
        Math.min(
          at,
          O.getOrElse(
            O.orElse(R.get(draft.unsentOn, rowId), () =>
              R.has(flying, rowId) ? R.get(draft.flightOn, rowId) : O.none()
            ),
            () => at
          )
        )
      )
      const begun = (rowId: string): boolean => !R.has(flying, rowId) && !R.has(draft.unsent, rowId)
      return sending({
        ...draft,
        leftOver: O.none(),
        leftOverBeside: {},
        unsent,
        unsentOn: madeOnOf(unsent, { ...draft.unsentOn, ...madeOn }),
        // A waiting row decided again still waits (the person decided over their own decision, not over the server's);
        // one decided back to nothing to send goes.
        waits: R.filter(draft.waits, (_at, rowId) => R.has(unsent, rowId)),
        // A row on hold decided again is the person's new decision: the hold is settled by it.
        onHold: R.filter(draft.onHold, (_held, rowId) => !R.has(changes, rowId)),
        // A row the person begins deciding starts from what the server is known to hold of it. What the person decides
        // is added only once it is sent: a value that never left the browser is not one the server may hold.
        seen: {
          ...draft.seen,
          ...R.map(
            R.filter(changes, (_change, rowId) => begun(rowId)),
            (_change, rowId): Seen[string] => [R.get(held, rowId)]
          )
        }
      })
    },
    // The person picked which decision of a row's line stands (`settling`).
    HoldSettled: ({ keep, rowId }) =>
      O.match(R.get(draft.onHold, rowId), {
        onNone: () => ({ draft, effects: none }),
        onSome: (held) => {
          const by = settling({ draft, held, keep, rowId })
          // The region is drawn again, without a word, since the person did it.
          return Eq.equals(shown(draft), shown(by.draft))
            ? by
            : {
                draft: { ...by.draft, epoch: by.draft.epoch + 1 },
                effects: [...by.effects, DraftEffect.Restart({ announce: false })]
              }
        }
      }),
    // The person's own press: the rows that wait are checked first, so the import is asked for, and they go once a
    // fresh picture has checked them (G2). While a picture is awaited after a confirm that was refused or lost, the
    // import is asked for too: a save could go to an import that is closed.
    SaveAgain: () => (draft.waitsForPicture ? { draft, effects: [DraftEffect.Ask()] } : sending(draft)),
    // Not lost: the rows go back under whatever was changed since, and wait. A confirm that waited for this save is
    // not made: the person is told the save failed, and presses again.
    SaveFailed: () => failing(draft, Said.NotSaved()),
    // Nobody signed in: the rows wait as after a failure, and are sent once a save is taken again.
    SaveSignedOut: () => failing(draft, Said.SignedOut()),
    // The screen goes back to the decisions the server holds, and the import is asked again. The rows the refused
    // save carried are held with the server's sentence, never sent by themselves: they stay until the person decides
    // them again or dismisses them, and a closed import's result names them. The rows behind them, never sent, still
    // wait: they go once a picture says the import can still be decided.
    SaveRefused: ({ reason }) =>
      draft.confirm === "out"
        ? { draft, effects: none }
        : O.match(draft.flight, {
            onNone: () => ({ draft, effects: none }),
            onSome: (rows) => {
              // A closed tab's decision on the row's line stays there beside this tab's, refused now with its reason,
              // and the person picks ("Keep both, she picks", Benjamin, 2026-11-21): neither is let go unsaid.
              const refusedHere = R.filter(
                rows,
                (_row, rowId) => !R.has(draft.unsent, rowId) && ownBesideHold(draft, rowId)
              )
              return then(
                restarting({
                  before: draft,
                  after: confirmAt(
                    {
                      // The rows behind it wait for the picture asked for, and are checked by it.
                      ...waitingFrom(draft, R.keys(draft.unsent)),
                      flight: O.none(),
                      flightOn: {},
                      onHold: {
                        ...draft.onHold,
                        ...R.map(refusedHere, (mine, rowId) => ({
                          mine,
                          madeOn: O.getOrElse(R.get(draft.flightOn, rowId), () => heldAt(draft)),
                          why: Hold.Refused({ reason }),
                          closed: closedOn(draft, rowId)
                        }))
                      },
                      // Refused: the server holds none of them.
                      sentBefore: A.filter(draft.sentBefore, (rowId) => !R.has(rows, rowId)),
                      // Sent when the picture asked for arrives, as rows after a failed save are.
                      stalled: !R.isEmptyReadonlyRecord(draft.unsent)
                    },
                    "idle"
                  ),
                  announce: false
                }),
                (after) => ({
                  draft: after,
                  effects: [DraftEffect.Say({ what: Said.Refused({ reason }) }), DraftEffect.Ask()]
                })
              )
            }
          }),
    SaveAnswered: ({ changed, notApplied, revision }) =>
      O.match(draft.confirm === "out" ? O.none() : draft.flight, {
        onNone: () => ({ draft, effects: none }),
        onSome: (sent) => {
          // What the server saved: the rows as sent, without the accepts it did not apply. A row decided again since,
          // waiting behind, loses them too: the person has just been told they were taken back.
          const rows = withoutAccepts(sent, notApplied)
          const stripped = strippingUnsent(draft, notApplied)
          const base: Draft = {
            ...stripped,
            flight: O.none(),
            flightOn: {},
            // The rows of this save are known to be written now.
            sentBefore: A.filter(stripped.sentBefore, (rowId) => !R.has(sent, rowId))
          }
          const landed = O.match(base.held, {
            // No picture to move on: the rows wait over whatever is read next.
            onNone: (): Stepped => ({
              draft: { ...base, landed: O.some({ rows, at: revision }) },
              effects: [DraftEffect.Ask()]
            }),
            onSome: (held): Stepped => {
              // A picture read after the save is already held: the rows are in it.
              if (revision <= held.revision) return { draft: base, effects: none }
              // This save moved the draft, to the next revision after the one held: nobody else saved in between, so
              // the picture moves on by the person's own rows, with no request. A save that changed nothing moved
              // nothing: its revision is somebody else's, and says nothing of what the picture held lacks.
              if (changed && revision === held.revision + 1 && O.isNone(base.landed)) {
                const picture = { revision, decisions: over(held.decisions, rows) }
                return { draft: { ...base, held: O.some(picture) }, effects: [DraftEffect.Put(picture)] }
              }
              // Somebody else saved in between, or the save changed nothing and the draft is further on than the
              // picture held: that picture is behind. The person's rows stay on screen over it, and the import is
              // asked again, at once, for everything the server holds.
              return {
                draft: {
                  ...base,
                  landed: O.some({
                    rows: {
                      ...O.match(base.landed, { onNone: (): RowChanges => ({}), onSome: (l) => l.rows }),
                      ...rows
                    },
                    at: revision
                  })
                },
                effects: [DraftEffect.Ask()]
              }
            }
          })
          const told = A.isReadonlyArrayNonEmpty(notApplied)
            ? [...landed.effects, DraftEffect.Say({ what: Said.AcceptsTakenBack({ accepts: notApplied }) })]
            : landed.effects
          // A SKU the person typed may belong to an item that is already there: ask the server which are, once it
          // has the SKU. What is still on its way or unsent is not asked about yet: the answer would not have it.
          const typed = typedSkus(known(landed.draft))
          const asked =
            typed === draft.typed || A.some(told, DraftEffect.$is("Ask"))
              ? { draft: { ...landed.draft, typed }, effects: told }
              : { draft: { ...landed.draft, typed }, effects: [...told, DraftEffect.Ask()] }
          if (asked.draft.confirm === "waiting") {
            // The confirm that waited for this save goes now, on the picture the save left, when that picture is the
            // person's own doing: moved on by this save alone, or not moved at all, and no picture later than the
            // save's own came while it waited. Otherwise the import changed in between: the confirm is held back.
            const later = O.exists(asked.draft.seenWhileWaiting, (seen) => seen > revision)
            if (O.isNone(asked.draft.landed) && !A.isReadonlyArrayNonEmpty(notApplied) && !later) {
              return then(asked, confirming)
            }
            // Read already when the later picture is the one held; otherwise the newer picture is asked for.
            // Read once the screen holds the picture this save left (or the later one it saw); the accepts the server
            // did not apply are named on the line.
            const heldBack = holdingBack(asked.draft, { until: revision, accepts: notApplied })
            const effects = A.some(asked.effects, DraftEffect.$is("Ask"))
              ? asked.effects
              : heldBack.heldBack.pipe(O.exists((why) => why.read))
                ? asked.effects
                : [...asked.effects, DraftEffect.Ask()]
            return then({ draft: heldBack, effects }, sending)
          }
          return then(then(asked, sending), (after) => ({ draft: letGo(after), effects: none }))
        }
      }),
    ViewArrived: ({ confirms, decisions, open, revision, takenBack, waiting: givenAgain }) => {
      const picture: Picture = { revision, decisions }
      // The confirm that is out is this screen's own: its answer says whether it is the one that closed the import.
      if (!open) {
        return draft.confirm === "out"
          ? { draft: { ...draft, closedSeen: O.some(picture), confirms: O.some(confirms) }, effects: none }
          : closing(draft, picture)
      }
      // Open again after it had ended (reopened to review again): the rows left over were named on the result.
      const reopened: Draft = draft.ended
        ? { ...draft, ended: false, endedOn: {}, leftOver: O.none(), leftOverBeside: {} }
        : draft
      // The import was confirmed since the person's waiting rows were decided, and opened again: they were not part
      // of that confirm, and are not sent into the reopened import. They are named, and let go.
      // Rows on hold were not part of it either.
      const confirmedSince = O.exists(reopened.confirms, (before) => confirms > before)
      const outlived = naming(
        confirmedSince ? notIn(alive({ rows: reopened.unsent, held: reopened.onHold }), decisions) : []
      )
      // Only a picture newer than the one held (or the first) is the answer a refused or lost confirm waits for: the
      // view the tab already held, given again when the step is drawn again, says nothing of what that confirm wrote.
      const newer = O.isNone(reopened.held) || revision > heldAt(reopened)
      // Any other picture of the revision held or later answers it too: the read asked for after that confirm says the
      // import is open at the revision the confirm left it, so nothing was written.
      // The view given again while it is asked anew answers nothing.
      const answers = givenAgain !== true && (newer || (!reopened.redrawn && revision >= heldAt(reopened)))
      const followed: Draft = {
        ...reopened,
        ...(R.isEmptyReadonlyRecord(outlived.rows) ? {} : { unsent: {}, unsentOn: {}, waits: {}, stalled: false }),
        ...(confirmedSince ? { onHold: {} } : {}),
        confirms: O.some(confirms),
        waitsForPicture: reopened.waitsForPicture && !answers,
        redrawn: false,
        // A closed picture seen while the confirm was out, and since outdated by this open one (the import was opened
        // again): the confirm's answer no longer ends the draft on it.
        closedSeen: O.filter(reopened.closedSeen, (seen) => seen.revision > revision)
      }
      // A waiting row (after a failed or refused save, a confirm not made, a reload, or taken up from a tab that is
      // gone) is checked only by a fresh picture: an answer at least as new as the one held, and at least as new as
      // the picture held when it began to wait; never the view given again. One this picture says was decided
      // otherwise since by someone else or another tab, and not as the person did, is held: nothing is sent for it,
      // the screen shows theirs and the person's beside it, and the person picks (Benjamin, 2026-11-20, G2). The rest
      // are checked, and go.
      // The picture the step finds when it is drawn (again) is the view the tab already held, given again, however
      // it is marked: it may be older than a decision made since, and it checks nothing; the import is asked for.
      const fresh = givenAgain !== true && !reopened.redrawn && revision >= heldAt(reopened)
      // A row whose line asks which of two decisions stands is checked once the person has picked.
      const checked: RowChanges = fresh
        ? R.filter(
            followed.unsent,
            (_change, rowId) =>
              !besideOwn(followed, rowId) && O.exists(R.get(followed.waits, rowId), (at) => revision >= at)
          )
        : {}
      const now: Draft = holdingElsewhere(
        { ...followed, waits: R.filter(followed.waits, (_at, rowId) => !R.has(checked, rowId)) },
        decidedElsewhere(followed, checked, decisions),
        decisions
      )
      const named: ReadonlyArray<DraftEffect> = R.isEmptyReadonlyRecord(outlived.rows)
        ? none
        : [DraftEffect.Say({ what: Said.Outlived(outlived) })]
      // A picture arrived, so the server can be reached and the import can be decided: rows that are checked go, and
      // a row still waiting asks for a fresh picture. A hold for a decision made elsewhere follows the picture held.
      // The view given again while it is asked anew asks nothing: the read that is out brings the fresh picture.
      const arrived = then(
        then({ draft: now, effects: named }, (held) => following(held, picture, takenBack ?? [])),
        (after) => sending(followingHolds(after))
      )
      return givenAgain === true
        ? { draft: arrived.draft, effects: A.filter(arrived.effects, (effect) => !DraftEffect.$is("Ask")(effect)) }
        : arrived
    }
  })
