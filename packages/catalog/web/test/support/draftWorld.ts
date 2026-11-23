// The review's draft against a server and a network that answer in any order, as one world that commands are played in.
// The server does what the real one does with a save: a row that waited is written only over what it names, a part made
// before its column was matched again is not applied, and a closed import refuses. After every command the rules that a
// wrong result would break are checked (`holds`): each decision the person made is on the server as written by her,
// waiting, a side of a line, or named, and a colleague's equal value counts only while she is shown it as the open
// import's (`accountsFor`); what she was told is not sent never comes back to be sent (`toldNotSent`); what the screen
// shows of a row is the newest word the draft was told of it (`newestShown`); and nothing somebody else decided is ever
// overwritten unasked. The machine's faults that break these are named in `Blind`, each a switch.
import { expect } from "@effect/vitest"
import * as A from "effect/Array"
import * as Eq from "effect/Equal"
import * as Formatter from "effect/Formatter"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { type DecisionDelta, decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import {
  type Draft,
  DraftEffect,
  DraftEvent,
  decisionsIn,
  emptyDraft,
  Keep,
  type LinePick,
  linesShown,
  type MadeOn,
  type Named,
  over,
  type Picture,
  type RowChanges,
  Said,
  sameDecision,
  type Several,
  shown,
  type Side,
  step,
  type Waiting,
  waiting
} from "../../src/Draft.machine.ts"
import { lineGroups, lineWords } from "../../src/internal/leftOver.ts"
import { keptForm } from "../../src/internal/storedWaiting.ts"

type Value = O.Option<SavedDecisions[string]>

export const out = decisionFromFlags({ out: true })
export const kept = decisionFromFlags({ kept: true })
export const accepted = decisionFromFlags({ accepted: ["unitCost"] })

const Row = S.Literals(["a", "b", "c"])
const To = S.Literals(["out", "kept", "accepted", "acceptedOut", "empty", "nothing"])
type To = typeof To.Type
/** Which of the saves out: the one the draft waits for, or an earlier one it no longer does. */
const Which = S.Literals(["first", "last"])
/** One of the saves out between the first and the last, by its place among them (`at`, from 0): any of them answers. */
const At = S.Int.check(S.isBetween({ minimum: 0, maximum: 20 }))

/** Everything that can happen, in any order. */
export const Command = S.TaggedUnion({
  Decide: { row: Row, to: To },
  SomeoneElse: { row: Row, to: To },
  /** Somebody matches the column the accepts rest on: the stored ones are taken back. */
  Match: {},
  ServerTakesSave: { which: S.optionalKey(Which), at: S.optionalKey(At) },
  SaveAnswers: { which: S.optionalKey(Which), at: S.optionalKey(At) },
  SaveFails: { which: S.optionalKey(Which), at: S.optionalKey(At) },
  SaveSignedOut: { which: S.optionalKey(Which), at: S.optionalKey(At) },
  SaveRefused: { which: S.optionalKey(Which), at: S.optionalKey(At) },
  SaveAgain: {},
  ReturnToTab: {},
  ServerTakesRead: {},
  ReadArrives: {},
  OtherAnswerSent: {},
  OtherAnswerArrives: {},
  Leave: {},
  ComeBack: {},
  ComeBackQuickly: {},
  /**
   * The page is loaded again. `idLate`: the page started before the tab knew its own id, so the step opened with
   * nothing kept, and the tab's own entry is read in afterwards (`TabIdKnown`), as the runner does (`followDraft`).
   */
  Reload: { idLate: S.optionalKey(S.Boolean) },
  /** The tab knows its id: what it kept before the reload is taken up into the draft as it stands (`TakenUp`, `here`). */
  TabIdKnown: {},
  /** A closed tab's entry is taken up: a decision of one row (and of it refused, or landed on the server), or a line. */
  TakeUp: {
    row: Row,
    to: To,
    beside: S.Literals(["no", "refused", "another"]),
    as: S.Literals(["waiting", "landed", "refused"])
  },
  Settle: { row: Row, which: S.Literals(["theirs", "first", "second"]) },
  SettleAll: { which: S.Literals(["theirs", "first"]) },
  SomeoneConfirms: {},
  SomeoneReopens: {},
  /** Somebody opens the closed import again, decides one row and confirms it again, while this tab reads nothing. */
  ReopenDecideConfirm: { row: Row, to: To },
  /**
   * While a save of hers is out, somebody confirms the import, this tab reads it closed, and somebody opens it again;
   * then (`then`) nothing more, or the server takes the save, or takes it and answers: the save's answer, or the server
   * taking it, comes after a close and a reopen.
   */
  ClosedAround: { then: S.Literals(["nothing", "taken", "answered"]) },
  PressConfirm: {},
  ServerTakesConfirm: {},
  ConfirmAnswers: {},
  ConfirmFails: {},
  /** The import is removed: what the person had of it is named, and that is the end. */
  Removed: {}
})
export type Command = typeof Command.Type

export const valueOf = (to: To): Value => {
  const values: Record<To, Value> = {
    out: O.some(out),
    kept: O.some(kept),
    accepted: O.some(accepted),
    acceptedOut: O.some(decisionFromFlags({ accepted: ["unitCost"], out: true })),
    empty: O.some(decisionFromFlags({})),
    nothing: O.none()
  }
  return values[to]
}

const change = (row: string, to: To): RowChanges => ({ [row]: valueOf(to) })

/** What one of the world's records lists of a row: nothing where the row has no entry yet. */
const listOf: {
  (key: string): <A>(self: Readonly<Record<string, ReadonlyArray<A>>>) => ReadonlyArray<A>
  <A>(self: Readonly<Record<string, ReadonlyArray<A>>>, key: string): ReadonlyArray<A>
} = dual(2, <A>(self: Readonly<Record<string, ReadonlyArray<A>>>, key: string): ReadonlyArray<A> =>
  O.getOrElse(R.get(self, key), (): ReadonlyArray<A> => [])
)

/** When she made a decision (`Fact.at`, `Covered.at`), where that is recorded. */
const atOf = (one: { readonly at?: number }): O.Option<number> => O.fromUndefinedOr(one.at)

/** The same, as the field another record of the decision carries: left out where it is not recorded. */
const atField = (one: { readonly at?: number }): { readonly at?: number } =>
  O.match(atOf(one), { onNone: () => ({}), onSome: (at) => ({ at }) })

/** A decision without its accept, as a match leaves it. */
const withoutAccept = (value: Value): Value => O.map(value, (decision) => ({ ...decision, accepted: [] }))
const hasAccept = (value: Value): boolean => O.exists(value, (decision) => decision.accepted.length > 0)

const isIn = (values: ReadonlyArray<Value> | undefined, one: Value): boolean =>
  A.some(values ?? [], (other) => sameDecision(other, one))

/** The import as the server has it at one revision: what a read answers with. */
export interface Snapshot extends Picture {
  readonly open: boolean
  readonly confirms: number
  readonly matchedAt: number
  readonly takenBack: ReadonlyArray<{ readonly revision: number; readonly rows: ReadonlyArray<string> }>
}

/** A save that is out: what it carries, and what the server will answer once it has taken it. */
interface Save {
  readonly id: number
  readonly delta: DecisionDelta
  readonly madeOn: MadeOn
  readonly over: Several
  /** The rows that had not waited when it was sent, as the world itself recorded it (`waited`): its live presses. */
  readonly live: ReadonlyArray<string>
  readonly answer: O.Option<Omit<Extract<DraftEvent, { readonly notApplied: unknown }>, "_tag" | "id">>
  /**
   * How many confirms the import had in the picture the draft decided its rows over, as the save says (`opening`): the
   * server takes it only while the import has had exactly that many, and refuses it otherwise.
   */
  readonly opening: number
  /** The server refused it (made before a confirm since): its answer, when it comes, is the refusal. */
  readonly refused: boolean
  /** When it was sent (`World.ticks`): it carries only decisions made before. */
  readonly sentAt: number
}

/** One decision the person made that must be somewhere. */
interface Fact {
  readonly row: string
  readonly value: Value
  readonly here: boolean
  /** How many confirms the import had in the picture the tab held when she made it. */
  readonly opening: number
  /** A closed tab's, made in an opening newer than this tab had read when it was taken up (`Blind.newerEntry`). */
  readonly ahead?: boolean
  /** When she made it (`World.madeAt`): only a write of hers after that accounts for it (`hers`). */
  readonly at?: number
  /** Made in a closed tab and taken up (picked in this tab since, or not). */
  readonly fromTab?: boolean
}

/**
 * A decision of hers let go while the server did not hold it as hers, and not dropped yet: accounted for only once she
 * is shown the import open holding an equal value as the server's (`accountsFor`). `shownIn`: what she was shown when
 * it was let go: the equal value in a picture of the import open the server had moved on from, or in a picture of the
 * import closed (a confirm took the equal value, not hers), or in the import opened again after a confirm since she made
 * it (`reopened`), or nothing yet. `reloaded`: the page was loaded since. `opening`: the fact's.
 */
interface Covered {
  readonly row: string
  readonly value: Value
  readonly shownIn: "open" | "closed" | "reopened" | "nothing"
  readonly reloaded: boolean
  readonly opening: number
  /** Made in an opening newer than the picture the tab held when it was let go (`Blind.newerEntry`). */
  readonly ahead?: boolean
  /** The fact's `at`. */
  readonly at?: number
  /** Let go on a picture of the import open: that picture's revision (`heldToItsClose`). */
  readonly shownAt?: number
}

/**
 * True when what the server held of the row, from the open picture she was shown it in to the confirm that ended the
 * opening she made it in, was always equal to it: that opening was imported as she decided, as an ordinary saved
 * decision of hers is. What the row holds after is a later opening's, decided by somebody else, and no word of hers is
 * owed: only a picture the server had moved on from within that opening hides a decision let go.
 */
const heldToItsClose = (world: World, one: Covered): boolean =>
  O.exists(O.fromUndefinedOr(one.shownAt), (from) => {
    const after = A.getSomes(
      A.map(A.range(from, world.server.revision), (revision) => O.fromUndefinedOr(world.history[revision]))
    )
    return O.exists(
      A.findFirstIndex(after, (snapshot) => !snapshot.open),
      (closing) =>
        O.exists(A.get(after, closing), (closed) => closed.confirms === one.opening + 1) &&
        A.every(A.take(after, closing + 1), (snapshot) => isPartOf(one.value, R.get(snapshot.decisions, one.row)))
    )
  })

/**
 * The faults the draft machine still has, each the rule or the shape of the world the properties leave out of their
 * checks while it is unfixed, named after the fault. Every switch off (`{}`) checks everything; the machine's fix is done
 * when its switch can go.
 */
export interface Blind {
  /** F3: the same after a reload: the page forgets what the closed picture said of hers, and the reopened import says otherwise. */
  readonly reloadForgetsClose?: boolean
  /**
   * What is left of N1 that the picture cannot tell: her decision made before a confirm (it outlived it, or a closed
   * picture said it), let go because the import opened again holds an equal value that may be hers (a save of it got
   * no answer, or she decided it over somebody's decision a match can leave equal to hers); then the row is decided
   * otherwise, and nothing names hers. Where every save of it was told refused and she decided it over nothing, the
   * value is not hers, and the switch does not cover it. Telling the rest apart needs the review model on the server
   * (DECISIONS.md, "Known wrong or missing").
   */
  readonly equalAfterConfirm?: boolean
  /**
   * N3: what the browser kept of hers is read in before the draft holds a picture, and judged against no decisions at
   * all: a decision of hers equal to "nothing decided" counts as one the import holds, and is let go unnamed.
   */
  readonly judgedBeforePicture?: boolean
  /**
   * N4: her tab's own entry, read in late (`TakenUp` with `here`, the page started before the tab knew its id), is read
   * as if nothing happened in this tab since the reload: a decision of it she made again since, had refused and
   * dismissed, is sent unasked; read in while a decision of the same row is on its way, its side stays this tab's, so
   * the row has two of this tab's on one line; or it is folded into a closed tab's refused side and let go with it.
   * A shape switch: on, the generator never starts a page without its id (no `Reload` with `idLate`).
   */
  readonly lateOwnEntry?: boolean
  /**
   * A closed tab's decision made in the import opened again, taken up by a tab that has not read it opened again yet:
   * the tab sends it as made in the opening it last read, and the server refuses it, so she is told it was not saved
   * although that tab's own save may have written it. A decision does not carry the opening it was made in; the save
   * does, and takes it from the tab.
   */
  readonly newerEntry?: boolean
}

/** Every fault the machine still has, left out: what the four properties check while it is unfixed. */
export const unfixed: Blind = {
  reloadForgetsClose: true,
  equalAfterConfirm: true,
  judgedBeforePicture: true,
  lateOwnEntry: true,
  newerEntry: true
}

/**
 * How many confirms the import had in the picture the tab holds: what a decision made now was made in. Read from the
 * server's own history of that picture, not from what the draft says of it: a draft that has not heard the count since
 * a reload or a close says less, and the rule that a decision is written only in its opening is checked with this.
 */
const openingOf = (world: World): number =>
  O.match(world.draft.held, {
    onNone: () => O.getOrElse(world.draft.confirms, () => 0),
    onSome: (held) => world.history[held.revision]?.confirms ?? O.getOrElse(world.draft.confirms, () => 0)
  })

/** The openings her decisions of this value of this row were made in, by what she is expected to hold. */
const openingsOf = (world: World, row: string, value: Value, sentAt: number): ReadonlyArray<number> =>
  A.map(
    A.filter(
      world.facts,
      // A decision made after the save was sent is not one it carries, though it is equal (decided again, and sent anew).
      (fact) =>
        fact.row === row &&
        sameDecision(fact.value, value) &&
        O.match(atOf(fact), { onNone: () => true, onSome: (at) => at <= sentAt })
    ),
    (fact) => fact.opening
  )

/** True when every decision of hers this value stands for was made in this opening, and there is one. */
const allIn = (openings: ReadonlyArray<number>, test: (opening: number) => boolean): boolean =>
  A.isReadonlyArrayNonEmpty(openings) && A.every(openings, test)

/** True when the import was confirmed since she made this decision, as the picture the tab holds says. */
const confirmedSince = (world: World, fact: Pick<Fact, "opening">): boolean => openingOf(world) > fact.opening

/** Where a rule a fault breaks did not hold: its words begin with the fault's switch, so a failure says which it is. */
const broke = (fault: keyof Blind, words: string): string => `[${fault}] ${words}`

/** The screen, the server, and what is on its way between them. */
export interface World {
  draft: Draft
  server: Snapshot
  /** Every state the server has been in, by revision. */
  readonly history: Record<number, Snapshot>
  /** The rows whose stored decision somebody else wrote. */
  readonly byElse: Record<string, boolean>
  /**
   * Every decision written of each row, and who wrote it: this tab, another tab of the person's, or somebody else. What
   * a match left of one is written by whoever wrote that one. A line that says somebody decided a row since is held to
   * it (`holds`).
   */
  readonly writes: Record<string, ReadonlyArray<{ readonly value: Value; readonly by: Writer }>>
  /**
   * Every decision of each row a tab of the person's sent, whatever became of it, and what the server stored of each:
   * `over` names values, not writers, so the server cannot tell a colleague's decision equal to one of these from hers
   * (see `replaces`).
   */
  readonly sentByHer: Record<string, ReadonlyArray<Value>>
  /**
   * Every decision of each row in a save whose refusal the tab was told of: written by none of them. Where each sending
   * of a value was so refused, the screen knows an equal value the server holds is not hers.
   */
  readonly toldRefused: Record<string, ReadonlyArray<Value>>
  /**
   * What a pick on a line promised of a row: that what the server held then stays (Keep theirs, Keep what is saved),
   * or that the person's decision is written or asked about again (Use mine, Keep this tab's). Held until the person
   * decides the row again.
   */
  promised: Record<string, { readonly stays: boolean; readonly value: Value; readonly opening: number }>
  /** What a stored decision was before a match took part of it back: it counts as that still. */
  readonly before: Record<string, ReadonlyArray<Value>>
  /** The import's view as the tab holds it: what every screen of the import reads. */
  view: O.Option<Snapshot>
  /** The saves out, oldest first: the last is the draft's, unless it ended or was let go since. */
  saves: ReadonlyArray<Save>
  /** The read that is out: on its way, or taken by the server with what it will answer. */
  read: O.Option<O.Option<Snapshot>>
  /** Views on their way from other requests (a match, a card's Continue), oldest first. */
  late: Array<Snapshot>
  /** The confirm that is out, what the screen showed when it was sent, and what the server did with it. */
  confirm: O.Option<{
    readonly id: number
    readonly revision: number
    readonly delta: DecisionDelta
    readonly madeOn: MadeOn
    readonly shown: SavedDecisions
    readonly live: ReadonlyArray<string>
    readonly answer: O.Option<"made" | "moved" | "stale">
  }>
  /** The person's decisions, each to be found somewhere. */
  facts: ReadonlyArray<Fact>
  /** Every decision the person made of each row, in any tab: nothing else is ever sent. */
  readonly made: Record<string, ReadonlyArray<Value>>
  /** The decisions the person could see of each row (the screen's, a line's, a closed tab's own) before they pressed. */
  readonly couldSee: Record<string, ReadonlyArray<Value>>
  /** The same, for each decision of theirs that may be sent: as it was when they pressed. */
  pressedOver: ReadonlyArray<{
    readonly row: string
    readonly value: Value
    readonly saw: ReadonlyArray<Value>
    /** What the row held, as she was shown it, when she made this: somebody's decision, or one of hers. */
    readonly over?: ReadonlyArray<Value>
  }>
  /** The rows that are not a live press any more: they waited, or somebody saved since. */
  readonly waited: Record<string, boolean>
  /** The decisions the server refused, until the person makes them again. */
  refused: ReadonlyArray<{ readonly row: string; readonly value: Value }>
  /** The rows the server confirmed for the person, until somebody else changes the row or the person does again. */
  confirmed: Record<string, Value>
  restarts: number
  /** How many times the person was told that something changed on another screen. */
  announced: number
  /** How many times the person was told something. */
  said: number
  /** What the person was told of decisions let go. */
  named: ReadonlyArray<{ readonly row: string; readonly value: Value }>
  kept: O.Option<Waiting>
  /** The latest revision this tab has been told of: by a view put in place, or by a save's answer. */
  told: number
  /** What the review region holds for itself: its decisions since it was last started, or none while it made none. */
  region: O.Option<SavedDecisions>
  removed: boolean
  /**
   * Every decision of each row the server wrote from a save or a confirm of hers (this tab's, or a closed tab's), with
   * when (`ticks`): a write accounts only for what she made before it, never for a decision she made again after it.
   */
  readonly byHer: Record<
    string,
    ReadonlyArray<{ readonly value: Value; readonly at: number; readonly revision: number }>
  >
  /** Her decisions let go while she was shown an equal value somebody else wrote: see `Covered`. */
  covered: Array<Covered>
  /**
   * What she was told by name is not sent (`Outlived`), each until she decides the row again, with the revision she
   * was told at (`at`): what a match after it leaves of the decision is the same decision; before it, another.
   */
  toldNotSent: ReadonlyArray<{ readonly row: string; readonly value: Value; readonly at: number }>
  /**
   * Sides a line offered before any match came after the telling, each what such a match would leave of a decision
   * she was told is not sent: another decision than that one (a closed tab's own), so no match after makes it the same.
   */
  apart: ReadonlyArray<{ readonly row: string; readonly told: Value; readonly side: Value }>
  /** A clock of her acts and the server's writes of them, one tick each: what came first (`madeAt`, `herWrites`). */
  ticks: number
  /** When she made each decision of each row, in this tab or a closed one. */
  madeAt: ReadonlyArray<{ readonly row: string; readonly value: Value; readonly at: number; readonly here: boolean }>
  /** When the server wrote each decision of hers. */
  herWrites: ReadonlyArray<{ readonly row: string; readonly value: Value; readonly at: number }>
  /**
   * The decisions of hers she was told of by name (a refusal of the save that carried it, or a naming as not part of
   * the import), until she decides the row again: one decision is named once.
   */
  namings: ReadonlyArray<{ readonly row: string; readonly value: Value; readonly refusal: boolean }>
  /** When she last decided each row otherwise in this tab: what was made and named of it before is of the past. */
  readonly clearedAt: Record<string, number>
  /**
   * The newest word the draft was told of each row while it held a picture: the revision, what the server held of the
   * row then, and whether a picture or a save's answer said it. Forgotten when the draft holds no picture any more.
   */
  words: Record<string, { readonly at: number; readonly value: Value; readonly from: "picture" | "answer" }>
  /** The tab's own entry, kept from before a reload the tab started without its id: read in by `TabIdKnown`. */
  ownLate: O.Option<Waiting>
  /** What such an entry held when it was read in. */
  lateRead: ReadonlyArray<{ readonly row: string; readonly value: Value }>
  /** The faults left out of the checks. */
  readonly blind: Blind
  /** How often each shape of ordering the generator can make came up: counted, never checked. */
  readonly shapes: Record<string, number>
}

const start = (decisions: SavedDecisions, blind: Blind = {}): World => {
  const server: Snapshot = { revision: 1, decisions, open: true, confirms: 0, matchedAt: 0, takenBack: [] }
  return {
    draft: emptyDraft,
    server,
    history: { 1: server },
    byElse: {},
    writes: {},
    sentByHer: {},
    toldRefused: {},
    promised: {},
    before: {},
    view: O.some(server),
    saves: [],
    read: O.none(),
    late: [],
    confirm: O.none(),
    facts: [],
    made: {},
    couldSee: {},
    pressedOver: [],
    waited: {},
    refused: [],
    confirmed: {},
    restarts: 0,
    announced: 0,
    said: 0,
    named: [],
    kept: O.none(),
    told: 1,
    region: O.none(),
    removed: false,
    byHer: {},
    covered: [],
    toldNotSent: [],
    apart: [],
    ticks: 0,
    madeAt: [],
    herWrites: [],
    namings: [],
    clearedAt: {},
    words: {},
    ownLate: O.none(),
    lateRead: [],
    blind,
    shapes: {}
  }
}

/** One more of a shape of ordering. */
const counts = (world: World, shape: string): void => {
  world.shapes[shape] = (world.shapes[shape] ?? 0) + 1
}

/**
 * True when `value` is what a match left of a decision `told`: its remainder without the accept, where that remainder
 * is a decision at all. A told decision that was only an accept leaves the row undecided, which is no decision of hers:
 * her own "nothing" is another one.
 */
const leftByMatch = (told: Value, value: Value): boolean => {
  const left = withoutAccept(told)
  return !sameDecision(left, O.none()) && sameDecision(left, value)
}

/** True when `value` is a decision she was told of a row is not sent: that one, or what a match since left of it. */
const toldOf = (world: World, row: string, value: Value): boolean =>
  A.some(
    world.toldNotSent,
    (one) =>
      one.row === row &&
      (sameDecision(one.value, value) || (world.server.matchedAt > one.at && leftByMatch(one.value, value)))
  )

/** The server holds this decision of a row as hers, from now (`World.byHer`). */
const heldByHer = (world: World, row: string, value: Value): void => {
  world.ticks += 1
  world.byHer[row] = [...listOf(world.byHer, row), { value, at: world.ticks, revision: world.server.revision }]
}

/** The server wrote this decision of a row from a save or a confirm of hers. */
const writtenByHer = (world: World, row: string, value: Value): void => {
  world.ticks += 1
  heldByHer(world, row, value)
  world.herWrites = [...world.herWrites, { row, value, at: world.ticks }]
  // Written after she was told it is not sent: the words she was given were wrong.
  expect(
    toldOf(world, row, value),
    `row ${row}: the server wrote ${Formatter.format(value)} of hers after she was told it is not sent`
  ).toBe(false)
}

/**
 * The draft was told what the server held of a row at a revision: the newest word of it is kept, while the draft has
 * something to keep it over (a picture, or a word an answer left before one).
 */
const hears = (world: World, row: string, word: World["words"][string]): void => {
  if (world.draft.ended || (O.isNone(world.draft.held) && O.isNone(world.draft.landed))) return
  if (O.exists(R.get(world.words, row), (was) => was.at > word.at)) return
  world.words[row] = word
}

const rowsOf = (delta: DecisionDelta): RowChanges => ({
  ...R.map(delta.set, (decision) => O.some(decision)),
  ...R.fromEntries(A.map(delta.clear, (row) => [row, O.none()] as const))
})

/** Decisions as the person reads them: a row decided with nothing in it reads as one not decided. */
const plain = (decisions: SavedDecisions): SavedDecisions =>
  R.filter(decisions, (one) => !sameDecision(O.some(one), O.none()))

/** What the person sees in the region: its own decisions, or the draft's while it has made none. */
export const regionShows = (world: World): SavedDecisions => plain(O.getOrElse(world.region, () => shown(world.draft)))

/** The server moves on by one. */
const moves = (world: World, next: Partial<Snapshot>): void => {
  world.server = { ...world.server, ...next, revision: world.server.revision + 1 }
  world.history[world.server.revision] = world.server
}

/** Who wrote a decision the server holds. */
type Writer = "this tab" | "another tab" | "somebody else"

/** The server stores one row's decision, written by this tab, another tab of the person's, or somebody else. */
const stores = (world: World, row: string, value: Value, by: Writer): void => {
  const byElse = by === "somebody else"
  world.writes[row] = [...listOf(world.writes, row), { value, by }]
  world.byElse[row] = byElse
  // What the person picked to stay is moot once somebody else writes the row again.
  if (byElse) delete world.promised[row]
  world.before[row] = []
  if (byElse) delete world.confirmed[row]
}

/**
 * A save or a confirm of the person's replaces what is stored: where somebody else decided that, the person could see it
 * before they pressed, or it is a live press (made on the picture held, racing with theirs). Whether it was a live press
 * is the world's own record of what waited when it was sent (`Save.live`), never what the draft sent: a row that waited
 * and went without `over` is a blind overwrite here.
 */
const replaces = (
  world: World,
  write: {
    readonly row: string
    readonly value: Value
    readonly named: O.Option<ReadonlyArray<Value>>
    readonly isLive: boolean
  }
): void => {
  const { isLive, named, row, value } = write
  const stored = R.get(world.server.decisions, row)
  // Promised to stay by a pick of the person's: no write of hers may change it.
  O.map(R.get(world.promised, row), (promise) => {
    if (!promise.stays) return
    expect(
      sameDecision(value, stored) || isPartOf(promise.value, value),
      `row ${row}: after the person kept ${Formatter.format(promise.value)}, a save of hers wrote ${Formatter.format(value)} over it`
    ).toBe(true)
  })
  if (world.byElse[row] !== true || sameDecision(stored, value) || sameDecision(stored, O.none()) || isLive) return
  const saw = A.flatMap(
    A.filter(
      world.pressedOver,
      (press: World["pressedOver"][number]) => press.row === row && isPartOf(press.value, value)
    ),
    (press: World["pressedOver"][number]) => press.saw
  )
  // The one thing the server cannot tell: what is stored is a decision the save names (or what a match after the row's
  // revision left of one), and the person knew that decision (she saw it, or a tab of hers sent it), but somebody else
  // wrote it back since. `over` names values, not writers or revisions, so the server writes hers over it. Allowed here
  // and nowhere else; a value she never knew of, or a row that waited and named nothing, is a blind overwrite.
  const knew = (one: Value): boolean => isIn(saw, one) || isIn(world.sentByHer[row], one)
  const told = O.exists(named, (values) =>
    A.some(values, (one) => knew(one) && (sameDecision(stored, one) || sameDecision(stored, withoutAccept(one))))
  )
  if (told) return
  expect(
    A.some([stored, ...listOf(world.before, row)], (one) => isIn(saw, one)),
    `row ${row}: somebody else's ${Formatter.format(stored)} was replaced by ${Formatter.format(value)} unasked (the person had seen ${Formatter.format(saw)})`
  ).toBe(true)
}

/** A pick's promise that her decision is written is kept once the server stores it. */
const keeps = (world: World, row: string, written: Value): void =>
  void O.map(R.get(world.promised, row), (promise) => {
    if (!promise.stays && isPartOf(promise.value, written)) delete world.promised[row]
  })

/** Every row of a save or a confirm is a decision a tab of hers sent. */
const sent = (world: World, rows: RowChanges): void => {
  for (const [row, value] of R.toEntries(rows)) world.sentByHer[row] = [...listOf(world.sentByHer, row), value]
}

/** True when the decision sent is the one made, or what is left of it without its accept. */
const isPartOf = (made: Value, sent: Value): boolean =>
  sameDecision(made, sent) || sameDecision(withoutAccept(made), sent)

/**
 * The server takes rows of a save: what it stores of each, what it does not apply, and what was decided since. A row
 * that waited is judged as the server's `decidedSince` (`Waited.rules.ts`) judges it: written while what is stored is
 * what the save leaves of it, one of the decisions named, or one of those without the accept a match after the row's
 * revision took back.
 */
const takes = (world: World, save: Pick<Save, "delta" | "madeOn" | "over" | "live">): Save["answer"] => {
  const decisions: Record<string, SavedDecisions[string]> = { ...world.server.decisions }
  const notApplied: Array<{ readonly rowId: string; readonly field: string; readonly kind: "accept" }> = []
  const decidedSince: Array<{ readonly rowId: string; readonly theirs: Value }> = []
  for (const [row, value] of R.toEntries(rowsOf(save.delta))) {
    const stored = R.get(world.server.decisions, row)
    const names = R.get(save.over, row)
    const matchedSince = (save.madeOn[row] ?? 0) < world.server.matchedAt
    const stale = hasAccept(value) && matchedSince
    const written = stale ? withoutAccept(value) : value
    const leftOf = (one: Value): boolean =>
      sameDecision(stored, one) || (matchedSince && sameDecision(stored, withoutAccept(one)))
    if (O.exists(names, (values) => !sameDecision(stored, written) && !A.some(values, leftOf))) {
      decidedSince.push({ rowId: row, theirs: O.filter(stored, (one) => !sameDecision(O.some(one), O.none())) })
      continue
    }
    if (stale) notApplied.push({ rowId: row, field: "unitCost", kind: "accept" })
    replaces(world, { row, value: written, named: names, isLive: A.contains(save.live, row) })
    keeps(world, row, written)
    world.sentByHer[row] = [...listOf(world.sentByHer, row), written]
    // Written as it already was is no write of hers over what she was told: the import held it.
    if (Eq.equals(stored, written)) heldByHer(world, row, written)
    else writtenByHer(world, row, written)
    // A closed tab's decision this tab took up and sent is that tab's: the line may say another tab decided it.
    const by: Writer = A.some(world.facts, (fact) => fact.row === row && !fact.here && isPartOf(fact.value, written))
      ? "another tab"
      : "this tab"
    // Saved as it already was: the server holds the person's decision from now on, whoever wrote it first.
    if (Eq.equals(stored, written)) {
      stores(world, row, written, by)
      continue
    }
    stores(world, row, written, by)
    if (O.isSome(written)) decisions[row] = written.value
    else delete decisions[row]
  }
  const changed = !Eq.equals(decisions, world.server.decisions)
  if (changed) moves(world, { decisions })
  return O.some({ revision: world.server.revision, changed, notApplied, decidedSince })
}

/** A view reaches the step that is drawn. `waiting`: it is given while a read of it is out. */
const arrive = (world: World, view: Snapshot, isWaiting = false): void => {
  sees(world, view.decisions)
  dispatchIn(
    world,
    DraftEvent.ViewArrived({
      revision: view.revision,
      decisions: view.decisions,
      open: view.open,
      confirms: view.confirms,
      waiting: isWaiting,
      matches: [view.matchedAt],
      takenBack: view.takenBack
    })
  )
  // A picture of the import open says what the server held of every row at its revision.
  if (view.open) {
    for (const row of ["a", "b", "c"]) {
      hears(world, row, { at: view.revision, value: R.get(view.decisions, row), from: "picture" })
    }
  }
}

/** The person can see these decisions from now on. */
const sees = (world: World, decisions: SavedDecisions): void => {
  for (const row of ["a", "b", "c"]) {
    world.couldSee[row] = [...listOf(world.couldSee, row), R.get(decisions, row)]
  }
}

/** A view is put into the tab's: never one of an earlier revision, and an ask that is out is issued again. */
const put = (world: World, view: Snapshot): void => {
  if (O.exists(world.view, (held) => held.revision > view.revision)) return
  world.view = O.some(view)
  world.told = Math.max(world.told, view.revision)
  if (O.isSome(world.read)) world.read = O.some(O.none())
  if (world.draft.onScreen) arrive(world, view, O.isSome(world.read))
}

/** Only decisions the person made are sent, each as they made it or without a part the server took back. */
const ownRows = (world: World, rows: RowChanges): void => {
  for (const [row, value] of R.toEntries(rows)) {
    expect(
      A.some(listOf(world.made, row), (made) => isPartOf(made, value)),
      `row ${row} is sent as ${Formatter.format(value)}, which the person never decided`
    ).toBe(true)
    // Sent as a refused decision only when nothing else she made explains it: a decision of hers that the server
    // trims (a part a match took back) to what a closed tab was refused is still hers, and goes.
    const late = A.some(world.lateRead, (one) => one.row === row && sameDecision(one.value, value))
    const refusedWords = `row ${row} is sent as the server refused it`
    if (!(late && world.blind.lateOwnEntry === true)) {
      expect(
        A.some(
          world.refused,
          (one) =>
            one.row === row &&
            sameDecision(one.value, value) &&
            !A.some(listOf(world.made, row), (made) => isPartOf(made, value) && !sameDecision(made, one.value))
        ),
        late ? broke("lateOwnEntry", refusedWords) : refusedWords
      ).toBe(false)
    }
    expect(
      A.some(world.draft.lines[row]?.sides ?? [], (side) => O.isNone(side.refused)),
      `row ${row} is sent while its line asks`
    ).toBe(false)
    expect(
      toldOf(world, row, value),
      `row ${row} is sent as ${Formatter.format(value)}, which she was told is not sent`
    ).toBe(false)
  }
}

const perform = (world: World, effect: DraftEffect): void =>
  DraftEffect.$match(effect, {
    Say: ({ what }) => {
      world.said += 1
      if (Said.$is("Outlived")(what) || Said.$is("MaybeSaved")(what)) {
        const each = [
          ...R.toEntries(what.rows),
          ...A.flatMap(R.toEntries(what.beside), ([row, values]) => A.map(values, (value) => [row, value] as const))
        ]
        for (const [row, value] of each) {
          namedOnce(world, row, value)
          // Said not to be sent at all: wrong where the server wrote it after she last made it, before this telling. A
          // closed tab's equal decision is another act of hers the words may be of: then which was written cannot be told.
          const twoTabs = A.some(world.madeAt, (one) => one.row === row && !one.here && sameDecision(one.value, value))
          if (Said.$is("Outlived")(what) && !twoTabs) {
            const made = A.reduce(world.madeAt, 0, (at, one) =>
              one.row === row && sameDecision(one.value, value) ? Math.max(at, one.at) : at
            )
            expect(
              A.some(world.herWrites, (one) => one.row === row && sameDecision(one.value, value) && one.at > made),
              `row ${row}: she was told ${Formatter.format(value)} was not sent, and the server had written it`
            ).toBe(false)
          }
        }
        names(world, what)
        // Said not to be sent into the import: from now on none of them is, unless she decides the row again.
        world.toldNotSent = [
          ...world.toldNotSent,
          ...A.map(R.toEntries(what.rows), ([row, value]) => ({ row, value, at: world.server.revision })),
          ...A.flatMap(R.toEntries(what.beside), ([row, values]) =>
            A.map(values, (value) => ({ row, value, at: world.server.revision }))
          )
        ]
      }
      // Her accepts named as taken back: a decision of hers that was only those accepts is told of, and nothing of it is
      // left to be anywhere. So is one whose rest the row already held when she pressed (an accept ticked on a row a
      // colleague had left out): the rest was never her decision, whatever the row is decided to since.
      if (Said.$is("AcceptsTakenBack")(what)) {
        const taken = (row: string, field: string): boolean =>
          A.some(what.accepts, (one) => one.rowId === row && one.field === field)
        const restWasThere = (fact: { readonly row: string; readonly value: Value }): boolean =>
          A.some(
            world.pressedOver,
            (press) =>
              press.row === fact.row &&
              sameDecision(press.value, fact.value) &&
              A.some(press.over ?? [], (held) => sameDecision(held, withoutAccept(fact.value)))
          )
        const told = A.filter(
          world.facts,
          (fact) =>
            hasAccept(fact.value) &&
            (sameDecision(withoutAccept(fact.value), O.none()) || restWasThere(fact)) &&
            O.exists(fact.value, (decision) => A.every(decision.accepted, (field) => taken(fact.row, field)))
        )
        world.named = [...world.named, ...A.map(told, (fact) => ({ row: fact.row, value: fact.value }))]
      }
    },
    Send: ({ delta, id, madeOn, opening, over: names }) => {
      // One save at a time, never beside a confirm, under an id of its own, of the person's own rows.
      expect(O.isNone(world.confirm), "a save beside a confirm").toBe(true)
      expect(
        A.some(world.saves, (save) => save.id === id),
        "two saves under one id"
      ).toBe(false)
      const rows = rowsOf(delta)
      ownRows(world, rows)
      for (const row of R.keys(rows)) {
        expect(world.waited[row] === true && !R.has(names, row), `row ${row} waited and goes as a live press`).toBe(
          false
        )
        expect(names[row]?.length ?? 0, "more decisions named than the contract takes").toBeLessThanOrEqual(50)
      }
      // What it names of each row the person knew of: she saw it, or a tab of hers sent it.
      for (const [row, named] of R.toEntries(names)) {
        const knew = [
          ...listOf(world.couldSee, row),
          ...A.flatMap(
            A.filter(world.pressedOver, (press: World["pressedOver"][number]) => press.row === row),
            (press: World["pressedOver"][number]) => press.saw
          ),
          ...listOf(world.sentByHer, row)
        ]
        for (const one of named) {
          expect(isIn(knew, one), `row ${row} names ${Formatter.format(one)}, which the person never knew of`).toBe(
            true
          )
        }
      }
      sent(world, rows)
      const live = A.filter(R.keys(rows), (row) => world.waited[row] !== true)
      world.saves = [
        ...world.saves,
        { id, delta, madeOn, over: names, live, answer: O.none(), opening, refused: false, sentAt: world.ticks }
      ]
    },
    Ask: () => {
      world.read = O.some(O.none())
    },
    Put: ({ decisions, revision }) => {
      // The person's own save moves the view on, never back. Off screen the draft does not follow the view, so a save
      // answered then may be behind it: the runner keeps the later one.
      if (world.draft.onScreen) {
        expect(
          O.exists(world.view, (view) => view.revision > revision),
          "the person's own save moved the view back"
        ).toBe(false)
      }
      O.map(world.view, (view) => put(world, { ...view, decisions, revision }))
    },
    Restart: ({ announce }) => {
      // Counted when the person is there to see it: a draft let go while nobody looked restarts the region too.
      if (world.draft.onScreen) world.restarts += 1
      if (announce) world.announced += 1
      world.region = O.none()
    },
    Confirm: ({ delta, id, madeOn, revision }) => {
      expect(
        A.some(world.saves, (save) => O.exists(world.draft.flight, (flight) => flight.id === save.id)),
        "a confirm beside a save"
      ).toBe(false)
      expect(world.draft.lines, "a confirm is sent while a line asks").toEqual({})
      const rows = rowsOf(delta)
      ownRows(world, rows)
      sent(world, rows)
      const live = A.filter(R.keys(rows), (row) => world.waited[row] !== true)
      world.confirm = O.some({ id, revision, delta, madeOn, shown: shown(world.draft), live, answer: O.none() })
    }
  })

/** A decision of hers told of by name: never one she was told of already, since she last decided the row. */
const namedOnce = (world: World, row: string, value: Value, refusal = false): void => {
  // One naming for each time she made it: in this tab since she last decided the row here, or in a closed tab at any time
  // (a closed tab's decision taken up stands beside hers on the line until it is settled, and may be named after it).
  const since = world.clearedAt[row] ?? 0
  const makings = A.filter(
    world.madeAt,
    (one) => one.row === row && (one.at > since || !one.here) && sameDecision(one.value, value)
  ).length
  const named = A.filter(world.namings, (one) => one.row === row && sameDecision(one.value, value)).length
  expect(named >= Math.max(1, makings), `row ${row}: ${Formatter.format(value)} was named to her twice`).toBe(false)
  world.namings = [...world.namings, { row, value, refusal }]
}

/** She made this decision of this row now: what she was told by name of the row before is of another. */
const made = (world: World, row: string, value: Value, here: boolean): number => {
  world.ticks += 1
  const at = world.ticks
  world.madeAt = [...world.madeAt, { row, value, at, here }]
  // Made again in this tab as her last write of the row (or that write with the accept a match took back), on a picture
  // that shows it or has not yet read past it: that write accounts for it, and the screen has nothing to send (a
  // colleague's write since is the next picture's to show). On a picture that shows the row otherwise since, it is a new
  // decision, and only a write after it counts.
  const written = A.last(listOf(world.byHer, row))
  void O.map(
    O.filter(
      written,
      (one) =>
        here &&
        isPartOf(value, one.value) &&
        O.exists(
          world.draft.held,
          (held) => sameDecision(R.get(held.decisions, row), one.value) || held.revision <= one.revision
        )
    ),
    (one) => heldByHer(world, row, one.value)
  )
  // Decided in this tab: what was made and named of the row before is of the past (a closed tab's decision taken up
  // stands beside what this tab was told, and takes nothing of it).
  if (here) {
    world.clearedAt[row] = at - 1
    world.namings = A.filter(world.namings, (one) => one.row !== row)
  }
  return at
}

/** Decisions the person is told are let go. */
const names = (world: World, named: Named): void => {
  // A pick of a row named is not sent: what it promised is let go with it.
  for (const row of [...R.keys(named.rows), ...R.keys(named.beside)]) delete world.promised[row]
  world.named = [
    ...world.named,
    ...A.map(R.toEntries(named.rows), ([row, value]) => ({ row, value })),
    ...A.flatMap(R.toEntries(named.beside), ([row, values]) => A.map(values, (value) => ({ row, value })))
  ]
}

const elsewhere = DraftEvent.$match({
  Opened: () => false,
  Left: () => false,
  TakenUp: () => true,
  Decided: () => false,
  SaveAnswered: () => true,
  SaveFailed: () => true,
  SaveSignedOut: () => true,
  SaveAgain: () => true,
  SaveRefused: () => false,
  Settled: () => false,
  ViewArrived: () => true,
  MatchStarted: () => false,
  MatchEnded: () => false,
  ConfirmPressed: () => false,
  ConfirmDone: () => false,
  ConfirmMoved: () => true,
  ConfirmFailed: () => true,
  ConfirmStale: () => true,
  LeftOverNamed: () => false
})

const dispatchIn = (world: World, event: DraftEvent): void => {
  const before = world.draft
  const stepped = step(before, event)
  // Whenever what the screen shows changes and the person did not do it, the region is told to start again: its own
  // state would otherwise go on saying what it said. (The first view of a visit starts the region itself.)
  if (
    !DraftEvent.$is("Decided")(event) &&
    before.onScreen &&
    stepped.draft.onScreen &&
    O.isSome(before.held) &&
    O.isSome(stepped.draft.held) &&
    !Eq.equals(shown(before), shown(stepped.draft))
  ) {
    expect(
      A.some(stepped.effects, DraftEffect.$is("Restart")),
      `what the screen shows changed without the person (${Formatter.format(event)}), and the region was not told`
    ).toBe(true)
  }
  // "Updated with what changed on another screen" is said only of another's change: never of a refusal, a close, the
  // person's own pick or confirm, or a draft let go while nobody looked.
  for (const effect of stepped.effects) {
    if (DraftEffect.$is("Restart")(effect) && effect.announce) {
      expect(elsewhere(event) && O.isSome(stepped.draft.held), `${Formatter.format(event)} was said as elsewhere`).toBe(
        true
      )
    }
  }
  expect(stepped.draft.lastId, "an id was used twice").toBeGreaterThanOrEqual(before.lastId)
  // The import was confirmed since the person's picks: what they promised outlived it, and is named or was part of it.
  if (O.exists(before.confirms, (was) => O.exists(stepped.draft.confirms, (now) => now > was))) world.promised = {}
  // The same, however the tab came to know it: a promise is of the opening it was made in, and the import was confirmed
  // since (a reload or a close leaves the draft not knowing the count, so the check above may not see it).
  world.promised = R.filter(world.promised, (promise) => world.server.confirms <= promise.opening)
  // The import closed on her: a refused decision she was told of, on its line until now, was told of by name, and
  // goes with the line (the close does not name it again).
  if (stepped.draft.ended && !before.ended) {
    world.named = [
      ...world.named,
      ...A.map(
        A.filter(world.namings, (one) => one.refusal),
        ({ row, value }) => ({ row, value })
      )
    ]
  }
  world.draft = stepped.draft
  // A pick of a decision of hers is kept once the screen reads the server holding it, with nothing of the row waiting:
  // what anybody decides of the row after that picture is theirs to say.
  for (const [row, promise] of R.toEntries(world.promised)) {
    const waits = A.contains(pending(world.draft), row) || R.has(world.draft.lines, row)
    if (!promise.stays && !waits && isPartOf(promise.value, R.get(shownOfServer(world), row)))
      delete world.promised[row]
  }
  // A line says a row was decided since by somebody else or another tab only where one of them wrote what it says is
  // stored (or that, as a match left it). This tab's own earlier write is never said as theirs.
  for (const [row, line] of R.toEntries(linesShown(world.draft))) {
    const { text } = lineWords({ rowId: row, line, canDecide: true })
    O.map(
      O.filter(line.theirs, () => Str.includes("decided since by someone else")(text)),
      (theirs) =>
        void expect(
          A.some(listOf(world.writes, row), (one) => one.by !== "this tab" && sameDecision(one.value, theirs)),
          `row ${row}: the line says ${Formatter.format(theirs)} was decided since by someone else or another tab, and only this tab wrote it`
        ).toBe(true)
    )
  }
  for (const [row, line] of R.toEntries(world.draft.lines)) {
    // What a line says somebody decided since can be seen.
    O.map(line.theirs, (value) => {
      world.couldSee[row] = [...listOf(world.couldSee, row), value]
    })
  }
  for (const effect of stepped.effects) perform(world, effect)
  // What waits is kept in the browser as it changes, so a reload finds it. (A tab started without its id keeps nothing
  // under it until it knows the id: its entry is the one from before the reload, read in by `TabIdKnown`.)
  if (O.isNone(world.ownLate)) world.kept = waiting(world.draft)
  // A draft with no picture and no word over one, or ended, keeps no word of the server's: the next picture is the first.
  if (world.draft.ended || (O.isNone(world.draft.held) && O.isNone(world.draft.landed))) world.words = {}
}

/** The rows of the person's that wait, or are on their way. */
const pending = (draft: Draft): ReadonlyArray<string> => [
  ...R.keys(draft.unsent),
  ...O.match(draft.flight, { onNone: () => [], onSome: (flight) => R.keys(flight.rows) })
]

/** Every row that waits is no live press from now on. */
const allWaited = (world: World): void => {
  for (const row of pending(world.draft)) world.waited[row] = true
}

/** The person's press of one decision: what they could see then is what it may replace. */
const presses = (world: World, row: string, value: Value, more: ReadonlyArray<Value> = []): void => {
  const own = A.filter(world.pressedOver, (press: World["pressedOver"][number]) => press.row === row)
  // Decided over their own earlier decision: what that one may replace, and itself.
  const saw = [
    ...listOf(world.couldSee, row),
    ...more,
    ...A.flatMap(own, (press: World["pressedOver"][number]) => press.saw),
    ...A.map(own, (p) => p.value)
  ]
  world.pressedOver = [...world.pressedOver, { row, value, saw, over: listOf(world.couldSee, row) }]
  world.made[row] = [...listOf(world.made, row), value]
}

/** Where the person's decisions are now: waiting, on their way, on a line, or left over to be named. */
const placed = (draft: Draft): ReadonlyArray<{ readonly row: string; readonly value: Value }> => {
  const inRows = (rows: Readonly<Record<string, Side>>) =>
    A.map(R.toEntries(rows), ([row, side]) => ({ row, value: side.decision }))
  const leftOver = O.match(draft.leftOver, {
    onNone: () => [],
    onSome: (named) => [
      ...A.map(R.toEntries(named.rows), ([row, value]) => ({ row, value })),
      ...A.flatMap(R.toEntries(named.beside), ([row, values]) => A.map(values, (value) => ({ row, value })))
    ]
  })
  return [
    ...O.match(draft.flight, { onNone: () => [], onSome: (flight) => inRows(flight.rows) }),
    ...inRows(draft.unsent),
    ...A.flatMap(R.toEntries(draft.lines), ([row, line]) =>
      A.map(line.sides, (side) => ({ row, value: side.decision }))
    ),
    ...leftOver
  ]
}

/** The save a command is about: the one at its place among those out, or the first or the last; none where there is none. */
const saveOf = (world: World, which: "first" | "last", at?: number): O.Option<Save> =>
  O.match(O.fromUndefinedOr(at), {
    onNone: () => (which === "first" ? A.head(world.saves) : A.last(world.saves)),
    onSome: (place) => A.get(world.saves, place)
  })

const replaceSave = (world: World, save: Save): void => {
  world.saves = A.map(world.saves, (one) => (one.id === save.id ? save : one))
}
const dropSave = (world: World, save: Save): void => {
  world.saves = A.filter(world.saves, (one) => one.id !== save.id)
}
const isCurrent = (world: World, save: Save): boolean =>
  O.exists(world.draft.flight, (flight) => flight.id === save.id) && world.draft.confirm !== "out"

/**
 * The Review step is drawn again: it reads the view it finds, as the runner gives it (`followDraft` subscribes with
 * the view the tab holds at once).
 */
const comeBack = (world: World): void => {
  dispatchIn(world, DraftEvent.Opened({ kept: O.none() }))
  O.map(world.view, (view) => arrive(world, view, O.isSome(world.read)))
}

/**
 * The person picks on lines: what the others on each say is let go, and what stands is theirs. Each pick is held to
 * what its words say (`World.promised`): what is saved stays after a pick of it, and a decision of hers picked is
 * written, or asked about again.
 */
const settles = (world: World, picks: ReadonlyArray<LinePick>): void => {
  // Lines are drawn over a picture: before one is held, the machine takes no pick.
  if (O.isNone(world.draft.held)) return dispatchIn(world, DraftEvent.Settled({ picks }))
  for (const { keep, rowId } of picks) {
    const line = world.draft.lines[rowId]
    if (line === undefined) continue
    // This tab's decision of the row is on its way: the machine takes no pick of the row until it is answered.
    if (O.exists(world.draft.flight, (flight) => R.has(flight.rows, rowId))) continue
    const on = (value: Value): boolean => A.some(line.sides, (side) => isPartOf(value, side.decision))
    Keep.$match(keep, {
      Theirs: () => {
        world.facts = A.filter(world.facts, (fact) => !(fact.row === rowId && on(fact.value)))
        // Picked over a decision of hers that could be sent, what is saved stays; a refused one dismissed promises
        // nothing of what else of hers waits.
        if (A.some(line.sides, (side) => O.isNone(side.refused))) {
          world.promised[rowId] = { stays: true, value: R.get(shownOfServer(world), rowId), opening: openingOf(world) }
        } else delete world.promised[rowId]
      },
      Side: ({ decision }) => {
        const side = A.findFirst(line.sides, (one) => sameDecision(one.decision, decision))
        if (O.isNone(side)) return
        // The one picked is hers from this tab now, whichever tab made it; the others on the line are let go. A decision
        // is the one picked without its accept only where no other side of the line is that decision itself: beside
        // it, the accept-less remainder is another side, picked over it.
        const picked = (fact: Fact): boolean =>
          isPartOf(fact.value, decision) &&
          !A.some(line.sides, (one) => !sameDecision(one.decision, decision) && sameDecision(one.decision, fact.value))
        // Picked as a decision that can be sent, she made it in this tab now, on the picture it holds: only a write after
        // the pick accounts for it, it is of the opening that picture is in (an equal decision made before a confirm since
        // is picked anew, not sent as of then), and what she was told of the row before is of another decision.
        const at = O.isNone(side.value.refused) ? O.some(made(world, rowId, decision, true)) : O.none<number>()
        world.facts = A.map(
          A.filter(world.facts, (fact) => fact.row !== rowId || !on(fact.value) || picked(fact)),
          (fact) =>
            fact.row === rowId && picked(fact)
              ? {
                  ...fact,
                  here: true,
                  ...O.match(at, { onNone: () => ({}), onSome: (tick) => ({ at: tick, opening: openingOf(world) }) })
                }
              : fact
        )
        // What the line shows the server to hold is what the pick stands over.
        const theirs = [R.get(shownOfServer(world), rowId), ...O.match(line.theirs, { onNone: () => [], onSome: A.of })]
        // A refused decision is never sent by a pick: nothing of hers waits for it.
        if (O.isNone(side.value.refused)) {
          presses(world, rowId, decision, theirs)
          world.waited[rowId] = true
          // Picked as a decision that can be sent (another tab had it, not refused there): no refusal of it stands.
          world.refused = A.filter(world.refused, (one) => !(one.row === rowId && sameDecision(one.value, decision)))
          // Picked as what the screen knows the server holds, it is a pick of what is saved: that stays.
          const isSaved = sameDecision(decision, R.get(shownOfServer(world), rowId))
          world.promised[rowId] = { stays: isSaved, value: decision, opening: openingOf(world) }
        } else delete world.promised[rowId]
      }
    })
    delete world.confirmed[rowId]
  }
  dispatchIn(world, DraftEvent.Settled({ picks }))
}

/** What the draft knows the server to hold. */
const shownOfServer = (world: World): SavedDecisions =>
  over(
    O.match(world.draft.held, { onNone: (): SavedDecisions => ({}), onSome: (held) => held.decisions }),
    O.match(world.draft.landed, { onNone: (): RowChanges => ({}), onSome: (landed) => landed.rows })
  )

/**
 * The press a command names on one line, of those the line offers as the screen draws it (an editor's): the first, the
 * second, or the last (`theirs`). None where the line offers no such press.
 */
const pickOn = (world: World, row: string, which: "theirs" | "first" | "second"): ReadonlyArray<LinePick> =>
  O.match(R.get(linesShown(world.draft), row), {
    onNone: () => [],
    onSome: (line) => {
      const { actions } = lineWords({ rowId: row, line, canDecide: true })
      const action = which === "theirs" ? A.last(actions) : A.get(actions, which === "first" ? 0 : 1)
      return O.match(action, { onNone: () => [], onSome: (one) => [{ rowId: row, keep: one.keep }] })
    }
  })

/**
 * The presses that settle many lines at once, as the screen offers them: of each kind of line, the first such press or
 * the last; a line of a kind with none of them is settled by its own press of the same place.
 */
const pickOnAll = (world: World, which: "theirs" | "first"): ReadonlyArray<LinePick> =>
  A.flatMap(lineGroups({ lines: linesShown(world.draft), canDecide: true }), (group) =>
    O.match(which === "theirs" ? A.last(group.all) : A.head(group.all), {
      onSome: (all) => all.picks,
      onNone: () => A.flatMap(group.lines, (line) => pickOn(world, line.rowId, which))
    })
  )

const runIn = (world: World, command: Command): void => {
  if (world.removed) return
  Command.match(command, {
    PressConfirm: () => {
      if (world.draft.onScreen && O.isSome(world.draft.held)) dispatchIn(world, DraftEvent.ConfirmPressed())
    },
    ServerTakesConfirm: () =>
      void O.map(world.confirm, (confirm) => {
        if (O.isSome(confirm.answer) || !world.server.open) return
        // Made on another revision than the draft is at: the server writes nothing.
        if (confirm.revision !== world.server.revision) {
          world.confirm = O.some({ ...confirm, answer: O.some("moved") })
          return
        }
        const rows = rowsOf(confirm.delta)
        if (R.some(rows, (value, row) => hasAccept(value) && (confirm.madeOn[row] ?? 0) < world.server.matchedAt)) {
          world.confirm = O.some({ ...confirm, answer: O.some("stale") })
          return
        }
        for (const [row, value] of R.toEntries(rows)) {
          replaces(world, { row, value, named: O.none(), isLive: A.contains(confirm.live, row) })
          keeps(world, row, value)
          // Written by her confirm where it changes what is stored: a write of hers like a save's, so that a word that
          // says it was not sent is checked against it.
          if (!Eq.equals(R.get(world.server.decisions, row), value)) {
            stores(world, row, value, "this tab")
            writtenByHer(world, row, value)
          } else heldByHer(world, row, value)
        }
        const written = over(world.server.decisions, rows)
        // The rule: what a confirm writes is what its screen showed. No decision it had not shown, none missing.
        expect(written, "a confirm wrote another thing than its screen showed").toEqual(confirm.shown)
        moves(world, { decisions: written, open: false, confirms: world.server.confirms + 1 })
        world.confirm = O.some({ ...confirm, answer: O.some("made") })
      }),
    ConfirmAnswers: () =>
      void O.map(world.confirm, (confirm) => {
        if (O.isNone(confirm.answer)) return
        world.confirm = O.none()
        const { id } = confirm
        if (confirm.answer.value === "made") {
          // The answer is the closed import, put into the tab's view first, as the runner does (`putConfirmed`).
          world.confirmed = {}
          world.region = O.none()
          const made = world.history[confirm.revision + 1]!
          if (!O.exists(world.view, (view) => view.revision > made.revision)) world.view = O.some(made)
          world.told = Math.max(world.told, made.revision)
          dispatchIn(world, DraftEvent.ConfirmDone({ id, revision: made.revision, decisions: made.decisions }))
          return
        }
        const accepts = A.map(
          A.filter(
            R.toEntries(rowsOf(confirm.delta)),
            ([row, value]) => hasAccept(value) && (confirm.madeOn[row] ?? 0) < world.server.matchedAt
          ),
          ([row]) => ({ rowId: row, field: "unitCost", kind: "accept" as const })
        )
        // Nothing was written: the rows wait.
        allWaited(world)
        dispatchIn(
          world,
          confirm.answer.value === "moved" ? DraftEvent.ConfirmMoved({ id }) : DraftEvent.ConfirmStale({ id, accepts })
        )
      }),
    // Lost on its way to the server (nothing was written), or its answer lost on the way back (made, or refused):
    // either way the screen does not know what was written.
    ConfirmFails: () =>
      void O.map(world.confirm, ({ id }) => {
        world.confirm = O.none()
        allWaited(world)
        dispatchIn(world, DraftEvent.ConfirmFailed({ id }))
      }),
    Decide: ({ row, to }) => {
      if (!world.draft.onScreen || O.isNone(world.draft.held)) return
      // The person acts on what the region shows, and what is sent is what that action changed there.
      const before = regionShows(world)
      const after = over(before, change(row, to))
      if (Eq.equals(after, before)) return
      const value = valueOf(to)
      // A press that leaves an undecided row undecided is no decision: the machine answers it with no change (nothing
      // sent, nothing named), and it is no decision of hers to account for.
      if (sameDecision(R.get(before, row), O.none()) && sameDecision(value, O.none())) {
        const event = DraftEvent.Decided({ changes: change(row, to) })
        expect(
          A.filter(
            step(world.draft, event).effects,
            (effect) => DraftEffect.$is("Send")(effect) || DraftEffect.$is("Say")(effect)
          ),
          `a press that leaves row ${row} undecided sent or said something`
        ).toEqual([])
        return dispatchIn(world, event)
      }
      const showed = R.get(before, row)
      const wasPending = A.contains(pending(world.draft), row)
      // A save from before a confirm that still owes the row: its decision is replaced by this one, as one waiting is.
      const strayOwes = A.some(R.values(world.draft.strays), (stray) => A.contains(stray.owed, row))
      const own = A.filter(world.draft.lines[row]?.sides ?? [], (side) => side.here)
      // Their earlier decision of the row, shown on the screen or this tab's on its line, is replaced by this one.
      world.facts = A.filter(
        world.facts,
        (fact) =>
          fact.row !== row ||
          !(
            (wasPending && isPartOf(fact.value, showed)) ||
            // A closed tab's decision equal to this tab's is one with it (read once, sent once): replaced with it.
            A.some(own, (side) => isPartOf(fact.value, side.decision)) ||
            (fact.here && (wasPending || strayOwes))
          )
      )
      // A closed tab's decision the server refused is settled by deciding the row again (Benjamin, 2026-11-21: "until
      // the person decides the row again or dismisses the line").
      world.facts = A.filter(
        world.facts,
        (fact) =>
          fact.row !== row ||
          fact.here ||
          !A.some(world.refused, (one) => one.row === row && sameDecision(one.value, fact.value))
      )
      const at = made(world, row, value, true)
      world.facts = [...world.facts, { row, value, here: true, opening: openingOf(world), at }]
      // Decided again: what she was told of the row before, and what an equal value of somebody else's showed of an
      // earlier decision of hers, is replaced by this one.
      world.toldNotSent = A.filter(world.toldNotSent, (one) => one.row !== row)
      world.covered = A.filter(world.covered, (one) => one.row !== row)
      world.refused = A.filter(world.refused, (one) => !(one.row === row && isPartOf(value, one.value)))
      delete world.confirmed[row]
      delete world.promised[row]
      // The decision it rests on counts as seen.
      presses(world, row, value, [showed])
      // What the screen knows is behind (an answer said so) makes it no live press.
      if (!wasPending) world.waited[row] = O.isSome(world.draft.landed)
      world.region = O.some(after)
      dispatchIn(world, DraftEvent.Decided({ changes: change(row, to) }))
      // Decided back to what the screen knew before anything of it was sent: an undo, not a decision of its own.
      const is = (fact: { readonly row: string; readonly value: Value }) =>
        fact.row === row && sameDecision(fact.value, value)
      if (!A.some(placed(world.draft), is) && Eq.equals(R.get(shownOfServer(world), row), value)) {
        world.facts = A.filter(world.facts, (fact) => !(is(fact) && fact.here))
        world.waited[row] = false
      }
    },
    SomeoneElse: ({ row, to }) => {
      if (!world.server.open) return
      const decisions = over(world.server.decisions, change(row, to))
      if (Eq.equals(decisions, world.server.decisions)) return
      stores(world, row, valueOf(to), "somebody else")
      moves(world, { decisions })
    },
    Match: () => {
      if (!world.server.open) return
      const rows = A.filter(R.keys(world.server.decisions), (row) => hasAccept(R.get(world.server.decisions, row)))
      const decisions: Record<string, SavedDecisions[string]> = { ...world.server.decisions }
      for (const row of rows) {
        const was = R.get(world.server.decisions, row)
        const left = withoutAccept(was)
        world.before[row] = [...listOf(world.before, row), was]
        // What a match left of a decision is still its writer's.
        const by = O.getOrElse(
          O.map(A.last(listOf(world.writes, row)), (one) => one.by),
          (): Writer => "somebody else"
        )
        world.writes[row] = [...listOf(world.writes, row), { value: left, by }]
        // What a match leaves of a value she wrote is still hers: the server holds it by her save.
        if (by !== "somebody else") heldByHer(world, row, left)
        delete world.confirmed[row]
        if (O.isSome(left)) decisions[row] = left.value
      }
      const revision = world.server.revision + 1
      moves(world, {
        decisions,
        matchedAt: revision,
        takenBack: rows.length === 0 ? world.server.takenBack : [...world.server.takenBack, { revision, rows }]
      })
    },
    // Somebody else confirms the import as the server holds it: it is closed, one revision on.
    SomeoneConfirms: () => {
      if (!world.server.open) return
      moves(world, { open: false, confirms: world.server.confirms + 1 })
    },
    // Opened again to review again: the decisions are as they were.
    SomeoneReopens: () => {
      if (!world.server.open) moves(world, { open: true })
    },
    ClosedAround: ({ then }) => {
      if (!world.server.open) return
      counts(world, "closed and opened again around a save that is out")
      // The save it is about: the last that is out and not taken yet.
      const at = A.findLastIndex(world.saves, (save) => O.isNone(save.answer))
      const C = Command.cases
      for (const command of [
        C.SomeoneConfirms.make({}),
        C.ReturnToTab.make({}),
        C.ServerTakesRead.make({}),
        C.ReadArrives.make({}),
        C.SomeoneReopens.make({}),
        ...O.match(at, {
          onNone: () => [],
          onSome: (at) => [
            ...(then === "nothing" ? [] : [C.ServerTakesSave.make({ which: "first", at })]),
            ...(then === "answered" ? [C.SaveAnswers.make({ which: "first", at })] : [])
          ]
        })
      ])
        runIn(world, command)
    },
    // Opened again, a row decided, and confirmed again in one go: no read of this tab's comes between.
    ReopenDecideConfirm: ({ row, to }) => {
      if (world.server.open) return
      counts(world, "confirmed again after a reopen with no read between")
      moves(world, { open: true })
      const decisions = over(world.server.decisions, change(row, to))
      if (!Eq.equals(decisions, world.server.decisions)) {
        stores(world, row, valueOf(to), "somebody else")
        moves(world, { decisions })
      }
      moves(world, { open: false, confirms: world.server.confirms + 1 })
    },
    // The page is loaded again. What was on its way to the old page never arrives, and a request the server had not
    // taken is lost; what the browser kept is all the new page has of the person's.
    Reload: ({ idLate }) => {
      if (world.draft.ended) counts(world, "reload between a closed picture and the next")
      // A save from before the close still out owed rows the closed picture shows as she decided them: the reload loses
      // that save, and the close covers them, as if judged when it was drawn (what it said is forgotten, F3).
      if (world.draft.ended) {
        const { endedOn, strays } = world.draft
        const owedShown = (fact: Fact): boolean =>
          isPartOf(fact.value, R.get(endedOn, fact.row)) &&
          A.some(
            R.values(strays),
            (stray) =>
              A.contains(stray.owed, fact.row) &&
              O.exists(R.get(stray.rows, fact.row), (side) => isPartOf(fact.value, side.decision))
          )
        for (const fact of world.facts) {
          if (owedShown(fact))
            world.covered.push({
              row: fact.row,
              value: fact.value,
              shownIn: "closed",
              reloaded: false,
              opening: fact.opening,
              ...(fact.ahead === true ? { ahead: true } : {}),
              ...atField(fact)
            })
        }
        world.facts = A.filter(world.facts, (fact) => !owedShown(fact))
      }
      // The person knew what she was shown before the reload: what a picture showed of a decision of hers let go is
      // judged on the next one (`Covered.reloaded`).
      world.covered = A.map(world.covered, (one) => ({ ...one, reloaded: true }))
      world.saves = []
      world.confirm = O.none()
      world.read = O.none()
      world.late = []
      world.view = O.none()
      world.region = O.none()
      world.told = 0
      allWaited(world)
      for (const row of R.keys(world.draft.lines)) world.waited[row] = true
      // Written as the browser keeps it and read back: every side of every line, and what each may be written over.
      const back = keptForm(world.kept)
      expect(back, "what the browser keeps is not what comes back after a reload").toEqual(world.kept)
      world.draft = emptyDraft
      world.words = {}
      if (idLate === true) {
        // The step opens before the tab knows its id: nothing of its own is read yet.
        world.ownLate = back
        dispatchIn(world, DraftEvent.Opened({ kept: O.none() }))
      } else dispatchIn(world, DraftEvent.Opened({ kept: back }))
      world.read = O.some(O.none())
    },
    // The tab knows its id now: its own entry is taken up into the draft as it stands, as the runner does.
    TabIdKnown: () =>
      void O.map(world.ownLate, (kept) => {
        world.ownLate = O.none()
        counts(world, "own entry taken up with here")
        const named = decisionsIn(kept)
        world.lateRead = [
          ...world.lateRead,
          ...A.map(R.toEntries(named.rows), ([row, value]) => ({ row, value })),
          ...A.flatMap(R.toEntries(named.beside), ([row, values]) => A.map(values, (value) => ({ row, value })))
        ]
        dispatchIn(world, DraftEvent.TakenUp({ kept, here: true }))
      }),
    ServerTakesSave: ({ at, which }) =>
      void O.map(saveOf(world, which ?? "last", at), (save) => {
        // A closed import takes no save: it refuses it (`SaveRefused`). Nor does one confirmed since the picture the
        // save was decided over, though it is open again: a save is taken only in the opening it says it was made in,
        // and refused, with nothing written, in any other.
        if (O.isSome(save.answer) || save.refused || !world.server.open) return
        if (world.server.confirms !== save.opening) {
          // Refused as made in another opening: none of what it carries was made in the one the import is in.
          for (const [row, value] of R.toEntries(rowsOf(save.delta))) {
            const ofTabs = A.filter(world.facts, (fact) => fact.row === row && sameDecision(fact.value, value))
            // A closed tab's made in an opening newer than the save says: the entry's newer opening was not kept (the
            // tab read an older picture after it), which is that fault, not this one.
            const newer = (fact: Fact): boolean =>
              fact.ahead === true || (fact.fromTab === true && fact.opening > save.opening)
            if (world.blind.newerEntry === true && A.some(ofTabs, newer)) continue
            expect(
              allIn(openingsOf(world, row, value, save.sentAt), (opening) => opening === world.server.confirms),
              broke(
                "newerEntry",
                `row ${row}: ${Formatter.format(value)}, decided in the opening the import is in, is sent as of an earlier one`
              )
            ).toBe(false)
          }
          counts(world, "refused as decided before a confirm")
          replaceSave(world, { ...save, refused: true })
          return
        }
        // Written into the opening the import is in: none of it was decided only before a confirm since.
        for (const [row, value] of R.toEntries(rowsOf(save.delta))) {
          expect(
            allIn(openingsOf(world, row, value, save.sentAt), (opening) => opening < world.server.confirms),
            `row ${row}: ${Formatter.format(value)}, decided before the import was confirmed, is written into it opened again`
          ).toBe(false)
        }
        replaceSave(world, { ...save, answer: takes(world, save) })
      }),
    SaveAnswers: ({ at, which }) =>
      void O.map(saveOf(world, which ?? "last", at), (save) => {
        if (save.refused) return refuses(world, save)
        if (O.isNone(save.answer)) return
        const answer = save.answer.value
        const current = isCurrent(world, save)
        dropSave(world, save)
        world.told = Math.max(world.told, current ? answer.revision : 0)
        if (current) {
          const since = A.map(answer.decidedSince, (one) => one.rowId)
          // Somebody saved in between: what waits behind it is no live press any more.
          if (
            !answer.changed ||
            !O.exists(world.draft.held, (held) => held.revision + 1 === answer.revision) ||
            O.isSome(world.draft.landed)
          ) {
            if (!O.exists(world.draft.held, (held) => answer.revision <= held.revision)) allWaited(world)
          }
          for (const row of since) world.waited[row] = true
          for (const [row, value] of R.toEntries(rowsOf(save.delta))) {
            const taken = A.some(answer.notApplied, (one) => one.rowId === row)
            const stored = taken ? withoutAccept(value) : value
            const same = sameDecision(R.get(world.server.decisions, row), stored)
            if (!A.contains(since, row) && latestIs(world, row, value) && same && world.byElse[row] !== true) {
              world.confirmed[row] = R.get(world.server.decisions, row)
            }
          }
        }
        // Answered after the import was closed and opened again since it was sent, or neither first nor last.
        if (world.server.confirms > save.opening && world.server.open)
          counts(world, "answered after a close and a reopen")
        if (O.exists(O.fromUndefinedOr(at), (place) => place > 0 && place < world.saves.length))
          counts(world, "answered neither first nor last")
        // What the answer tells the draft the server held of each row it carried, at its revision.
        const words = A.map(R.toEntries(rowsOf(save.delta)), ([row, value]) => {
          const theirs = A.findFirst(answer.decidedSince, (one) => one.rowId === row)
          const taken = A.some(answer.notApplied, (one) => one.rowId === row)
          return [
            row,
            O.getOrElse(
              O.map(theirs, (one) => one.theirs),
              () => (taken ? withoutAccept(value) : value)
            )
          ] as const
        })
        dispatchIn(world, DraftEvent.SaveAnswered({ id: save.id, ...answer }))
        for (const [row, value] of words) hears(world, row, { at: answer.revision, value, from: "answer" })
      }),
    SaveFails: ({ at, which }) =>
      void O.map(saveOf(world, which ?? "last", at), (save) => {
        if (isCurrent(world, save)) allWaited(world)
        dropSave(world, save)
        dispatchIn(world, DraftEvent.SaveFailed({ id: save.id }))
      }),
    SaveSignedOut: ({ at, which }) =>
      void O.map(saveOf(world, which ?? "last", at), (save) => {
        if (O.isSome(save.answer)) return
        if (isCurrent(world, save)) allWaited(world)
        dropSave(world, save)
        dispatchIn(world, DraftEvent.SaveSignedOut({ id: save.id }))
      }),
    SaveRefused: ({ at, which }) =>
      void O.map(saveOf(world, which ?? "last", at), (save) => {
        if (O.isSome(save.answer)) return
        refuses(world, save)
      }),
    SaveAgain: () => dispatchIn(world, DraftEvent.SaveAgain()),
    // The tab asks for the import again, and gives the view it holds again meanwhile, as waiting.
    ReturnToTab: () => {
      if (!world.draft.onScreen) return
      world.read = O.some(O.none())
      O.map(world.view, (view) => arrive(world, view, true))
    },
    ServerTakesRead: () => {
      if (O.exists(world.read, O.isNone)) world.read = O.some(O.some(world.server))
    },
    ReadArrives: () =>
      void O.map(O.flatten(world.read), (view) => {
        world.read = O.none()
        put(world, view)
      }),
    OtherAnswerSent: () => {
      world.late.push(world.server)
    },
    OtherAnswerArrives: () => {
      const view = world.late.shift()
      if (view !== undefined) put(world, view)
    },
    Leave: () => {
      if (world.draft.onScreen) dispatchIn(world, DraftEvent.Left())
    },
    ComeBack: () => {
      if (world.draft.onScreen) return
      // Back after the idle time: the region's own state was let go.
      world.region = O.none()
      comeBack(world)
    },
    // Back within the idle time: the region's own state is still there.
    ComeBackQuickly: () => {
      if (!world.draft.onScreen) comeBack(world)
    },
    TakeUp: ({ as, beside, row, to }) => {
      if (!world.draft.onScreen) return
      // The closed tab decided the row on a state the server was in, over what it held then.
      const madeOn = Math.max(1, world.server.revision - 1)
      const then = world.history[madeOn]!
      const base = R.get(then.decisions, row)
      const value = valueOf(to)
      const side = (decision: Value, parts: Partial<Side> = {}): Side => ({
        decision,
        madeOn,
        dates: {},
        seen: [base],
        live: false,
        here: true,
        overtaken: false,
        refused: O.none(),
        ...parts
      })
      const refused = O.some("Your role was changed.")
      const other = valueOf(to === "out" ? "kept" : "out")
      const startedAt = world.ticks
      const add = (one: Value): void => {
        // Made in the opening of the picture the closed tab decided on, as its entry says (`confirms`).
        world.facts = [
          ...world.facts,
          {
            row,
            value: one,
            here: false,
            opening: then.confirms,
            ...(then.confirms > O.getOrElse(world.draft.confirms, () => 0) ? { ahead: true } : {}),
            at: world.ticks + 1,
            fromTab: true
          }
        ]
        void made(world, row, one, false)
        world.made[row] = [...listOf(world.made, row), one]
        world.pressedOver = [...world.pressedOver, { row, value: one, saw: [base, one], over: [base] }]
      }
      if (sameDecision(base, value)) return
      // Decided in another tab: what she was told of the row in this one does not hold that decision back.
      world.toldNotSent = A.filter(world.toldNotSent, (one) => one.row !== row)
      const landed = as === "landed" && world.server.open && Eq.equals(R.get(world.server.decisions, row), base)
      // Made before its save was written: the write that landed is of this making.
      add(value)
      if (landed) {
        // Its last save reached the server, and its answer was lost with the tab.
        stores(world, row, value, "another tab")
        writtenByHer(world, row, value)
        world.sentByHer[row] = [...listOf(world.sentByHer, row), value]
        delete world.confirmed[row]
        moves(world, { decisions: over(world.server.decisions, { [row]: value }) })
      }
      const own = side(value, {
        ...(landed ? { seen: [base, value] } : {}),
        ...(as === "refused" ? { refused } : {})
      })
      const sides =
        beside === "no" || sameDecision(other, value)
          ? []
          : [side(other, { here: false, ...(beside === "refused" ? { refused } : {}) })]
      for (const one of sides) add(one.decision)
      for (const one of [own, ...sides]) {
        // Made again in that tab and not refused there, it is no refused decision any more.
        world.refused = O.isSome(one.refused)
          ? [...world.refused, { row, value: one.decision }]
          : A.filter(world.refused, (was) => !(was.row === row && sameDecision(was.value, one.decision)))
      }
      const onLine = as === "refused" ? [own, ...sides] : beside === "another" ? [own, ...sides] : sides
      const entry: Waiting = {
        rows: A.contains(onLine, own) ? {} : { [row]: own },
        lines: onLine.length === 0 ? {} : { [row]: { sides: onLine, theirs: O.none() } },
        confirms: O.some(then.confirms),
        leftOver: O.none()
      }
      const before = world.draft
      // Decided the same in this tab, refused in the other: this tab's own stands, and may be sent. Only this tab's own
      // decision as it stands now: one on its way that she has decided again since is not what stands.
      const onItsWay = R.has(before.unsent, row)
        ? O.none()
        : O.flatMap(before.flight, (flight) => R.get(flight.rows, row))
      const isOwn = (one: { readonly row: string; readonly value: Value }): boolean =>
        one.row === row &&
        A.some(
          [
            ...A.fromOption(onItsWay),
            ...A.fromOption(R.get(before.unsent, row)),
            ...A.filter(before.lines[row]?.sides ?? [], (one) => one.here && O.isNone(one.refused)),
            // This tab's own from before a reload, not read in yet: it is this tab's too, and is read in as such.
            ...O.match(world.ownLate, {
              onNone: () => [],
              onSome: (late) => [
                ...A.fromOption(R.get(late.rows, row)),
                ...A.filter(late.lines[row]?.sides ?? [], (one) => one.here && O.isNone(one.refused))
              ]
            })
          ],
          (mine) => sameDecision(mine.decision, one.value)
        )
      world.refused = A.filter(world.refused, (one) => !isOwn(one))
      // A closed tab's decision equal to this tab's own is one with it (as on a press): this tab's own accounts for it.
      // Only where both were made in the same opening: one the closed tab made in a newer opening is a making of that
      // opening, and may be written into it.
      const sameMaking = (fact: Fact): boolean =>
        A.some(
          world.facts,
          (mine) =>
            O.exists(atOf(mine), (at) => at <= startedAt) &&
            mine.row === fact.row &&
            sameDecision(mine.value, fact.value) &&
            mine.opening === fact.opening
        )
      world.facts = A.filter(
        world.facts,
        (fact) => !(!fact.here && O.exists(atOf(fact), (at) => at > startedAt) && isOwn(fact) && sameMaking(fact))
      )
      dispatchIn(world, DraftEvent.TakenUp({ kept: O.some(entry).pipe(keptForm, O.getOrThrow) }))
      // What it added to the row waited: it is sent over what it names, never as a live press.
      // (A refused one beside is a notice: this tab's own press is as it was.)
      const ofRow = (draft: Draft) => [
        R.get(draft.unsent, row),
        O.flatMap(draft.flight, (flight) => R.get(flight.rows, row)),
        A.filter(draft.lines[row]?.sides ?? [], (side) => O.isNone(side.refused))
      ]
      if (!Eq.equals(ofRow(before), ofRow(world.draft))) {
        world.waited[row] = true
        // The person decided the row again, in that tab: what the server took of it before is not what stands.
        delete world.confirmed[row]
        delete world.promised[row]
      }
    },
    Settle: ({ row, which }) => settles(world, pickOn(world, row, which)),
    SettleAll: ({ which }) => settles(world, pickOnAll(world, which)),
    Removed: () => {
      O.map(world.kept, (entry) => names(world, decisionsIn(entry)))
      world.removed = true
    }
  })
}

/** The server's refusal of a save reaches the draft: nothing of it was written. */
const refuses = (world: World, save: Save): void => {
  for (const [row, value] of R.toEntries(rowsOf(save.delta))) {
    world.toldRefused[row] = [...listOf(world.toldRefused, row), value]
  }
  if (isCurrent(world, save)) {
    allWaited(world)
    for (const [row, value] of R.toEntries(rowsOf(save.delta))) {
      if (latestHere(world, row, value)) {
        world.refused = [...world.refused, { row, value }]
        // The refusal of the save the draft still waits for names it: she is told her last decision was not saved, and
        // the row is on its line. One the draft no longer waits for (out across a close) is named as such, if at all.
        if (O.exists(world.draft.flight, (flight) => flight.id === save.id)) namedOnce(world, row, value, true)
      }
    }
  }
  dropSave(world, save)
  dispatchIn(world, DraftEvent.SaveRefused({ id: save.id, reason: "The import was already imported." }))
}

/** True when the person's latest decision of a row is the one sent: nothing was decided of it since. */
const latestIs = (world: World, row: string, value: Value): boolean =>
  !R.has(world.draft.unsent, row) &&
  !A.some(world.draft.lines[row]?.sides ?? [], (side) => O.isNone(side.refused)) &&
  O.exists(world.draft.flight, (flight) => R.has(flight.rows, row)) &&
  A.some(listOf(world.made, row), (made) => isPartOf(made, value))

/**
 * True when the decision of a row this tab sent is the latest of this tab's: nothing was decided of it here since (a
 * closed tab's decision beside it on its line is not this tab's).
 */
const latestHere = (world: World, row: string, value: Value): boolean =>
  !R.has(world.draft.unsent, row) &&
  !A.some(world.draft.lines[row]?.sides ?? [], (side) => side.here && O.isNone(side.refused)) &&
  O.exists(world.draft.flight, (flight) => R.has(flight.rows, row)) &&
  A.some(listOf(world.made, row), (made) => isPartOf(made, value))

/** Nothing is on its way between the screen and the server, and nothing of the person's waits to be sent. */
const still = (world: World): boolean =>
  O.isNone(world.ownLate) &&
  world.saves.length === 0 &&
  O.isNone(world.read) &&
  O.isNone(world.confirm) &&
  world.late.length === 0 &&
  O.isNone(world.draft.flight) &&
  R.isEmptyReadonlyRecord(world.draft.unsent)

/**
 * True once this tab's view says the import is closed, and nothing the draft was told since says it was opened again
 * (a save's answer of a later revision: the read it asks for brings the newer view).
 */
const toldClosed = (world: World): boolean =>
  O.exists(
    world.view,
    (view) =>
      !view.open && view.revision >= O.match(world.draft.landed, { onNone: () => 0, onSome: (landed) => landed.at })
  )

/**
 * What the person is shown of the import, or will be when she looks: the result of the import closed, or the picture
 * held with her own decisions over it. None while nothing is held: the next picture says.
 */
const picturedNow = (
  world: World
): O.Option<{
  readonly decisions: SavedDecisions
  readonly known: SavedDecisions
  readonly held: SavedDecisions
  readonly closed: boolean
}> =>
  world.draft.ended
    ? O.some({ decisions: world.draft.endedOn, known: world.draft.endedOn, held: world.draft.endedOn, closed: true })
    : O.match(world.draft.held, {
        onNone: () => O.none(),
        onSome: (held) =>
          O.some({ decisions: shown(world.draft), known: shownOfServer(world), held: held.decisions, closed: false })
      })

/**
 * The main rule, in her words: every decision she made is still hers somewhere. It is accounted for when
 * (a) the server holds or held it written by a save or a confirm of hers (this tab's, or a closed tab's);
 * (b) it stands now: waiting, on its way, a side of a line (a refused one too: "Keep them, say why", Benjamin,
 *     2026-11-20), left over for the result to name, or kept in the browser to be read in;
 * (c) she was told of it by name (outlived a confirm, the import removed); a line she dismissed, she let go herself;
 * (d) she replaced it herself, by deciding the row again (`Decide`).
 * Nothing else. The server once holding an equal value is not enough when somebody else wrote it: `over` names values,
 * not writers, so the draft cannot tell the two apart, and it may let hers go for it. A colleague's equal value accounts
 * for hers only while she is shown it as what the server holds of the import open: then what she sees is what she
 * decided, and what anybody decides of the row after is theirs to say. Shown it in a closed picture (somebody's confirm
 * took the value, not hers), it holds only until she is shown the import opened again holding it: the reopened import
 * saying otherwise names it ("Name the rows, then drop them", Benjamin, 2026-11-20; `saidByClose` in the machine). Once
 * she is shown another value of the row, the server holding it too, with nothing said of hers, it was dropped.
 */
const accountsFor = (world: World): void => {
  const { draft } = world
  const late = O.match(world.ownLate, {
    onNone: () => [],
    onSome: (kept) => {
      const named = decisionsIn(kept)
      return [
        ...A.map(R.toEntries(named.rows), ([row, value]) => ({ row, value })),
        ...A.flatMap(R.toEntries(named.beside), ([row, values]) => A.map(values, (value) => ({ row, value })))
      ]
    }
  })
  // A save from before a close that is still out carries what it owes: on its way until its answer is read, as the
  // machine waits for that answer before it names the row (taken before the confirm, it was part of it; refused or
  // lost, it is named then). A decision covered by a closed picture stays covered while such a save owes it too.
  const strayOwed = A.flatMap(R.values(draft.strays), (stray) =>
    A.flatMap(stray.owed, (row) =>
      A.fromOption(O.map(R.get(stray.rows, row), (side) => ({ row, value: side.decision })))
    )
  )
  const stand = [...placed(draft), ...late, ...strayOwed]
  type One = { readonly row: string; readonly value: Value }
  const has = (all: ReadonlyArray<One>, one: One): boolean =>
    A.some(all, (other) => other.row === one.row && isPartOf(one.value, other.value))
  // Written of hers after she last made it: what she made again since is not accounted for by an older write.
  const hers = (one: One & { readonly at?: number }): boolean => {
    const made = O.getOrElse(atOf(one), () =>
      A.reduce(world.madeAt, 0, (at, it) =>
        it.row === one.row && sameDecision(it.value, one.value) ? Math.max(at, it.at) : at
      )
    )
    return A.some(listOf(world.byHer, one.row), (held) => held.at > made && isPartOf(one.value, held.value))
  }
  const pictured = picturedNow(world)
  const serverHolds = (one: One): boolean => isPartOf(one.value, R.get(world.server.decisions, one.row))
  const shows = (one: One, picture: { readonly decisions: SavedDecisions }): boolean =>
    isPartOf(one.value, R.get(picture.decisions, one.row))
  const dropped = (one: One, named: O.Option<keyof Blind>, shownAs: Value): void => {
    // With her own entry read in late, or still to be read in, it is that entry's doing.
    const late = A.isReadonlyArrayNonEmpty(world.lateRead) || O.isSome(world.ownLate)
    const fault = O.isNone(named) && late ? O.some<keyof Blind>("lateOwnEntry") : named
    if (O.exists(fault, (it) => it === "lateOwnEntry" && world.blind.lateOwnEntry === true)) return
    const words = `${Formatter.format(one)} was let go without a word: it is not on the server as hers, waiting, on a line or named, and she is shown ${Formatter.format(shownAs)}`
    expect(false, O.match(fault, { onNone: () => words, onSome: (it) => broke(it, words) })).toBe(true)
  }
  // Each decision of hers let go since the last step: accounted for, covered by a colleague's equal value she is
  // shown, or dropped.
  const facts: Array<Fact> = []
  for (const fact of world.facts) {
    if (has(stand, fact) || has(world.named, fact) || hers(fact)) {
      facts.push(fact)
      continue
    }
    O.match(pictured, {
      // Nothing is shown: the next picture says.
      onNone: () =>
        void world.covered.push({
          row: fact.row,
          value: fact.value,
          shownIn: "nothing",
          reloaded: false,
          opening: fact.opening,
          ...(fact.ahead === true ? { ahead: true } : {}),
          ...atField(fact)
        }),
      onSome: (picture) => {
        if (!shows(fact, picture)) {
          // Let go as held, made before a confirm since: the import opened again holds an equal value (as the picture
          // says, or what the draft knows since), and another is shown over it.
          const asHeld =
            isPartOf(fact.value, R.get(picture.known, fact.row)) || isPartOf(fact.value, R.get(picture.held, fact.row))
          const fault =
            fact.ahead === true
              ? O.some<keyof Blind>("newerEntry")
              : asHeld && confirmedSince(world, fact)
                ? O.some<keyof Blind>("equalAfterConfirm")
                : O.none()
          if (O.exists(fault, (it) => world.blind[it] === true)) return
          return dropped(fact, fault, R.get(picture.decisions, fact.row))
        }
        // Let go as held on the import opened again, made before a confirm since, though every save of hers that carried it
        // was refused and the tab was told so: the equal value is somebody else's, and the screen knows it is not hers.
        if (!picture.closed && serverHolds(fact) && confirmedSince(world, fact) && noneOfHersWritten(world, fact)) {
          // Only where she decided it over a row with nothing decided on it: over somebody's decision, the screen counts
          // what a match may leave of that one, or that one itself where it equals hers, as what the server may hold of
          // hers, and cannot tell the two apart.
          const writtenAsHers = (value: Value): boolean =>
            A.some(world.herWrites, (one) => one.row === fact.row && sameDecision(one.value, value))
          const overAnother = A.some(
            world.pressedOver,
            (press) =>
              press.row === fact.row &&
              isPartOf(press.value, fact.value) &&
              (A.some(press.saw, (saw) => !sameDecision(saw, O.none()) && !isPartOf(press.value, saw)) ||
                A.some(press.over ?? [], (held) => !sameDecision(held, O.none()) && !writtenAsHers(held)))
          )
          const fault =
            fact.ahead === true
              ? O.some<keyof Blind>("newerEntry")
              : overAnother
                ? O.some<keyof Blind>("equalAfterConfirm")
                : O.none()
          if (O.exists(fault, (it) => world.blind[it] === true)) return
          return dropped(fact, fault, R.get(picture.decisions, fact.row))
        }
        if (picture.closed || !serverHolds(fact)) {
          world.covered.push({
            row: fact.row,
            value: fact.value,
            shownIn: picture.closed ? "closed" : confirmedSince(world, fact) ? "reopened" : "open",
            reloaded: false,
            opening: fact.opening,
            ...(fact.ahead === true ? { ahead: true } : {}),
            ...atField(fact),
            ...(picture.closed
              ? {}
              : O.match(world.draft.held, { onNone: () => ({}), onSome: (held) => ({ shownAt: held.revision }) }))
          })
        }
      }
    })
  }
  // What was named has been: it is not expected anywhere else any more.
  world.facts = A.filter(facts, (fact) => !has(world.named, fact))
  // Each covered decision, against what she is shown now.
  const still: Array<Covered> = []
  for (const one of world.covered) {
    if (has(world.named, one) || hers(one)) continue
    // Back where it stands (a stray's answer drew it on a line): one of hers to be found again, unless another of hers
    // equal to it (a closed tab's, taken up) is the one that stands, and is followed already.
    if (has(stand, one)) {
      if (!has(world.facts, one)) {
        world.facts = [
          ...world.facts,
          {
            row: one.row,
            value: one.value,
            here: true,
            opening: one.opening,
            ...atField(one)
          }
        ]
      }
      continue
    }
    if (O.isNone(pictured) || has(strayOwed, one)) {
      still.push(one)
      continue
    }
    const picture = pictured.value
    if (shows(one, picture)) {
      // Shown as what the import open holds: what she sees is what she decided. Shown it in a picture of the import
      // open that the server has moved on from, it is judged as one let go on such a picture.
      if (!picture.closed && serverHolds(one)) continue
      still.push(picture.closed ? one : { ...one, shownIn: one.shownIn === "open" ? "open" : "reopened" })
      continue
    }
    // Shown another value while the server still holds hers: the picture is behind, and the next one says.
    if (serverHolds(one)) {
      still.push(one)
      continue
    }
    // Shown on a picture the server had moved on from, and held as it to the confirm that ended its opening: imported
    // as she decided, and decided otherwise in a later opening.
    if (one.shownIn === "open" && heldToItsClose(world, one)) continue
    const fault: O.Option<keyof Blind> =
      one.ahead === true
        ? O.some("newerEntry")
        : one.shownIn === "reopened"
          ? O.some("equalAfterConfirm")
          : one.shownIn === "nothing"
            ? O.some("judgedBeforePicture")
            : one.reloaded
              ? O.some("reloadForgetsClose")
              : O.none()
    if (O.exists(fault, (it) => world.blind[it] === true)) {
      // Let go by a fault the checks leave out: what a pick of it promised is let go with it.
      void O.map(R.get(world.promised, one.row), (promise) => {
        if (isPartOf(promise.value, one.value)) delete world.promised[one.row]
      })
      continue
    }
    dropped(one, fault, R.get(picture.decisions, one.row))
  }
  world.covered = still
  world.named = []
  // Once named, never again: what she was told is not sent is not a side she can send, nor waits to be sent. (A confirm
  // out that the import was confirmed since outlives offers nothing: if it is not made, what it carries is named.)
  const offered = [
    ...O.match(
      O.filter(draft.flight, () => !draft.confirmOutlived),
      {
        onNone: () => [],
        onSome: (flight) => R.toEntries(flight.rows)
      }
    ),
    ...R.toEntries(draft.unsent),
    ...A.flatMap(R.toEntries(draft.lines), ([row, line]) =>
      A.map(
        A.filter(line.sides, (side) => O.isNone(side.refused)),
        (side) => [row, side] as const
      )
    )
  ]
  world.apart = A.filter(world.apart, (one) => A.some(world.toldNotSent, (told) => told.row === one.row))
  for (const told of world.toldNotSent) {
    const wasApart = (side: Value): boolean =>
      A.some(
        world.apart,
        (one) => one.row === told.row && sameDecision(one.told, told.value) && sameDecision(one.side, side)
      )
    if (world.server.matchedAt <= told.at) {
      for (const [row, side] of offered) {
        if (row !== told.row || sameDecision(told.value, side.decision) || wasApart(side.decision)) continue
        if (leftByMatch(told.value, side.decision)) {
          world.apart = [...world.apart, { row, told: told.value, side: side.decision }]
        }
      }
    }
    expect(
      A.some(
        offered,
        ([row, side]) =>
          row === told.row &&
          (sameDecision(told.value, side.decision) ||
            (world.server.matchedAt > told.at && leftByMatch(told.value, side.decision) && !wasApart(side.decision)))
      ),
      `row ${told.row}: she was told ${Formatter.format(told.value)} is not sent, and it is offered to be sent`
    ).toBe(false)
  }
}

/** What the screen shows of each row the server holds is the newest word the draft was told of it. */
const newestShown = (world: World): void => {
  const { draft } = world
  if (!draft.onScreen || O.isNone(draft.held) || draft.ended) return
  const onScreen = shown(draft)
  for (const [row, word] of R.toEntries(world.words)) {
    if (A.contains(pending(draft), row) || R.has(draft.lines, row)) continue
    expect(
      sameDecision(R.get(onScreen, row), word.value),
      `row ${row}: the screen shows ${Formatter.format(R.get(onScreen, row))}, and the newest word of it (the ${word.from} of revision ${word.at}) is ${Formatter.format(word.value)}`
    ).toBe(true)
  }
}

/**
 * True when no save of hers can have written this decision of the row: every save that carried it was refused, as
 * the tab was told, or none carried it at all (it still waited behind another save).
 */
const noneOfHersWritten = (world: World, one: { readonly row: string; readonly value: Value }): boolean => {
  const carried = (all: ReadonlyArray<Value> | undefined): number =>
    A.filter(all ?? [], (sent) => isPartOf(one.value, sent)).length
  return carried(world.sentByHer[one.row]) === carried(world.toldRefused[one.row])
}

/** Holds after every step, whatever happened before it. */
export const holds = (world: World): void => {
  const { draft } = world
  accountsFor(world)
  if (world.removed) return
  // The screen never claims a revision the server has not reached, nor one revision for another picture.
  O.map(draft.held, (held) => {
    expect(held.revision, "the screen claims a revision the server has not reached").toBeLessThanOrEqual(
      world.server.revision
    )
    expect(held.decisions, "the picture held is not what the server held at that revision").toEqual(
      world.history[held.revision]?.decisions
    )
  })
  // A row is never sent by itself while its line has an answer that can be.
  for (const [row, line] of R.toEntries(draft.lines)) {
    expect(
      R.has(draft.unsent, row) && O.isSome(draft.held) && A.some(line.sides, (side) => O.isNone(side.refused)),
      `row ${row} waits beside a line that asks which decision stands`
    ).toBe(false)
    expect(line.sides.length, "a line with nothing on it").toBeGreaterThan(0)
    // Each decision once among the closed tabs' (this tab's own may be one of them too: it is read once).
    const closed = A.filter(line.sides, (side) => !side.here)
    const each = A.dedupeWith(closed, (one, other) => sameDecision(one.decision, other.decision))
    expect(each.length, `row ${row} has the same decision of closed tabs twice on its line`).toBe(closed.length)
    const late = A.isReadonlyArrayNonEmpty(world.lateRead)
    if (!(late && world.blind.lateOwnEntry === true)) {
      const words = "two of this tab's on one line"
      expect(
        A.filter(line.sides, (side) => side.here).length,
        late ? broke("lateOwnEntry", words) : words
      ).toBeLessThanOrEqual(1)
    }
  }
  // While the step is drawn, what it holds of the server is the view the tab holds: never ahead of it, never behind.
  // (A confirmed import keeps no draft: its screen is the result. While this screen's own confirm is out, its answer
  // says whether it is the one that closed the import.)
  if (draft.onScreen && toldClosed(world)) {
    if (draft.confirm === "out") return
    expect(
      [O.isNone(draft.held), O.isNone(draft.flight), draft.unsent, draft.lines, draft.confirm],
      "the import is closed, and the draft has not ended"
    ).toEqual([true, true, {}, {}, "idle"])
    return
  }
  // (A view older than what a save's answer said is late: the read the answer asked for brings the newer one.)
  const lateView = O.exists(world.view, (view) => O.exists(draft.landed, (landed) => landed.at > view.revision))
  if (draft.onScreen && !draft.ended && !lateView) {
    expect(
      O.map(draft.held, (held) => held.revision),
      "on screen, the draft holds another revision than the tab's view"
    ).toEqual(O.map(world.view, (view) => view.revision))
  }
  newestShown(world)
  if (O.isSome(draft.held)) {
    const onScreen = shown(draft)
    for (const [row, value] of R.toEntries(world.confirmed)) {
      const words = `what the server took of row ${row} is not on screen: ${Formatter.format(R.get(onScreen, row))}, not ${Formatter.format(value)}`
      expect(
        sameDecision(R.get(onScreen, row), value),
        A.isReadonlyArrayNonEmpty(world.lateRead) ? broke("lateOwnEntry", words) : words
      ).toBe(true)
    }
  }
  if (!draft.onScreen || O.isNone(draft.held)) return
  // What the region shows is what the draft shows: the counts, the confirm button and the rows say one thing.
  expect(regionShows(world), "the region shows another thing than the draft").toEqual(plain(shown(draft)))
  if (!still(world)) return
  // With nothing on its way and nothing waiting to be sent, the screen waits for nothing: it holds no saved row over
  // a picture that lacks it (nobody would bring the newer one), it is not behind a revision it has been told of,
  // and when that revision is the server's latest, what it shows is what the server holds, but for its lines.
  expect(O.isNone(draft.landed), "a saved row still waits for a picture nobody asked for").toBe(true)
  // A pick of a decision of hers ends with it on the server, or asked about again on a line.
  if (world.server.open) {
    for (const [row, promise] of R.toEntries(world.promised)) {
      if (promise.stays || R.has(draft.lines, row)) continue
      expect(
        isPartOf(promise.value, R.get(world.server.decisions, row)),
        `row ${row}: she picked ${Formatter.format(promise.value)}, and the server holds ${Formatter.format(R.get(world.server.decisions, row))} with no line`
      ).toBe(true)
    }
  }
  expect(O.getOrThrow(draft.held).revision, "the screen is behind a revision it was told of").toBeGreaterThanOrEqual(
    world.told
  )
  if (world.told >= world.server.revision && R.isEmptyReadonlyRecord(draft.lines)) {
    expect(plain(shown(draft)), "the screen was told of the latest revision, and shows another thing").toEqual(
      plain(world.server.decisions)
    )
  }
}

/** Everything on its way lands, the person settles every line, and presses "Save again". */
export const quiet = (world: World): void => {
  const then = (command: Command): void => {
    runIn(world, command)
    holds(world)
  }
  if (world.removed) return
  then(Command.cases.ComeBack.make({}))
  then(Command.cases.TabIdKnown.make({}))
  for (let turn = 0; turn < 14; turn += 1) {
    then(Command.cases.SettleAll.make({ which: turn % 2 === 0 ? "first" : "theirs" }))
    then(Command.cases.SaveAgain.make({}))
    then(Command.cases.ServerTakesSave.make({ which: "first" }))
    then(Command.cases.SaveAnswers.make({ which: "first" }))
    then(Command.cases.ServerTakesConfirm.make({}))
    then(Command.cases.ConfirmAnswers.make({}))
    // A closed import refuses what is still out.
    if (!world.server.open) {
      then(Command.cases.SaveRefused.make({ which: "first" }))
      then(Command.cases.ConfirmFails.make({}))
    }
    for (let left = world.late.length; left > 0; left -= 1) then(Command.cases.OtherAnswerArrives.make({}))
    then(Command.cases.ServerTakesRead.make({}))
    then(Command.cases.ReadArrives.make({}))
  }
}

const rows = ["a", "b", "c"] as const
const tos = ["out", "kept", "accepted", "acceptedOut", "empty", "nothing"] as const

/** What a run may include besides deciding, saving, reading and settling lines. */
export interface Play {
  /** The person presses the confirm button. */
  readonly confirms: boolean
  /** Somebody else confirms the import, and opens it again. */
  readonly elsewhere: boolean
  /** The page is loaded again, the session ends, and closed tabs' entries are taken up. */
  readonly tabs: boolean
  /** The faults the checks leave out while the machine is unfixed: none unless named. */
  readonly blind?: Blind
}

/**
 * What can happen next, by kind: the commands enabled in the world as it stands. Most do something; a few can change
 * nothing (a return to the tab while a read is already out), so a run of forty commands is up to forty things that
 * happened.
 */
const enabledIn = (world: World, may: Play): ReadonlyArray<ReadonlyArray<Command>> => {
  const { draft } = world
  const reading = draft.onScreen && O.isSome(draft.held)
  const seen = regionShows(world)
  const pairs = A.flatMap(rows, (row) => A.map(tos, (to) => ({ row, to })))
  const when = (condition: boolean, ...commands: ReadonlyArray<Command>): ReadonlyArray<Command> =>
    condition ? commands : []
  const decides = A.filter(pairs, ({ row, to }) => reading && !Eq.equals(over(seen, change(row, to)), seen))
  const others = A.filter(
    pairs,
    ({ row, to }) =>
      world.server.open && !Eq.equals(over(world.server.decisions, change(row, to)), world.server.decisions)
  )
  // Any save that is out: the first, the last, and each between them by its place.
  const each = (
    of: (save: Save) => boolean,
    make: (save: { readonly which: "first" | "last"; readonly at?: number }) => Command
  ): ReadonlyArray<Command> => [
    ...A.flatMap(world.saves.length > 1 ? (["first", "last"] as const) : (["last"] as const), (which) =>
      O.exists(saveOf(world, which), of) ? [make({ which })] : []
    ),
    ...A.flatMap(A.range(1, Math.max(1, world.saves.length - 2)), (at) =>
      at < world.saves.length - 1 && O.exists(A.get(world.saves, at), of) ? [make({ which: "first", at })] : []
    )
  ]
  const unanswered = (save: Save): boolean => O.isNone(save.answer)
  const C = Command.cases
  const kinds: ReadonlyArray<ReadonlyArray<Command>> = [
    A.map(decides, (pair): Command => C.Decide.make(pair)),
    A.map(others, (pair): Command => C.SomeoneElse.make(pair)),
    when(world.server.open, C.Match.make({})),
    world.server.open ? each(unanswered, (save) => C.ServerTakesSave.make(save)) : [],
    each(
      (save) => O.isSome(save.answer),
      (save) => C.SaveAnswers.make(save)
    ),
    each(
      () => true,
      (save) => C.SaveFails.make(save)
    ),
    each(unanswered, (save) => C.SaveRefused.make(save)),
    when(!R.isEmptyReadonlyRecord(draft.unsent), C.SaveAgain.make({})),
    when(draft.onScreen, C.ReturnToTab.make({})),
    when(O.exists(world.read, O.isNone), C.ServerTakesRead.make({})),
    when(O.exists(world.read, O.isSome), C.ReadArrives.make({})),
    when(world.late.length < 2, C.OtherAnswerSent.make({})),
    when(world.late.length > 0, C.OtherAnswerArrives.make({})),
    when(draft.onScreen, C.Leave.make({})),
    when(!draft.onScreen, C.ComeBack.make({}), C.ComeBackQuickly.make({})),
    A.flatMap(R.keys(draft.lines), (row) =>
      A.map(["theirs", "first", "second"] as const, (which): Command => C.Settle.make({ row: row as "a", which }))
    ),
    when(R.keys(draft.lines).length > 1, C.SettleAll.make({ which: "theirs" }), C.SettleAll.make({ which: "first" })),
    // (Not while the tab waits for its id: that is a moment, and what it keeps is not written meanwhile.)
    when(
      may.tabs && O.isNone(world.ownLate),
      C.Reload.make({}),
      ...(world.blind.lateOwnEntry === true ? [] : [C.Reload.make({ idLate: true })])
    ),
    when(O.isSome(world.ownLate), C.TabIdKnown.make({})),
    may.tabs ? each(unanswered, (save) => C.SaveSignedOut.make(save)) : [],
    may.tabs && draft.onScreen
      ? A.flatMap(pairs, (pair) =>
          A.flatMap(["no", "refused", "another"] as const, (beside) =>
            A.map(["waiting", "landed", "refused"] as const, (as): Command => C.TakeUp.make({ ...pair, beside, as }))
          )
        )
      : [],
    when(may.tabs && O.isNone(world.ownLate) && O.isSome(world.kept) && pending(draft).length > 1, C.Removed.make({})),
    when(may.confirms && reading && draft.confirm === "idle", C.PressConfirm.make({})),
    when(
      O.exists(world.confirm, (confirm) => O.isNone(confirm.answer)) && world.server.open,
      C.ServerTakesConfirm.make({})
    ),
    when(
      O.exists(world.confirm, (confirm) => O.isSome(confirm.answer)),
      C.ConfirmAnswers.make({})
    ),
    when(O.isSome(world.confirm), C.ConfirmFails.make({})),
    when(may.elsewhere && world.server.open, C.SomeoneConfirms.make({})),
    // Its own kind, so that a save out across a close and a reopen comes up often enough to be met.
    may.elsewhere && world.server.open && A.some(world.saves, unanswered)
      ? A.map(["nothing", "taken", "answered"] as const, (then): Command => C.ClosedAround.make({ then }))
      : [],
    when(may.elsewhere && !world.server.open, C.SomeoneReopens.make({})),
    may.elsewhere && !world.server.open
      ? A.flatMap(rows, (row) =>
          A.map(["out", "kept", "accepted"] as const, (to): Command => C.ReopenDecideConfirm.make({ row, to }))
        )
      : []
  ]
  return A.filter(kinds, A.isReadonlyArrayNonEmpty)
}

/** The review opened on an import with these decisions, as the page opens it: the view read first, then the step. */
export const opened = (decisions: SavedDecisions = {}): World => openedIn(decisions, {})

/** The same, with the faults `blind` names left out of the checks. */
const openedIn = (decisions: SavedDecisions, blind: Blind): World => {
  const world = start(decisions, blind)
  runIn(world, Command.cases.ComeBack.make({}))
  return world
}

/**
 * The first thing that does not hold when `commands` are played from an opened review, in words; none if all holds.
 * `blind`: the faults whose rules are left out (none unless named).
 */
export const broken = (commands: ReadonlyArray<Command>): O.Option<string> => brokenIn(commands, {})

const brokenIn = (commands: ReadonlyArray<Command>, blind: Blind): O.Option<string> => {
  const world = openedIn({}, blind)
  const one = (command: Command): void => {
    runIn(world, command)
    holds(world)
  }
  const played = (): O.Option<string> => {
    for (const command of commands) one(command)
    // Everything on its way lands.
    quiet(world)
    if (world.removed) return O.none()
    // A look at the server, as any return to the tab gives: an open import then shows what the server holds.
    one(Command.cases.ReturnToTab.make({}))
    one(Command.cases.ServerTakesRead.make({}))
    one(Command.cases.ReadArrives.make({}))
    expect(
      [world.saves.length, O.isNone(world.confirm), world.draft.confirm],
      "after everything landed, a save or a confirm is still out"
    ).toEqual([0, true, "idle"])
    expect(
      [O.isNone(world.draft.landed), world.draft.unsent, world.draft.lines],
      "after everything landed and every line was settled, a row of the person's still waits"
    ).toEqual([true, {}, {}])
    // Every save out across a close was answered: the draft remembers none of them, and what each owed was settled.
    expect(R.keys(world.draft.strays), "after everything landed, a save across a close is still remembered").toEqual([])
    if (world.server.open) {
      expect(
        plain(shown(world.draft)),
        "after a look at the server, the screen shows another thing than it holds"
      ).toEqual(plain(world.server.decisions))
    }
    return O.none()
  }
  // What did not hold is thrown (an `expect`, or the draft refusing a step): its words are the answer.
  return Result.match(
    Result.try({ try: played, catch: (error) => (error instanceof Error ? error.message : String(error)) }),
    { onSuccess: (held) => held, onFailure: O.some }
  )
}

/** The ordering with every command left out that it still fails without: what a failure prints. */
const shortest = (commands: ReadonlyArray<Command>, blind: Blind): ReadonlyArray<Command> => {
  const without = A.findFirst(
    A.map(commands, (_, n) => A.remove(commands, n)),
    (fewer) => O.isSome(brokenIn(fewer, blind))
  )
  return O.match(without, { onNone: () => commands, onSome: (fewer) => shortest(fewer, blind) })
}

const Choice = S.Int.check(S.isBetween({ minimum: 0, maximum: 999 }))
/** Which kind of thing happens next, and which of that kind: each drawn from what is enabled when its turn comes. */
export const Choices = S.Array(S.Tuple([Choice, Choice])).check(S.isMinLength(30), S.isMaxLength(60))

/**
 * Draws each command from what is enabled when its turn comes, then checks the whole ordering. A failure is thrown
 * under its shortest ordering, as words, with what did not hold.
 */
const drawn = (choices: typeof Choices.Type, may: Play): World & { readonly commands: ReadonlyArray<Command> } => {
  const world = openedIn({}, may.blind ?? {})
  const commands: Array<Command> = []
  for (const [kind, which] of choices) {
    const kinds = enabledIn(world, may)
    const of = kinds[kind % Math.max(1, kinds.length)]
    const command = of?.[which % of.length]
    if (command === undefined) break
    commands.push(command)
    // The world moves on so the next draw is from what is enabled then; what must hold is checked by `broken`.
    if (O.isNone(O.liftThrowable(runIn)(world, command))) break
  }
  return Object.assign(world, { commands })
}

const playIn = (choices: typeof Choices.Type, may: Play): void => {
  const blind = may.blind ?? {}
  const { commands } = drawn(choices, may)
  if (O.isNone(brokenIn(commands, blind))) return
  const ordering = shortest(commands, blind)
  throw new Error(
    `${A.join(
      A.map(ordering, (command) => Formatter.format(command)),
      ", "
    )}\n${O.getOrElse(brokenIn(ordering, blind), () => "")}`
  )
}

/**
 * How often each shape of ordering the generator was made to reach comes up in the ordering these choices draw:
 * counted, nothing checked. For measuring the generator's weights by hand.
 */
const shapesIn = (choices: typeof Choices.Type, may: Play): Readonly<Record<string, number>> =>
  drawn(choices, may).shapes

/** What one event does to the world: the draft steps, and the world does what it asks. */
export const dispatch: {
  (event: DraftEvent): (world: World) => void
  (world: World, event: DraftEvent): void
} = dual(2, dispatchIn)

/** One command played in the world, then everything that must hold checked. */
export const run: {
  (command: Command): (world: World) => void
  (world: World, command: Command): void
} = dual(2, runIn)

/** What can happen next, by kind. */
export const enabled: {
  (may: Play): (world: World) => ReadonlyArray<ReadonlyArray<Command>>
  (world: World, may: Play): ReadonlyArray<ReadonlyArray<Command>>
} = dual(2, enabledIn)

/** One generated ordering played and checked; a failure is thrown under its shortest ordering. */
export const play: {
  (may: Play): (choices: typeof Choices.Type) => void
  (choices: typeof Choices.Type, may: Play): void
} = dual(2, playIn)

/** The first thing that does not hold, with the faults `blind` names left out of the checks; none if all holds. */
export const brokenWithout: {
  (blind: Blind): (commands: ReadonlyArray<Command>) => O.Option<string>
  (commands: ReadonlyArray<Command>, blind: Blind): O.Option<string>
} = dual(2, brokenIn)

/** How often each shape of ordering comes up in one drawn ordering: counted, nothing checked. */
export const shapesOf: {
  (may: Play): (choices: typeof Choices.Type) => Readonly<Record<string, number>>
  (choices: typeof Choices.Type, may: Play): Readonly<Record<string, number>>
} = dual(2, shapesIn)
