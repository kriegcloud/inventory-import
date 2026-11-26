// The review's draft against a server and a network that answer in any order, as one world that commands are played in.
// The server does what the real one does with a save: a row that waited is written only over what it names, a part made
// before its column was matched again is not applied, and a closed import refuses. After every command the rules that a
// wrong result would break are checked (`holds`): each decision the person made is on the server, waiting, a side of a
// line, or named; and nothing somebody else decided is ever overwritten unasked.
import { expect } from "@effect/vitest"
import * as A from "effect/Array"
import * as Eq from "effect/Equal"
import * as Formatter from "effect/Formatter"
import { identity, dual } from "effect/Function"
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

/** Everything that can happen, in any order. */
export const Command = S.TaggedUnion({
  Decide: { row: Row, to: To },
  SomeoneElse: { row: Row, to: To },
  /** Somebody matches the column the accepts rest on: the stored ones are taken back. */
  Match: {},
  ServerTakesSave: { which: S.optionalKey(Which) },
  SaveAnswers: { which: S.optionalKey(Which) },
  SaveFails: { which: S.optionalKey(Which) },
  SaveSignedOut: { which: S.optionalKey(Which) },
  SaveRefused: { which: S.optionalKey(Which) },
  SaveAgain: {},
  ReturnToTab: {},
  ServerTakesRead: {},
  ReadArrives: {},
  OtherAnswerSent: {},
  OtherAnswerArrives: {},
  Leave: {},
  ComeBack: {},
  ComeBackQuickly: {},
  Reload: {},
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

/** A decision without its accept, as a match leaves it. */
const withoutAccept = (value: Value): Value => O.map(value, (decision) => ({ ...decision, accepted: [] }))
const hasAccept = (value: Value): boolean => O.exists(value, (decision) => decision.accepted.length > 0)

const isIn = (values: ReadonlyArray<Value> | undefined, one: Value): boolean =>
  A.some(O.match(O.fromUndefinedOr(values), { onNone: A.empty, onSome: identity }), (other) => sameDecision(other, one))

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
}

/** One decision the person made that must be somewhere. */
interface Fact {
  readonly row: string
  readonly value: Value
  readonly here: boolean
}

/** The screen, the server, and what is on its way between them. */
export interface World {
  draft: Draft
  server: Snapshot
  /** Every state the server has been in, by revision. */
  history: Record<number, Snapshot>
  /** Every decision the server has held of each row. */
  everHeld: Record<string, ReadonlyArray<Value>>
  /** The rows whose stored decision somebody else wrote. */
  byElse: Record<string, boolean>
  /**
   * The rows whose stored decision a tab of the person's decided, as the server credits it: a save that changes what is
   * stored is its decider's, and one that sends it unchanged leaves the decider as it was, whoever sent it.
   */
  readonly decidedByHer: Record<string, boolean>
  /**
   * Every decision written of each row, and who wrote it: this tab, another tab of the person's, or somebody else. What
   * a match left of one is written by whoever wrote that one. A line that says somebody decided a row since is held to
   * it (`holds`).
   */
  writes: Record<string, ReadonlyArray<{ readonly value: Value; readonly by: Writer }>>
  /**
   * Every decision of each row a tab of the person's sent, whatever became of it, and what the server stored of each:
   * `over` names values, not writers, so the server cannot tell a colleague's decision equal to one of these from hers
   * (see `replaces`).
   */
  sentByHer: Record<string, ReadonlyArray<Value>>
  /**
   * What a pick on a line promised of a row: that what the server held then stays (Keep theirs, Keep what is saved),
   * or that the person's decision is written or asked about again (Use mine, Keep this tab's). Held until the person
   * decides the row again.
   */
  promised: Record<string, { readonly stays: boolean; readonly value: Value }>
  /** What a stored decision was before a match took part of it back: it counts as that still. */
  before: Record<string, ReadonlyArray<Value>>
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
  made: Record<string, ReadonlyArray<Value>>
  /** The decisions the person could see of each row (the screen's, a line's, a closed tab's own) before they pressed. */
  couldSee: Record<string, ReadonlyArray<Value>>
  /** The same, for each decision of theirs that may be sent: as it was when they pressed. */
  pressedOver: ReadonlyArray<{ readonly row: string; readonly value: Value; readonly saw: ReadonlyArray<Value> }>
  /** The rows that are not a live press any more: they waited, or somebody saved since. */
  waited: Record<string, boolean>
  /**
   * The rows whose line a closed tab's decision was taken up onto, beside this tab's own press (waiting or on its way),
   * which is as it was: that decision waited, and is never sent as a live press. Let go when the person decides the row
   * again with no decision of that tab's, not refused, standing on the line: what goes of the row is then this tab's
   * own, live or not as it was. With no press of this tab's beside it, the row itself waited (`waited`).
   */
  readonly besideWaited: Record<string, boolean>
  /** The decisions the server refused, until the person makes them again. */
  refused: ReadonlyArray<{ readonly row: string; readonly value: Value }>
  /**
   * The decisions of each row this tab sent whose save's answer never came back (lost with a reload, or signed out), until
   * something newer is known of the row: she decides it or picks on its line, a save carrying it is answered or refused,
   * a confirm's answer says it was made, or a closed tab's decision of it is taken up. A row sent again as one of these is not counted as
   * sent as the server refused it: the check compares values, so a refused decision of the same value goes unflagged
   * while the entry stands.
   */
  readonly unanswered: Record<string, ReadonlyArray<Value>>
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
}

const start = (decisions: SavedDecisions): World => {
  const server: Snapshot = { revision: 1, decisions, open: true, confirms: 0, matchedAt: 0, takenBack: [] }
  return {
    draft: emptyDraft,
    server,
    history: { 1: server },
    everHeld: R.map(decisions, (one) => [O.some(one)]),
    byElse: {},
    decidedByHer: {},
    writes: {},
    sentByHer: {},
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
    besideWaited: {},
    refused: [],
    unanswered: {},
    confirmed: {},
    restarts: 0,
    announced: 0,
    said: 0,
    named: [],
    kept: O.none(),
    told: 1,
    region: O.none(),
    removed: false
  }
}

const rowsOf = (delta: DecisionDelta): RowChanges => ({
  ...R.map(delta.set, (decision) => O.some(decision)),
  ...R.fromEntries(A.map(delta.clear, (row) => [row, O.none()] as const))
})

/** Decisions as the person reads them: a row decided with nothing in it reads as one not decided. */
const plain = (decisions: SavedDecisions): SavedDecisions =>
  R.filter(decisions, (one) => !sameDecision(O.some(one), O.none()))

/** What the person sees in the region: its own decisions, or the draft's while it has made none. */
export const regionShows = (world: World): SavedDecisions =>
  plain(O.match(world.region, { onNone: () => shown(world.draft), onSome: identity }))

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
  if (!sameDecision(R.get(world.server.decisions, row), value)) world.decidedByHer[row] = !byElse
  world.everHeld[row] = [...(world.everHeld[row] ?? [O.none()]), value]
  world.writes[row] = [...O.match(R.get(world.writes, row), { onNone: A.empty, onSome: identity }), { value, by }]
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
    A.some([stored, ...O.match(R.get(world.before, row), { onNone: A.empty, onSome: identity })], (one) =>
      isIn(saw, one)
    ),
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
  for (const [row, value] of R.toEntries(rows))
    world.sentByHer[row] = [...O.match(R.get(world.sentByHer, row), { onNone: A.empty, onSome: identity }), value]
}

/** True when the decision sent is the one made, or what is left of it without its accept. */
const isPartOf = (made: Value, sent: Value): boolean =>
  sameDecision(made, sent) || sameDecision(withoutAccept(made), sent)

/**
 * The server takes rows of a save: what it stores of each, what it does not apply, and what was decided since. A row
 * that waited is judged as the server's `decidedSince` (`Waited.rules.ts`) judges it: written while what is stored is
 * what the save leaves of it, one of the decisions named, or one of those without the accept a match took back: a match
 * after the row's revision, or, where a tab of hers decided what the match took from and nobody else saved the row
 * since, even unchanged, any match since that write.
 */
const takes = (world: World, save: Pick<Save, "delta" | "madeOn" | "over" | "live">): Save["answer"] => {
  const decisions: Record<string, SavedDecisions[string]> = { ...world.server.decisions }
  const notApplied: Array<{ rowId: string; field: string; kind: "accept" }> = []
  const decidedSince: Array<{ rowId: string; theirs: Value }> = []
  for (const [row, value] of R.toEntries(rowsOf(save.delta))) {
    const stored = R.get(world.server.decisions, row)
    const names = R.get(save.over, row)
    const matchedSince = (save.madeOn[row] ?? 0) < world.server.matchedAt
    const stale = hasAccept(value) && matchedSince
    const written = stale ? withoutAccept(value) : value
    // What a match took from a decision a tab of hers decided and last saved, as the server credits both: `before` holds
    // what each match since the last write took from. `byElse` and `decidedByHer` may both be set, when somebody else turns
    // an empty decision into none or back (`stores` reads them as the same decision), but `before` is then empty: a
    // store empties it and a match adds only a row with an accept, which an empty decision or none is not, so `byElse`
    // decides nothing here.
    const takenFromHers = (one: Value): boolean =>
      world.decidedByHer[row] === true && world.byElse[row] !== true && isIn(world.before[row], one)
    const leftOf = (one: Value): boolean =>
      sameDecision(stored, one) || ((matchedSince || takenFromHers(one)) && sameDecision(stored, withoutAccept(one)))
    if (O.exists(names, (values) => !sameDecision(stored, written) && !A.some(values, leftOf))) {
      decidedSince.push({ rowId: row, theirs: O.filter(stored, (one) => !sameDecision(O.some(one), O.none())) })
      continue
    }
    if (stale) notApplied.push({ rowId: row, field: "unitCost", kind: "accept" })
    replaces(world, { row, value: written, named: names, isLive: A.contains(save.live, row) })
    keeps(world, row, written)
    world.sentByHer[row] = [...O.match(R.get(world.sentByHer, row), { onNone: A.empty, onSome: identity }), written]
    // A closed tab's decision this tab took up and sent is that tab's: the line may say another tab decided it.
    const by: Writer = A.some(world.facts, (fact) => fact.row === row && !fact.here && isPartOf(fact.value, written))
      ? "another tab"
      : "this tab"
    // Saved as it already was: what is stored stays, and so does whom the server credits with deciding it
    // (`decidedByHer`); this save's writer is who saved it last.
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
const arrive = (world: World, view: Snapshot, isWaiting: boolean): void => {
  // The server moved on since the picture the screen holds, or says the same revision otherwise: somebody (or a save of
  // hers whose answer is still out) saved since what waits or is on its way was pressed, and none of it is a live press
  // any more, nor is what she presses over a row on its way. Her screen showed her own decision there, never what the
  // picture holds, and whoever saved that is the server's to judge.
  const moved = O.exists(
    world.draft.held,
    (held) =>
      view.revision > held.revision || (view.revision === held.revision && !Eq.equals(view.decisions, held.decisions))
  )
  if (moved) {
    for (const row of R.keys(world.draft.unsent)) world.waited[row] = true
    O.map(world.draft.flight, (flight) => {
      for (const row of R.keys(flight.rows)) world.waited[row] = true
    })
  }
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
}

/** The person can see these decisions from now on. */
const sees = (world: World, decisions: SavedDecisions): void => {
  for (const row of ["a", "b", "c"]) {
    world.couldSee[row] = [
      ...O.match(R.get(world.couldSee, row), { onNone: A.empty, onSome: identity }),
      R.get(decisions, row)
    ]
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
      A.some(O.match(R.get(world.made, row), { onNone: A.empty, onSome: identity }), (made) => isPartOf(made, value)),
      `row ${row} is sent as ${Formatter.format(value)}, which the person never decided`
    ).toBe(true)
    // Sent as a refused decision only when nothing else she made explains it: a decision of hers that the server
    // trims (a part a match took back) to what a closed tab was refused is still hers, and goes; so is this tab's own
    // send of the same decision whose answer never came back, which goes again.
    const isUnanswered = O.exists(R.get(world.unanswered, row), (values) => isIn(values, value))
    expect(
      A.some(
        world.refused,
        (one) =>
          one.row === row &&
          sameDecision(one.value, value) &&
          !isUnanswered &&
          !A.some(
            O.match(R.get(world.made, row), { onNone: A.empty, onSome: identity }),
            (made) => isPartOf(made, value) && !sameDecision(made, one.value)
          )
      ),
      `row ${row} is sent as the server refused it`
    ).toBe(false)
    expect(
      A.some(O.match(O.fromUndefinedOr(world.draft.lines[row]?.sides), { onNone: A.empty, onSome: identity }), (side) =>
        O.isNone(side.refused)
      ),
      `row ${row} is sent while its line asks`
    ).toBe(false)
  }
}

const perform = (world: World, effect: DraftEffect): void =>
  DraftEffect.$match(effect, {
    Say: ({ what }) => {
      world.said += 1
      if (Said.$is("Outlived")(what)) names(world, what)
    },
    Send: ({ delta, id, madeOn, over: names }) => {
      // One save at a time, never beside a confirm, under an id of its own, of the person's own rows.
      expect(O.isNone(world.confirm), "a save beside a confirm").toBe(true)
      expect(
        A.some(world.saves, (save) => save.id === id),
        "two saves under one id"
      ).toBe(false)
      const rows = rowsOf(delta)
      ownRows(world, rows)
      for (const row of R.keys(rows)) {
        expect(hasWaited(world, row) && !R.has(names, row), `row ${row} waited and goes as a live press`).toBe(false)
        expect(names[row]?.length ?? 0, "more decisions named than the contract takes").toBeLessThanOrEqual(50)
      }
      // What it names of each row the person knew of: she saw it, or a tab of hers sent it.
      for (const [row, named] of R.toEntries(names)) {
        const knew = [
          ...O.match(R.get(world.couldSee, row), { onNone: A.empty, onSome: identity }),
          ...A.flatMap(
            A.filter(world.pressedOver, (press: World["pressedOver"][number]) => press.row === row),
            (press: World["pressedOver"][number]) => press.saw
          ),
          ...O.match(R.get(world.sentByHer, row), { onNone: A.empty, onSome: identity })
        ]
        for (const one of named) {
          expect(isIn(knew, one), `row ${row} names ${Formatter.format(one)}, which the person never knew of`).toBe(
            true
          )
        }
      }
      sent(world, rows)
      const live = A.filter(R.keys(rows), (row) => !hasWaited(world, row))
      world.saves = [...world.saves, { id, delta, madeOn, over: names, live, answer: O.none() }]
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
      const live = A.filter(R.keys(rows), (row) => !hasWaited(world, row))
      world.confirm = O.some({ id, revision, delta, madeOn, shown: shown(world.draft), live, answer: O.none() })
    }
  })

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
  O.match(O.all([before.held, stepped.draft.held]), {
    onNone: () => {},
    onSome: () => {
      if (
        !DraftEvent.$is("Decided")(event) &&
        before.onScreen &&
        stepped.draft.onScreen &&
        !Eq.equals(shown(before), shown(stepped.draft))
      ) {
        expect(
          A.some(stepped.effects, DraftEffect.$is("Restart")),
          `what the screen shows changed without the person (${Formatter.format(event)}), and the region was not told`
        ).toBe(true)
      }
    }
  })
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
          A.some(
            O.match(R.get(world.writes, row), { onNone: A.empty, onSome: identity }),
            (one) => one.by !== "this tab" && sameDecision(one.value, theirs)
          ),
          `row ${row}: the line says ${Formatter.format(theirs)} was decided since by someone else or another tab, and only this tab wrote it`
        ).toBe(true)
    )
  }
  for (const [row, line] of R.toEntries(world.draft.lines)) {
    // What a line says somebody decided since can be seen.
    O.map(line.theirs, (value) => {
      world.couldSee[row] = [...O.match(R.get(world.couldSee, row), { onNone: A.empty, onSome: identity }), value]
    })
  }
  for (const effect of stepped.effects) perform(world, effect)
  // What waits is kept in the browser as it changes, so a reload finds it.
  world.kept = waiting(world.draft)
}

/** The rows of the person's that wait, or are on their way. */
const pending = (draft: Draft): ReadonlyArray<string> => [
  ...R.keys(draft.unsent),
  ...O.match(draft.flight, { onNone: () => [], onSome: (flight) => R.keys(flight.rows) })
]

/** True when what goes of a row is no live press: it waited, or a closed tab's decision beside it did. */
const hasWaited = (world: World, row: string): boolean => world.waited[row] === true || world.besideWaited[row] === true

/** Every row that waits is no live press from now on. */
const allWaited = (world: World): void => {
  for (const row of pending(world.draft)) world.waited[row] = true
}

/** The person's press of one decision: what they could see then is what it may replace. */
const presses = (world: World, row: string, value: Value, more: ReadonlyArray<Value>): void => {
  const own = A.filter(world.pressedOver, (press: World["pressedOver"][number]) => press.row === row)
  // Decided over their own earlier decision: what that one may replace, and itself.
  const saw = [
    ...O.match(R.get(world.couldSee, row), { onNone: A.empty, onSome: identity }),
    ...more,
    ...A.flatMap(own, (press: World["pressedOver"][number]) => press.saw),
    ...A.map(own, (p) => p.value)
  ]
  world.pressedOver = [...world.pressedOver, { row, value, saw }]
  world.made[row] = [...O.match(R.get(world.made, row), { onNone: A.empty, onSome: identity }), value]
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

/** The save a command is about: none where there is none of that kind. */
const saveOf = (world: World, which: "first" | "last"): O.Option<Save> =>
  which === "first" ? A.head(world.saves) : A.last(world.saves)

const replaceSave = (world: World, save: Save): void => {
  world.saves = A.map(world.saves, (one) => (one.id === save.id ? save : one))
}
const dropSave = (world: World, save: Save): void => {
  world.saves = A.filter(world.saves, (one) => one.id !== save.id)
}
/** Something newer is known of a row than a save of this tab's whose answer never came back. */
const forget = (world: World, row: string): void => {
  delete world.unanswered[row]
}

/** A save of this tab's whose answer never comes back: what it carried is this tab's, and may go again. */
const lost = (world: World, save: Save): void => {
  for (const [row, value] of R.toEntries(rowsOf(save.delta))) {
    world.unanswered[row] = O.match(R.get(world.unanswered, row), {
      onNone: () => [value],
      onSome: (values) => [...values, value]
    })
  }
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
          world.promised[rowId] = { stays: true, value: R.get(shownOfServer(world), rowId) }
        } else delete world.promised[rowId]
      },
      Side: ({ decision }) => {
        const side = A.findFirst(line.sides, (one) => sameDecision(one.decision, decision))
        if (O.isNone(side)) return
        // The one picked is hers from this tab now, whichever tab made it; the others on the line are let go.
        world.facts = A.map(
          A.filter(world.facts, (fact) => fact.row !== rowId || !on(fact.value) || isPartOf(fact.value, decision)),
          (fact) => (fact.row === rowId && isPartOf(fact.value, decision) ? { ...fact, here: true } : fact)
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
          world.promised[rowId] = { stays: isSaved, value: decision }
        } else delete world.promised[rowId]
      }
    })
    delete world.confirmed[rowId]
    forget(world, rowId)
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
          if (!Eq.equals(R.get(world.server.decisions, row), value)) stores(world, row, value, "this tab")
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
          for (const row of R.keys(world.unanswered)) forget(world, row)
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
      const showed = R.get(before, row)
      const wasPending = A.contains(pending(world.draft), row)
      const own = A.filter(
        O.match(O.fromUndefinedOr(world.draft.lines[row]?.sides), { onNone: A.empty, onSome: identity }),
        (side) => side.here
      )
      // Their earlier decision of the row, shown on the screen or this tab's on its line, is replaced by this one.
      world.facts = A.filter(
        world.facts,
        (fact) =>
          fact.row !== row ||
          !(
            (wasPending && isPartOf(fact.value, showed)) ||
            // A closed tab's decision equal to this tab's is one with it (read once, sent once): replaced with it.
            A.some(own, (side) => isPartOf(fact.value, side.decision)) ||
            (fact.here && wasPending)
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
      world.facts = [...world.facts, { row, value, here: true }]
      world.refused = A.filter(world.refused, (one) => !(one.row === row && isPartOf(value, one.value)))
      delete world.confirmed[row]
      delete world.promised[row]
      forget(world, row)
      // The decision it rests on counts as seen.
      presses(world, row, value, [showed])
      // What the screen knows is behind (an answer said so) makes it no live press.
      if (!wasPending) world.waited[row] = O.isSome(world.draft.landed)
      // Decided again with no closed tab's decision standing on the line (a refused one is settled by this one, and one
      // not refused stays a side beside it): what goes of the row is this tab's own, as it was.
      const theirsStands = O.exists(R.get(world.draft.lines, row), (line) =>
        A.some(line.sides, (side) => !side.here && O.isNone(side.refused))
      )
      if (!theirsStands) delete world.besideWaited[row]
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
        world.before[row] = [...O.match(R.get(world.before, row), { onNone: A.empty, onSome: identity }), was]
        world.everHeld[row] = [...O.match(R.get(world.everHeld, row), { onNone: A.empty, onSome: identity }), left]
        // What a match left of a decision is still its writer's.
        const by = O.getOrElse(
          O.map(A.last(O.match(R.get(world.writes, row), { onNone: A.empty, onSome: identity })), (one) => one.by),
          (): Writer => "somebody else"
        )
        world.writes[row] = [
          ...O.match(R.get(world.writes, row), { onNone: A.empty, onSome: identity }),
          { value: left, by }
        ]
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
    // The page is loaded again. What was on its way to the old page never arrives, and a request the server had not
    // taken is lost; what the browser kept is all the new page has of the person's.
    Reload: () => {
      for (const save of world.saves) lost(world, save)
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
      dispatchIn(world, DraftEvent.Opened({ kept: back }))
      world.read = O.some(O.none())
    },
    ServerTakesSave: ({ which }) =>
      void O.map(saveOf(world, which ?? "last"), (save) => {
        // A closed import takes no save: it refuses it (`SaveRefused`).
        if (O.isSome(save.answer) || !world.server.open) return
        replaceSave(world, { ...save, answer: takes(world, save) })
      }),
    SaveAnswers: ({ which }) =>
      void O.map(saveOf(world, which ?? "last"), (save) => {
        if (O.isNone(save.answer)) return
        const answer = save.answer.value
        const current = isCurrent(world, save)
        dropSave(world, save)
        for (const row of R.keys(rowsOf(save.delta))) forget(world, row)
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
        dispatchIn(world, DraftEvent.SaveAnswered({ id: save.id, ...answer }))
      }),
    SaveFails: ({ which }) =>
      void O.map(saveOf(world, which ?? "last"), (save) => {
        if (isCurrent(world, save)) allWaited(world)
        dropSave(world, save)
        dispatchIn(world, DraftEvent.SaveFailed({ id: save.id }))
      }),
    SaveSignedOut: ({ which }) =>
      void O.map(saveOf(world, which ?? "last"), (save) => {
        if (O.isSome(save.answer)) return
        if (isCurrent(world, save)) allWaited(world)
        lost(world, save)
        dropSave(world, save)
        dispatchIn(world, DraftEvent.SaveSignedOut({ id: save.id }))
      }),
    SaveRefused: ({ which }) =>
      void O.map(saveOf(world, which ?? "last"), (save) => {
        if (O.isSome(save.answer)) return
        // Refused: what it carried is no unanswered send of this tab's any more.
        const carried = rowsOf(save.delta)
        for (const row of R.keys(carried)) forget(world, row)
        if (isCurrent(world, save)) {
          allWaited(world)
          for (const [row, value] of R.toEntries(carried)) {
            if (latestHere(world, row, value)) world.refused = [...world.refused, { row, value }]
          }
        }
        dropSave(world, save)
        dispatchIn(world, DraftEvent.SaveRefused({ id: save.id, reason: "The import was already imported." }))
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
      const side = (decision: Value, parts: Partial<Side>): Side => ({
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
      const add = (one: Value): void => {
        world.facts = [...world.facts, { row, value: one, here: false }]
        world.made[row] = [...O.match(R.get(world.made, row), { onNone: A.empty, onSome: identity }), one]
        world.pressedOver = [...world.pressedOver, { row, value: one, saw: [base, one] }]
      }
      if (sameDecision(base, value)) return
      // A decision of the row newer than any save of this tab's whose answer was lost: that one is not what goes now.
      forget(world, row)
      const landed = as === "landed" && world.server.open && Eq.equals(R.get(world.server.decisions, row), base)
      if (landed) {
        // Its last save reached the server, and its answer was lost with the tab.
        stores(world, row, value, "another tab")
        world.sentByHer[row] = [...O.match(R.get(world.sentByHer, row), { onNone: A.empty, onSome: identity }), value]
        delete world.confirmed[row]
        moves(world, { decisions: over(world.server.decisions, { [row]: value }) })
      }
      add(value)
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
            ...A.filter(
              O.match(O.fromUndefinedOr(before.lines[row]?.sides), { onNone: A.empty, onSome: identity }),
              (one) => one.here && O.isNone(one.refused)
            )
          ],
          (mine) => sameDecision(mine.decision, one.value)
        )
      world.refused = A.filter(world.refused, (one) => !isOwn(one))
      dispatchIn(world, DraftEvent.TakenUp({ kept: O.some(entry).pipe(keptForm, O.getOrThrow) }))
      // What it added to the row waited: it is sent over what it names, never as a live press.
      // (A refused one beside is a notice: this tab's own press is as it was.) Added only beside this tab's own, waiting
      // or on its way, as a side of the row's line, that press is as it was too: what waited is the side
      // (`besideWaited`). With no press of this tab's of the row, what goes of it later is what the take-up brought.
      const ownOf = (draft: Draft) => [
        R.get(draft.unsent, row),
        O.flatMap(draft.flight, (flight) => R.get(flight.rows, row))
      ]
      const ofRow = (draft: Draft) => [
        ...ownOf(draft),
        A.filter(O.match(O.fromUndefinedOr(draft.lines[row]?.sides), { onNone: A.empty, onSome: identity }), (side) =>
          O.isNone(side.refused)
        )
      ]
      if (!Eq.equals(ofRow(before), ofRow(world.draft))) {
        if (A.some(ownOf(before), O.isSome) && Eq.equals(ownOf(before), ownOf(world.draft))) {
          world.besideWaited[row] = true
        } else world.waited[row] = true
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

/** True when the person's latest decision of a row is the one sent: nothing was decided of it since. */
const latestIs = (world: World, row: string, value: Value): boolean =>
  !R.has(world.draft.unsent, row) &&
  !A.some(O.match(O.fromUndefinedOr(world.draft.lines[row]?.sides), { onNone: A.empty, onSome: identity }), (side) =>
    O.isNone(side.refused)
  ) &&
  O.exists(world.draft.flight, (flight) => R.has(flight.rows, row)) &&
  A.some(O.match(R.get(world.made, row), { onNone: A.empty, onSome: identity }), (made) => isPartOf(made, value))

/**
 * True when the decision of a row this tab sent is the latest of this tab's: nothing was decided of it here since (a
 * closed tab's decision beside it on its line is not this tab's).
 */
const latestHere = (world: World, row: string, value: Value): boolean =>
  !R.has(world.draft.unsent, row) &&
  !A.some(
    O.match(O.fromUndefinedOr(world.draft.lines[row]?.sides), { onNone: A.empty, onSome: identity }),
    (side) => side.here && O.isNone(side.refused)
  ) &&
  O.exists(world.draft.flight, (flight) => R.has(flight.rows, row)) &&
  A.some(O.match(R.get(world.made, row), { onNone: A.empty, onSome: identity }), (made) => isPartOf(made, value))

/** Nothing is on its way between the screen and the server, and nothing of the person's waits to be sent. */
const still = (world: World): boolean =>
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

/** Holds after every step, whatever happened before it. */
export const holds = (world: World): void => {
  const { draft } = world
  // A decision the person made is on the server, waiting, a side of a line, or named: never neither, whatever was lost
  // on the way and whatever page this is.
  const now = [...placed(draft), ...world.named]
  for (const fact of world.facts) {
    const somewhere =
      A.some(now, (one) => one.row === fact.row && isPartOf(fact.value, one.value)) ||
      A.some(world.everHeld[fact.row] ?? [O.none()], (held) => isPartOf(fact.value, held))
    expect(somewhere, `${Formatter.format(fact)} is not on the server, waiting, on a line or named`).toBe(true)
  }
  // What was named has been: it is not expected anywhere else any more.
  world.facts = A.filter(
    world.facts,
    (fact) => !A.some(world.named, (one) => one.row === fact.row && isPartOf(fact.value, one.value))
  )
  world.named = []
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
    expect(A.filter(line.sides, (side) => side.here).length, "two of this tab's on one line").toBeLessThanOrEqual(1)
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
  O.match(draft.held, {
    onNone: () => {},
    onSome: () => {
      const onScreen = shown(draft)
      for (const [row, value] of R.toEntries(world.confirmed)) {
        expect(
          sameDecision(R.get(onScreen, row), value),
          `what the server took of row ${row} is not on screen: ${Formatter.format(R.get(onScreen, row))}, not ${Formatter.format(value)}`
        ).toBe(true)
      }
    }
  })
  if (!draft.onScreen) return
  O.match(draft.held, {
    onNone: () => {},
    onSome: (held) => {
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
      expect(held.revision, "the screen is behind a revision it was told of").toBeGreaterThanOrEqual(world.told)
      if (world.told >= world.server.revision && R.isEmptyReadonlyRecord(draft.lines)) {
        expect(plain(shown(draft)), "the screen was told of the latest revision, and shows another thing").toEqual(
          plain(world.server.decisions)
        )
      }
    }
  })
}

/** Everything on its way lands, the person settles every line, and presses "Save again". */
export const quiet = (world: World): void => {
  const then = (command: Command): void => {
    runIn(world, command)
    holds(world)
  }
  if (world.removed) return
  then(Command.cases.ComeBack.make({}))
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
  const each = (of: (save: Save) => boolean, make: (which: "first" | "last") => Command): ReadonlyArray<Command> =>
    A.flatMap(world.saves.length > 1 ? (["first", "last"] as const) : (["last"] as const), (which) =>
      O.exists(saveOf(world, which), of) ? [make(which)] : []
    )
  const unanswered = (save: Save): boolean => O.isNone(save.answer)
  const C = Command.cases
  const kinds: ReadonlyArray<ReadonlyArray<Command>> = [
    A.map(decides, (pair): Command => C.Decide.make(pair)),
    A.map(others, (pair): Command => C.SomeoneElse.make(pair)),
    when(world.server.open, C.Match.make({})),
    world.server.open ? each(unanswered, (which) => C.ServerTakesSave.make({ which })) : [],
    each(
      (save) => O.isSome(save.answer),
      (which) => C.SaveAnswers.make({ which })
    ),
    each(
      () => true,
      (which) => C.SaveFails.make({ which })
    ),
    each(unanswered, (which) => C.SaveRefused.make({ which })),
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
    when(may.tabs, C.Reload.make({})),
    may.tabs ? each(unanswered, (which) => C.SaveSignedOut.make({ which })) : [],
    may.tabs && draft.onScreen
      ? A.flatMap(pairs, (pair) =>
          A.flatMap(["no", "refused", "another"] as const, (beside) =>
            A.map(["waiting", "landed", "refused"] as const, (as): Command => C.TakeUp.make({ ...pair, beside, as }))
          )
        )
      : [],
    when(may.tabs && O.isSome(world.kept) && pending(draft).length > 1, C.Removed.make({})),
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
    when(may.elsewhere && !world.server.open, C.SomeoneReopens.make({}))
  ]
  return A.filter(kinds, A.isReadonlyArrayNonEmpty)
}

/** The review opened on an import with these decisions, as the page opens it: the view read first, then the step. */
export const opened = (decisions: SavedDecisions): World => {
  const world = start(decisions)
  runIn(world, Command.cases.ComeBack.make({}))
  return world
}

/** The first thing that does not hold when `commands` are played from an opened review, in words; none if all holds. */
export const broken = (commands: ReadonlyArray<Command>): O.Option<string> => {
  const world = opened({})
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
const shortest = (commands: ReadonlyArray<Command>): ReadonlyArray<Command> => {
  const without = A.findFirst(
    A.map(commands, (_, n) => A.remove(commands, n)),
    (fewer) => O.isSome(broken(fewer))
  )
  return O.match(without, { onNone: () => commands, onSome: shortest })
}

const Choice = S.Int.check(S.isBetween({ minimum: 0, maximum: 999 }))
/** Which kind of thing happens next, and which of that kind: each drawn from what is enabled when its turn comes. */
export const Choices = S.Array(S.Tuple([Choice, Choice])).check(S.isMinLength(30), S.isMaxLength(60))

/**
 * Draws each command from what is enabled when its turn comes, then checks the whole ordering. A failure is thrown
 * under its shortest ordering, as words, with what did not hold.
 */
const playIn = (choices: typeof Choices.Type, may: Play): void => {
  const world = opened({})
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
  if (O.isNone(broken(commands))) return
  const ordering = shortest(commands)
  throw new Error(
    `${A.join(
      A.map(ordering, (command) => Formatter.format(command)),
      ", "
    )}\n${O.getOrElse(broken(ordering), () => "")}`
  )
}

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
