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
import type { DecisionDelta, SavedDecisions } from "@inventory/catalog-contract/Decision"

/** One row's decision, as the server keeps it. */
export type RowDecision = SavedDecisions[string]

/** What the person changed, row by row: a decision to save, or none where the row's decision was taken back. */
export type RowChanges = Readonly<Record<string, O.Option<RowDecision>>>

/** The server's decisions as one read or one answered save said them, with the draft's revision they belong to. */
export interface Picture {
  readonly revision: number
  readonly decisions: SavedDecisions
}

/** An accept the server did not apply: its field's column was matched again after the decision was made. */
export interface StaleAccept {
  readonly rowId: string
  readonly field: string
}

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
   * The person's rows that were never saved because the import was closed meanwhile (somebody else confirmed it),
   * or because the server refused them: kept until the result screen has named them, never sent.
   */
  readonly leftOver: O.Option<RowChanges>
  /**
   * A picture said the import was closed while this screen's own confirm was out: if that confirm turns out not to
   * be the one that closed it, the draft ends on this picture.
   */
  readonly closedSeen: O.Option<Picture>
  /** The draft ended because the import can no longer be decided: what is in `leftOver` waits to be named. */
  readonly ended: boolean
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
  epoch: 0,
  matching: false,
  typed: "",
  onScreen: false,
  confirm: "idle",
  heldBack: O.none(),
  leftOver: O.none(),
  closedSeen: O.none(),
  ended: false
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
  /** The person pressed "Save again". */
  SaveAgain: {}
  /**
   * The server refused the rows (the import was confirmed or removed meanwhile, the role was taken away), with its
   * sentence for the person.
   */
  SaveRefused: { readonly reason: string }
  /**
   * A picture of the import arrived: a read, a match's answer, a card's Continue. `open`: whether the import can
   * still be decided; a picture of one that cannot ends the draft.
   */
  ViewArrived: Picture & {
    readonly open: boolean
    /** How many times the import has been confirmed, taken back ones included: the view's history counts them. */
    readonly confirms: number
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
  /** The server refused a save: the screen goes back to what is saved. `reason` is the server's sentence. */
  Refused: { readonly reason: string }
  /** Accepts were not applied: each row shows its proposal open again. */
  AcceptsTakenBack: { readonly accepts: ReadonlyArray<StaleAccept> }
  /**
   * The person's waiting rows outlived a confirm of the import (it was confirmed, and opened again, before they were
   * sent): they were not part of it and are not sent into it.
   */
  Outlived: { readonly rows: RowChanges }
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

/** The rows with the accepts the server did not apply taken out of each decision. */
const withoutAccepts = (rows: RowChanges, stale: ReadonlyArray<StaleAccept>): RowChanges =>
  A.isReadonlyArrayNonEmpty(stale)
    ? R.map(rows, (change, rowId) =>
        O.map(change, (decision) => ({
          ...decision,
          accepted: A.filter(
            decision.accepted,
            (field) => !A.some(stale, (accept) => accept.rowId === rowId && accept.field === field)
          )
        }))
      )
    : rows

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
    return O.map(draft.leftOver, (rows) => ({ rows, madeOn: {}, confirms: draft.confirms, leftOver: true }))
  }
  const rows = unconfirmed(draft)
  if (R.isEmptyReadonlyRecord(rows)) return O.none()
  // A row waiting again over the one on its way is the person's latest decision of it, made on its own revision.
  return O.some({
    rows,
    madeOn: madeOnOf(rows, { ...draft.flightOn, ...draft.unsentOn }),
    confirms: draft.confirms,
    leftOver: false
  })
}

/** True when the draft holds nothing of the person's that the server has not put in a picture the screen has read. */
export const settled = (draft: Draft): boolean =>
  O.isNone(draft.landed) && O.isNone(draft.flight) && R.isEmptyReadonlyRecord(draft.unsent)

/**
 * Sends what is unsent when nothing is out: each save carries the rows changed since the last one was sent, each
 * with its own revision. Nothing is sent while a picture is awaited after a confirm that was refused or lost.
 */
const sending = (draft: Draft): Stepped => {
  if (O.isSome(draft.flight) || R.isEmptyReadonlyRecord(draft.unsent) || draft.waitsForPicture) {
    return { draft, effects: none }
  }
  const madeOn = madeOnOf(draft.unsent, draft.unsentOn)
  return {
    draft: { ...draft, flight: O.some(draft.unsent), flightOn: madeOn, unsent: {}, unsentOn: {}, stalled: false },
    effects: [DraftEffect.Send({ delta: deltaOf(draft.unsent), madeOn })]
  }
}

/** The rows of the save or the confirm that was out go back under whatever was changed since, with their revisions. */
const backToUnsent = (draft: Draft, rows: RowChanges): Draft => ({
  ...draft,
  sentBefore: A.dedupe([...draft.sentBefore, ...R.keys(rows)]),
  flight: O.none(),
  unsent: { ...rows, ...draft.unsent },
  unsentOn: { ...madeOnOf(rows, draft.flightOn), ...draft.unsentOn },
  flightOn: {}
})

/**
 * A draft nobody looks at keeps nothing once the server has everything. Its epoch goes on: the next visit's region
 * is another one, never taken for one drawn before.
 */
const letGo = (draft: Draft): Draft =>
  !draft.onScreen && settled(draft) && draft.confirm === "idle" && O.isSome(draft.held) && O.isNone(draft.leftOver)
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
  why: { readonly read: boolean; readonly counted: number; readonly accepts?: ReadonlyArray<StaleAccept> }
): Draft => {
  const before = O.getOrElse(draft.heldBack, (): HeldBack => ({ read: false, apart: 0, accepts: [] }))
  return {
    ...draft,
    confirm: "idle",
    seenWhileWaiting: O.none(),
    heldBack: O.some({
      read: why.read,
      apart: before.apart + why.counted,
      accepts: [...before.accepts, ...(why.accepts ?? [])]
    })
  }
}

/**
 * Sends the confirm, when the screen holds a picture with nothing of the person's on its way over it: it names that
 * picture's revision and carries the rows not sent yet, which are what the screen shows over it. The rows ride in
 * `flight`, so no save goes out beside the confirm.
 */
const confirming = (draft: Draft): Stepped =>
  O.match(draft.held, {
    onNone: () => ({ draft: confirmAt(draft, "idle"), effects: none }),
    onSome: (held) => {
      // Each row it carries names the revision it was decided on.
      const madeOn = madeOnOf(draft.unsent, draft.unsentOn)
      return {
        draft: confirmAt(
          {
            ...draft,
            flight: O.some(draft.unsent),
            flightOn: madeOn,
            unsent: {},
            unsentOn: {},
            stalled: false,
            seenWhileWaiting: O.none()
          },
          "out"
        ),
        effects: [DraftEffect.Confirm({ revision: held.revision, madeOn, delta: deltaOf(draft.unsent) })]
      }
    }
  })

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
} = dual(2, (draft: Draft, event: DraftEvent): Stepped => told(draft, event, transition(draft, event)))

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
  const rows = R.filter(
    { ...O.getOrElse(draft.leftOver, (): RowChanges => ({})), ...unconfirmed(draft) },
    (change, rowId) => !Eq.equals(R.get(picture.decisions, rowId), change)
  )
  return {
    draft: {
      ...emptyDraft,
      onScreen: draft.onScreen,
      epoch: draft.epoch + 1,
      leftOver: R.isEmptyReadonlyRecord(rows) ? O.none() : O.some(rows),
      ended: true
    },
    effects: [DraftEffect.Restart({ announce: false })]
  }
}

/** A picture of an import that can still be decided: the draft follows it. */
const following = (draft: Draft, picture: Picture): Stepped =>
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
      return restarting({
        before: draft,
        after:
          // A confirm held back already: this is the newer picture, read, with the rows it decides otherwise.
          O.isSome(draft.heldBack)
            ? holdingBack(after, { read: true, counted: apart })
            : draft.confirm === "waiting"
              ? apart === 0
                ? // Nothing shown changed: it may be the picture the person's own save leaves. Its answer tells.
                  { ...after, seenWhileWaiting: O.some(picture.revision) }
                : // A newer picture from elsewhere holds the confirm back.
                  holdingBack(after, { read: true, counted: apart })
              : after,
        announce: !draft.matching
      })
    }
  })

const transition = (draft: Draft, event: DraftEvent): Stepped =>
  DraftEvent.$match(event, {
    // What this browser kept from before a reload comes back as the person's waiting rows, not saved yet. Nothing
    // is sent here: the picture the step finds arrives next, and says whether the import can still be decided.
    Opened: ({ kept }) => {
      const opened: Draft = { ...draft, onScreen: true }
      if (!settled(opened) || O.isNone(kept)) return { draft: opened, effects: none }
      return {
        // Rows a closed import left over come back as that, to be named: they are not the person's waiting rows.
        draft: kept.value.leftOver
          ? { ...opened, leftOver: O.some(kept.value.rows), ended: true }
          : {
              ...opened,
              unsent: kept.value.rows,
              unsentOn: kept.value.madeOn,
              // Sent before the reload, or not: not known.
              sentBefore: R.keys(kept.value.rows),
              confirms: kept.value.confirms,
              stalled: true
            },
        effects: none
      }
    },
    Left: () => ({ draft: letGo({ ...draft, onScreen: false, matching: false }), effects: none }),
    LeftOverNamed: () => ({ draft: draft.ended ? { ...draft, leftOver: O.none() } : draft, effects: none }),
    // The draft ends on the picture the confirm answered with: rows the person decided while it was out were not part
    // of it, and the result names them; the rows it carried are in that picture, and are not.
    ConfirmDone: ({ decisions, revision }) =>
      draft.confirm !== "out" ? { draft, effects: none } : closing(confirmAt(draft, "idle"), { revision, decisions }),
    ConfirmPressed: () => {
      // While the newer picture is being read after a confirm that was not made, the button waits for it.
      if (draft.confirm !== "idle" || O.isNone(draft.held) || O.exists(draft.heldBack, (why) => !why.read)) {
        return { draft, effects: none }
      }
      const pressed: Draft = { ...draft, heldBack: O.none() }
      // Their own save is out: the confirm waits for its answer, and goes on the picture that save leaves.
      if (O.isSome(pressed.flight)) return { draft: confirmAt(pressed, "waiting"), effects: none }
      // The picture held is known to be behind (somebody else saved before the person's last save): the newer one
      // is asked for, and the confirm waits for the person to have seen it.
      if (O.isSome(pressed.landed)) {
        return { draft: holdingBack(pressed, { read: false, counted: 0 }), effects: [DraftEffect.Ask()] }
      }
      return confirming(pressed)
    },
    // Nothing was written. The newer picture is asked for, and the person's rows are saved as any decision is.
    ConfirmMoved: () =>
      draft.confirm !== "out"
        ? { draft, effects: none }
        : O.isSome(draft.closedSeen)
          ? closing(unconfirming(draft), draft.closedSeen.value)
          : then(sending(holdingBack(unconfirming(draft), { read: false, counted: 0 })), (after) => ({
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
          : // Said as a save's failure is: the rows wait on the screen, with "Save again" for the person to send them
            // before any picture comes (a confirm that never reached the server wrote nothing, and its read answers
            // the same revision).
            { draft: { ...unconfirming(draft), waitsForPicture: true, stalled: true }, effects: [DraftEffect.Ask()] },
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
          holdingBack({ ...back, unsent: withoutAccepts(back.unsent, accepts) }, { read: false, counted: 0, accepts })
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
      return sending({
        ...draft,
        leftOver: O.none(),
        unsent,
        unsentOn: madeOnOf(unsent, { ...draft.unsentOn, ...R.map(changes, () => at) })
      })
    },
    // The person's own press sends the rows, a picture awaited or not.
    SaveAgain: () => sending({ ...draft, stalled: false, waitsForPicture: false }),
    // Not lost: the rows go back under whatever was changed since, and wait. A confirm that waited for this save is
    // not made: the person is told the save failed, and presses again.
    SaveFailed: () =>
      draft.confirm === "out"
        ? { draft, effects: none }
        : O.match(draft.flight, {
            onNone: () => ({ draft, effects: none }),
            onSome: (rows) => ({
              draft: confirmAt({ ...backToUnsent(draft, rows), stalled: true }, "idle"),
              effects: [DraftEffect.Say({ what: Said.NotSaved() })]
            })
          }),
    // The screen goes back to the decisions the server holds, and the import is asked again. The rows are set
    // aside, never sent: if the import turns out to be closed, the result names them; they are let go when the
    // person decides again, having been told they were not saved.
    SaveRefused: ({ reason }) =>
      draft.confirm === "out"
        ? { draft, effects: none }
        : O.match(draft.flight, {
            onNone: () => ({ draft, effects: none }),
            onSome: () =>
              then(
                restarting({
                  before: draft,
                  after: confirmAt(
                    { ...draft, flight: O.none(), unsent: {}, stalled: false, leftOver: O.some(unconfirmed(draft)) },
                    "idle"
                  ),
                  announce: false
                }),
                (after) => ({
                  draft: after,
                  effects: [DraftEffect.Say({ what: Said.Refused({ reason }) }), DraftEffect.Ask()]
                })
              )
          }),
    SaveAnswered: ({ changed, notApplied, revision }) =>
      O.match(draft.confirm === "out" ? O.none() : draft.flight, {
        onNone: () => ({ draft, effects: none }),
        onSome: (sent) => {
          // What the server saved: the rows as sent, without the accepts it did not apply. A row decided again since,
          // waiting behind, loses them too: the person has just been told they were taken back.
          const rows = withoutAccepts(sent, notApplied)
          const base: Draft = {
            ...draft,
            unsent: withoutAccepts(draft.unsent, notApplied),
            flight: O.none(),
            flightOn: {},
            // The rows of this save are known to be written now.
            sentBefore: A.filter(draft.sentBefore, (rowId) => !R.has(sent, rowId))
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
            const heldBack = holdingBack(asked.draft, { read: later && O.isNone(asked.draft.landed), counted: 0 })
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
    ViewArrived: ({ confirms, decisions, open, revision }) => {
      const picture: Picture = { revision, decisions }
      // The confirm that is out is this screen's own: its answer says whether it is the one that closed the import.
      if (!open) {
        return draft.confirm === "out"
          ? { draft: { ...draft, closedSeen: O.some(picture), confirms: O.some(confirms) }, effects: none }
          : closing(draft, picture)
      }
      // Open again after it had ended (reopened to review again): the rows left over were named on the result.
      const reopened: Draft = draft.ended ? { ...draft, ended: false, leftOver: O.none() } : draft
      // The import was confirmed since the person's waiting rows were decided, and opened again: they were not part
      // of that confirm, and are not sent into the reopened import. They are named, and let go.
      const outlived = O.exists(reopened.confirms, (before) => confirms > before)
        ? R.filter(reopened.unsent, (change, rowId) => !Eq.equals(R.get(decisions, rowId), change))
        : {}
      // Only a picture newer than the one held (or the first) is the answer a refused or lost confirm waits for: the
      // view the tab already held, given again when the step is drawn again, says nothing of what that confirm wrote.
      const newer = O.isNone(reopened.held) || revision > heldAt(reopened)
      const now: Draft = {
        ...reopened,
        ...(R.isEmptyReadonlyRecord(outlived) ? {} : { unsent: {}, unsentOn: {}, stalled: false }),
        confirms: O.some(confirms),
        waitsForPicture: reopened.waitsForPicture && !newer
      }
      const named: ReadonlyArray<DraftEffect> = R.isEmptyReadonlyRecord(outlived)
        ? none
        : [DraftEffect.Say({ what: Said.Outlived({ rows: outlived }) })]
      // A picture arrived, so the server can be reached and the import can be decided: rows that waited after a failed
      // save, since before a reload, or after a confirm that was refused or lost, are sent.
      const first = O.isNone(now.held)
      return then(
        then({ draft: now, effects: named }, (held) => following(held, picture)),
        (after) => (first || after.stalled || draft.waitsForPicture ? sending(after) : { draft: after, effects: none })
      )
    }
  })
