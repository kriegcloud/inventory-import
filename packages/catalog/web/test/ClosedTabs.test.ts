// A row decided in more than one tab of the person's (Benjamin, 2026-11-21, "Keep both, she picks"): a row of this tab's
// the server refused beside a closed tab's decision of it stays one line with both, in either order, and nothing is
// sent for it until the person picks; a value the server refused is never sent by a pick. However many tabs decided the
// row, and whatever this tab holds of it, taking a closed tab's entry up loses none of them: each is afterwards on the
// server, waiting, on a line, or named.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Eq from "effect/Equal"
import * as Formatter from "effect/Formatter"
import { pipe } from "effect/Function"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import {
  type ClosedTab,
  decisionsIn,
  type Draft,
  DraftEffect,
  DraftEvent,
  emptyDraft,
  type HeldRow,
  Hold,
  Keep,
  mine,
  type Named,
  Said,
  shown,
  step,
  type Stepped,
  type Waiting,
  waiting
} from "../src/Draft.machine.ts"
import { holdLine, leftOverLines, namedWords } from "../src/internal/leftOver.ts"
import { keptForm, waitingFromText } from "../src/internal/storedWaiting.ts"

const out = decisionFromFlags({ out: true })
const kept = decisionFromFlags({ kept: true })
const keepStored = decisionFromFlags({ stored: "keep" })
const replaced = decisionFromFlags({ stored: "replace" })

/** Events one after another, from a draft: the last step's answer, every effect on the way. */
const play = (from: Draft, events: ReadonlyArray<DraftEvent>): Stepped =>
  A.reduce(events, { draft: from, effects: [] } as Stepped, (before, event) => {
    const next = step(before.draft, event)
    return { draft: next.draft, effects: [...before.effects, ...next.effects] }
  })

const view = (revision: number, decisions: SavedDecisions = {}) =>
  DraftEvent.ViewArrived({ revision, decisions, open: true, confirms: 0 })

/** The step drawn on revision 4, nothing decided. */
const atFour = play(emptyDraft, [DraftEvent.Opened({ kept: O.none() }), view(4)]).draft

const sends = (stepped: Stepped) => A.filter(stepped.effects, DraftEffect.$is("Send"))
const deltas = (stepped: Stepped) => A.map(sends(stepped), (send) => send.delta)

const entry = (parts: Partial<Waiting>): Waiting => ({
  rows: {},
  madeOn: {},
  confirms: O.some(0),
  leftOver: false,
  beside: {},
  seen: {},
  held: {},
  ...parts
})

/** What a closed tab kept of row 12: left out, made on revision 3, begun from nothing and never known to be sent. */
const leftOut = entry({
  rows: { "row-12": O.some(out) },
  madeOn: { "row-12": 3 },
  seen: { "row-12": [O.none(), O.some(out)] }
})
const closedOut: ClosedTab = {
  decision: O.some(out),
  madeOn: 3,
  seen: O.some([O.none(), O.some(out)]),
  refused: O.none()
}

const keeps12 = DraftEvent.Decided({ changes: { "row-12": O.some(kept) } })
const refuse = DraftEvent.SaveRefused({ reason: "Your role was changed." })
const settle = (keep: Keep) => DraftEvent.HoldSettled({ rowId: "row-12", keep })
const useClosed = settle(Keep.Closed({ decision: O.some(out) }))

/** The line both orders end in: this tab's refused, the closed tab's beside it. */
const bothOnTheLine: HeldRow = {
  mine: O.some(kept),
  madeOn: 4,
  why: Hold.Refused({ reason: "Your role was changed." }),
  closed: [closedOut]
}

describe("a refused row beside a closed tab's decision of the same row (Keep both, she picks)", () => {
  it.each([
    [
      "the closed tab's is taken up first, this tab's save is refused after",
      [keeps12, DraftEvent.TakenUp({ kept: leftOut }), refuse]
    ],
    [
      "this tab's row is refused already when the closed tab's is taken up",
      [keeps12, refuse, DraftEvent.TakenUp({ kept: leftOut })]
    ]
  ] as const)("%s: one line with both, and nothing is sent until she picks", (_name, events) => {
    const both = play(atFour, events)
    expect(both.draft.onHold).toEqual({ "row-12": bothOnTheLine })
    // Nothing but this tab's own first save, whatever is read since; and no confirm goes without her pick.
    const later = play(both.draft, [view(4), view(5), DraftEvent.SaveAgain(), DraftEvent.ConfirmPressed()])
    expect([
      sends(later),
      A.some(later.effects, DraftEffect.$is("Confirm")),
      later.draft.heldForLines,
      later.draft.onHold
    ]).toEqual([[], false, true, { "row-12": bothOnTheLine }])
    // Said on the line, not in a toast that goes.
    expect(A.filter(both.effects, DraftEffect.$is("Say"))).toEqual([
      DraftEffect.Say({ what: Said.Refused({ reason: "Your role was changed." }) })
    ])
  })

  const both = play(atFour, [keeps12, refuse, DraftEvent.TakenUp({ kept: leftOut })]).draft

  it("is said with both, and offers a pick of each; a view-only member the pick that sends nothing", () => {
    const line = holdLine({ rowId: "row-12", held: bothOnTheLine, canDecide: true })
    expect(line).toEqual({
      text: "Row 12: this tab: kept over the other row with its SKU (not saved: Your role was changed). Your closed tab: left out.",
      actions: [
        { keep: Keep.Closed({ decision: O.some(out) }), label: "Use the closed tab's" },
        { keep: Keep.Mine(), label: "Keep this tab's" }
      ]
    })
    expect(holdLine({ rowId: "row-12", held: bothOnTheLine, canDecide: false }).actions).toEqual([
      { keep: Keep.Mine(), label: "Keep this tab's" }
    ])
  })

  it("the closed tab's picked: sent as her decision, made on its own revision, once a fresh picture has checked the row", () => {
    const picked = play(both, [useClosed])
    expect([picked.draft.onHold, sends(picked), A.some(picked.effects, DraftEffect.$is("Ask"))]).toEqual([{}, [], true])
    const read = play(picked.draft, [view(4)])
    expect(A.map(sends(read), (send) => [send.delta, send.madeOn])).toEqual([
      [{ set: { "row-12": out }, clear: [] }, { "row-12": 3 }]
    ])
    expect(shown(read.draft)).toEqual({ "row-12": out })
  })

  it("the closed tab's picked after somebody else decided the row: held with theirs, not sent over it", () => {
    const read = play(both, [useClosed, view(5, { "row-12": replaced })])
    expect([sends(read), R.get(read.draft.onHold, "row-12")]).toEqual([
      [],
      O.some({ mine: O.some(out), madeOn: 3, why: Hold.Elsewhere({ theirs: O.some(replaced) }), closed: [] })
    ])
  })

  it("this tab's picked: the closed tab's goes, this tab's stays the ordinary refused line, and nothing is sent, ever", () => {
    const picked = play(both, [settle(Keep.Mine())])
    expect(picked.draft.onHold).toEqual({ "row-12": { ...bothOnTheLine, closed: [] } })
    expect(holdLine({ rowId: "row-12", held: { ...bothOnTheLine, closed: [] }, canDecide: false })).toEqual({
      text: "Row 12: you kept over the other row with its SKU. Not saved: Your role was changed.",
      actions: [{ keep: Keep.Theirs(), label: "Dismiss" }]
    })
    // A second press, reads, Save again: still nothing. Dismissed: it goes, unsent.
    const after = play(picked.draft, [settle(Keep.Mine()), view(5), DraftEvent.SaveAgain(), view(6)])
    expect([sends(after), R.keys(after.draft.onHold)]).toEqual([[], ["row-12"]])
    const dismissed = play(after.draft, [settle(Keep.Theirs()), view(7)])
    expect([sends(dismissed), dismissed.draft.onHold]).toEqual([[], {}])
  })

  it("Dismiss is no pick while both are on the line: it changes nothing", () => {
    expect(play(both, [settle(Keep.Theirs())]).draft.onHold).toEqual({ "row-12": bothOnTheLine })
  })

  it("both refused: picking the closed tab's makes it the ordinary refused line, and sends nothing", () => {
    const theirs = entry({
      held: { "row-12": { mine: O.some(out), madeOn: 3, why: Hold.Refused({ reason: "It is gone." }), closed: [] } }
    })
    const line = play(atFour, [keeps12, refuse, DraftEvent.TakenUp({ kept: theirs })]).draft
    expect(
      A.map(holdLine({ rowId: "row-12", held: line.onHold["row-12"]!, canDecide: false }).actions, (one) => one.label)
    ).toEqual(["Keep the closed tab's", "Keep this tab's"])
    const picked = play(line, [useClosed, view(5)])
    expect([sends(picked), picked.draft.onHold]).toEqual([
      [],
      { "row-12": { mine: O.some(out), madeOn: 3, why: Hold.Refused({ reason: "It is gone." }), closed: [] } }
    ])
  })

  it("comes back after a reload as it was, and the closed tab's is still sent on its own revision", () => {
    const stored = keptForm(waiting(both))
    expect(stored).toEqual(waiting(both))
    const reloaded = play(emptyDraft, [DraftEvent.Opened({ kept: stored }), view(4)])
    expect([sends(reloaded), reloaded.draft.onHold]).toEqual([[], { "row-12": bothOnTheLine }])
    const picked = play(reloaded.draft, [useClosed, view(4)])
    expect(A.map(sends(picked), (send) => [send.delta, send.madeOn])).toEqual([
      [{ set: { "row-12": out }, clear: [] }, { "row-12": 3 }]
    ])
  })

  it("the import closes: the result names both, after a reload too", () => {
    const closed = play(both, [DraftEvent.ViewArrived({ revision: 5, decisions: {}, open: false, confirms: 1 })]).draft
    const named = (draft: Draft): Named => ({ rows: O.getOrThrow(draft.leftOver), beside: draft.leftOverBeside })
    expect(A.map(leftOverLines(named(closed)), (line) => `${line.row}: you ${line.decided}`)).toEqual([
      "Row 12: you kept over the other row with its SKU",
      "Row 12: you left out, in another tab of yours"
    ])
    const reloaded = play(emptyDraft, [DraftEvent.Opened({ kept: keptForm(waiting(closed)) })]).draft
    expect(named(reloaded)).toEqual(named(closed))
  })

  it("the import is confirmed and opened again: both are named, and neither is sent into it", () => {
    const again = play(both, [DraftEvent.ViewArrived({ revision: 6, decisions: {}, open: true, confirms: 1 })])
    const said = A.filter(again.effects, DraftEffect.$is("Say"))
    expect([said, sends(again), again.draft.onHold]).toEqual([
      [
        DraftEffect.Say({
          what: Said.Outlived({ rows: { "row-12": O.some(kept) }, beside: { "row-12": [O.some(out)] } })
        })
      ],
      [],
      {}
    ])
    expect(namedWords({ rows: { "row-12": O.some(kept) }, beside: { "row-12": [O.some(out)] } })).toBe(
      "Row 12: you kept over the other row with its SKU; Row 12: you left out, in another tab of yours"
    )
  })

  it("what an older page kept of a closed tab's decision beside this tab's reads as the same line", () => {
    const old = (held: object) =>
      waitingFromText(
        JSONText({
          madeOn: { "row-12": 4 },
          leftOver: false,
          rows: { "row-12": { kept: true } },
          held: { "row-12": held }
        })
      )
    const line = (refused: O.Option<string>): HeldRow => ({
      mine: O.some(kept),
      madeOn: 4,
      why: Hold.OtherTab(),
      closed: [{ decision: O.some(out), madeOn: 3, seen: O.none(), refused }]
    })
    const asked = old({ mine: { out: true }, madeOn: 3, why: { kind: "othertab", thisTab: { kept: true } } })
    const refused = old({ mine: { out: true }, madeOn: 3, why: { kind: "refused", reason: "No." } })
    expect([O.map(asked, (one) => one.held), O.map(refused, (one) => one.held)]).toEqual([
      O.some({ "row-12": line(O.none()) }),
      O.some({ "row-12": line(O.some("No.")) })
    ])
  })
})

/** A value as the browser keeps it, written by an older page: text of its own, not through this page's schema. */
const JSONText = (value: object): string => Formatter.formatJson(value)

/**
 * Three tabs: A left row 12 out and closed; B had its own decision of it (kept the stored item), held A's beside it and
 * closed; C takes B's entry up. What C holds of the row (nothing, or "kept"), and what must be alive afterwards:
 *
 * | C holds of row 12            | this tab's own on the line | the line also has                          |
 * | ---------------------------- | -------------------------- | ------------------------------------------ |
 * | nothing                      | B's, waiting as it did     | A's                                        |
 * | its own, waiting             | C's, waiting               | B's, A's                                   |
 * | its own, on its way          | C's, on its way            | B's, A's                                   |
 * | its own, decided elsewhere   | C's, and theirs            | B's, A's                                   |
 * | its own, refused             | C's, with the reason       | B's, A's                                   |
 * | a line asking between tabs   | C's                        | D's (it had), B's, A's                     |
 */
describe("three tabs, whatever the last one holds of the row", () => {
  const decisions = (line: O.Option<HeldRow>) =>
    O.match(line, {
      onNone: () => [],
      onSome: (held) => [held.mine, ...A.map(held.closed, (one) => one.decision)]
    })
  /** B's entry: its own decision waiting, A's on the line beside it. */
  const b = play(atFour, [
    DraftEvent.Decided({ changes: { "row-12": O.some(keepStored) } }),
    DraftEvent.SaveFailed(),
    DraftEvent.TakenUp({ kept: leftOut })
  ]).draft
  const ofB = pipe(b, waiting, keptForm, O.getOrThrow)
  const takes = DraftEvent.TakenUp({ kept: ofB })
  const ofD = entry({ rows: { "row-12": O.some(replaced) }, madeOn: { "row-12": 2 } })

  it.each([
    ["nothing", [], "OtherTab", [keepStored, out]],
    ["its own, waiting", [keeps12, DraftEvent.SaveFailed()], "OtherTab", [kept, keepStored, out]],
    ["its own, on its way", [keeps12], "OtherTab", [kept, keepStored, out]],
    [
      "its own, decided elsewhere since",
      [keeps12, DraftEvent.SaveFailed(), view(5, { "row-12": decisionFromFlags({ edits: { name: "Bolt" } }) })],
      "Elsewhere",
      [kept, keepStored, out]
    ],
    ["its own, refused", [keeps12, refuse], "Refused", [kept, keepStored, out]],
    [
      "a line asking between tabs",
      [keeps12, DraftEvent.SaveFailed(), DraftEvent.TakenUp({ kept: ofD })],
      "OtherTab",
      [kept, replaced, keepStored, out]
    ]
  ] as const)(
    "C holds %s: every decision is on the line, and nothing is sent by taking it up",
    (_name, before, why, all) => {
      const c = play(atFour, before).draft
      const taken = play(c, [takes])
      const line = R.get(taken.draft.onHold, "row-12")
      expect(decisions(line)).toEqual(A.map(all, (one) => O.some(one)))
      expect([O.map(line, (held) => Hold.$is(why)(held.why)), sends(taken)]).toEqual([O.some(true), []])
      // Kept by C, and back after a reload.
      expect(keptForm(waiting(taken.draft))).toEqual(waiting(taken.draft))
    }
  )

  it("the line says them all, and the one picked is sent on its own revision", () => {
    const c = play(atFour, [keeps12, refuse, takes]).draft
    const line = holdLine({ rowId: "row-12", held: c.onHold["row-12"]!, canDecide: true })
    expect([line.text, A.map(line.actions, (one) => one.label)]).toEqual([
      "Row 12: this tab: kept over the other row with its SKU (not saved: Your role was changed). Your closed tab 1: kept the stored item. Your closed tab 2: left out.",
      ["Use closed tab 1's", "Use closed tab 2's", "Keep this tab's"]
    ])
    expect(deltas(play(c, [useClosed, view(4)]))).toEqual([{ set: { "row-12": out }, clear: [] }])
  })

  it("decided elsewhere and then the same there: the line goes on asking about the closed tabs', and this tab's stays saved", () => {
    const held = play(atFour, [
      keeps12,
      DraftEvent.SaveFailed(),
      view(5, { "row-12": decisionFromFlags({ edits: { name: "Bolt" } }) }),
      takes
    ]).draft
    const same = play(held, [view(6, { "row-12": kept })])
    expect([decisions(R.get(same.draft.onHold, "row-12")), sends(same)]).toEqual([
      [O.some(kept), O.some(keepStored), O.some(out)],
      []
    ])
    // Keep this tab's: it is on the server already.
    const picked = play(same.draft, [settle(Keep.Mine()), view(7, { "row-12": kept })])
    expect([picked.draft.onHold, sends(picked), shown(picked.draft)]).toEqual([{}, [], { "row-12": kept }])
  })
})

const Row = S.Literals(["a", "b"])
const To = S.Literals(["out", "kept", "stored", "cleared"])
type To = typeof To.Type
const valueOf = (to: To): O.Option<SavedDecisions[string]> =>
  to === "cleared" ? O.none() : O.some(to === "out" ? out : to === "kept" ? kept : keepStored)

/** What can happen in one tab before it takes an entry up, or before it closes and leaves one. */
const Move = S.TaggedUnion({
  Decide: { row: Row, to: To },
  Fails: {},
  Refused: {},
  Answers: {},
  SomeoneElse: { row: Row, to: To },
  Reads: {},
  SignedOut: {},
  Reload: {},
  Confirmed: { open: S.Boolean },
  Picks: { row: Row, which: S.Literals(["mine", "theirs", "first", "second"]) }
})
type Move = typeof Move.Type
const Moves = S.Array(Move).check(S.isMaxLength(6))
/** Tabs one after another: each takes up what the one before left, makes its own moves, and closes. */
const Tabs = S.Array(S.Struct({ drawn: S.Boolean, before: Moves, after: Moves })).check(
  S.isMinLength(2),
  S.isMaxLength(5)
)

interface Server {
  revision: number
  decisions: SavedDecisions
  confirms: number
  open: boolean
  /** Every decision the server has held, by row: what a tab's save or somebody else wrote, overwritten since or not. */
  readonly held: Array<Fact>
}

/** One decision of one row, as a fact to be found again. */
type Fact = readonly [row: string, decision: O.Option<SavedDecisions[string]>]

/** Every decision a tab holds that the server has not taken: each row waiting or on its way, and each side of a line. */
const factsOf = (draft: Draft): ReadonlyArray<Fact> =>
  O.match(waiting(draft), { onNone: (): ReadonlyArray<Fact> => [], onSome: factsIn })

/**
 * Every decision in what a tab kept that the server has not taken: its rows, its holds with every side they carry, and
 * what it left over. A line that asks between tabs carries this tab's own decision too: where that does not wait in
 * `rows`, it is saved (`savedIn`).
 */
const factsIn = (kept: Waiting): ReadonlyArray<Fact> => [
  ...factsOfNamed(kept),
  ...A.flatMap(R.toEntries(kept.held), ([row, held]): ReadonlyArray<Fact> => [
    ...(Hold.$is("OtherTab")(held.why) ? [] : [[row, held.mine] as const]),
    ...A.map(held.closed, (one): Fact => [row, one.decision])
  ])
]

/** This tab's own decisions on lines that ask between tabs, where they do not wait: the server held each. */
const savedIn = (kept: Waiting): ReadonlyArray<Fact> =>
  A.flatMap(R.toEntries(kept.held), ([row, held]): ReadonlyArray<Fact> =>
    Hold.$is("OtherTab")(held.why) && !R.has(kept.rows, row) ? [[row, held.mine]] : []
  )

const has = (facts: ReadonlyArray<Fact>, [row, decision]: Fact): boolean =>
  A.some(facts, ([ofRow, one]) => ofRow === row && Eq.equals(one, decision))

/** Every decision in a naming. */
const factsOfNamed = (named: Named): ReadonlyArray<Fact> => [
  ...R.toEntries(named.rows),
  ...A.flatMap(R.toEntries(named.beside), ([row, others]) => A.map(others, (one): Fact => [row, one]))
]

/** Every decision the person is told of by what a step says. */
const factsNamed = (effects: ReadonlyArray<DraftEffect>): ReadonlyArray<Fact> => {
  const said = A.map(A.filter(effects, DraftEffect.$is("Say")), (say) => say.what)
  return A.flatMap(A.filter(said, Said.$is("Outlived")), factsOfNamed)
}

/** What a tab knows the server to hold of a row: the picture it holds, its saved rows over it, or the one it ended on. */
const onServer = (draft: Draft, server: Server, [row, decision]: Fact): boolean => {
  const holds = (decisions: SavedDecisions): boolean => Eq.equals(R.get(decisions, row), decision)
  return (
    holds(server.decisions) ||
    (draft.ended && holds(draft.endedOn)) ||
    O.exists(draft.held, (held) => holds(held.decisions)) ||
    O.exists(draft.landed, (landed) => Eq.equals(R.get(landed.rows, row), O.some(decision)))
  )
}

/** The server writes rows: from now on it has held them. */
const writes = (server: Server, rows: Named["rows"]): void => {
  server.revision += 1
  server.decisions = R.getSomes({ ...R.map(server.decisions, O.some), ...rows })
  server.held.push(...R.toEntries(rows))
}

/** One move in a tab: the events it is, and what it does to the server. */
const eventsOf = (draft: Draft, server: Server, move: Move): ReadonlyArray<DraftEvent> => {
  const arrives = (): ReadonlyArray<DraftEvent> => [
    DraftEvent.ViewArrived({
      revision: server.revision,
      decisions: server.decisions,
      open: server.open,
      confirms: server.confirms
    })
  ]
  return Move.match(move, {
    Decide: ({ row, to }) =>
      O.isSome(draft.held) && !draft.ended ? [DraftEvent.Decided({ changes: { [row]: valueOf(to) } })] : [],
    Fails: () => [DraftEvent.SaveFailed()],
    SignedOut: () => [DraftEvent.SaveSignedOut()],
    Refused: () => [refuse],
    Answers: () =>
      O.match(draft.flight, {
        onNone: () => [],
        onSome: (rows) => {
          if (!server.open) return [refuse]
          writes(server, rows)
          return [DraftEvent.SaveAnswered({ revision: server.revision, changed: true, notApplied: [] })]
        }
      }),
    SomeoneElse: ({ row, to }) => {
      writes(server, { [row]: valueOf(to) })
      return []
    },
    Reads: arrives,
    Reload: () => [],
    Confirmed: ({ open }) => {
      server.revision += 1
      server.confirms += 1
      server.open = open
      return []
    },
    Picks: ({ row, which }) =>
      O.match(R.get(draft.onHold, row), {
        onNone: () => [],
        onSome: (held) => {
          const closed = held.closed[which === "second" ? 1 : 0]
          const keep =
            which === "mine"
              ? Keep.Mine()
              : which === "theirs"
                ? Keep.Theirs()
                : Keep.Closed({ decision: closed === undefined ? O.none() : closed.decision })
          return [DraftEvent.HoldSettled({ rowId: row, keep })]
        }
      })
  })
}

/** One tab makes its moves: a value the server refused is never sent again by a pick. */
const moves = (draft: Draft, server: Server, several: ReadonlyArray<Move>): Draft =>
  A.reduce(several, draft, (before, move) => {
    if (Move.guards.Reload(move)) {
      const stored = waiting(before)
      expect(keptForm(stored), "what the browser keeps is not what comes back after a reload").toEqual(stored)
      return step(emptyDraft, DraftEvent.Opened({ kept: stored })).draft
    }
    return A.reduce(eventsOf(before, server, move), before, (now, event) => {
      const stepped = step(now, event)
      if (DraftEvent.$is("HoldSettled")(event)) {
        const line = R.get(now.onHold, event.rowId)
        const refused = O.match(line, {
          onNone: (): ReadonlyArray<Fact> => [],
          onSome: (held) => [
            ...(Hold.$is("Refused")(held.why) ? [[event.rowId, held.mine] as const] : []),
            ...A.flatMap(held.closed, (one): ReadonlyArray<Fact> =>
              O.isSome(one.refused) ? [[event.rowId, one.decision]] : []
            )
          ]
        })
        const pending = R.toEntries(mine(stepped.draft))
        for (const fact of refused) {
          if (R.has(mine(now), event.rowId)) continue
          expect(has(pending, fact), "a pick sends a decision the server refused").toBe(false)
        }
      }
      return stepped.draft
    })
  })

describe("a closed tab's entry taken up, whatever each tab held", () => {
  it.prop(
    "loses no decision: each that was in the entry (rows, holds and every side of them) or in this tab is afterwards on the server, waiting, on a line, or named",
    { tabs: Tabs },
    ({ tabs }) => {
      const server: Server = { revision: 4, decisions: {}, confirms: 0, open: true, held: [] }
      let entryLeft: O.Option<Waiting> = O.none()
      for (const tab of tabs) {
        const opened = step(emptyDraft, DraftEvent.Opened({ kept: O.none() })).draft
        const first = tab.drawn ? moves(opened, server, [Move.cases.Reads.make({})]) : opened
        const draft = moves(first, server, tab.before)
        const after = O.match(entryLeft, {
          onNone: () => draft,
          onSome: (left) => {
            const taken = step(draft, DraftEvent.TakenUp({ kept: left }))
            const now = [
              ...factsOf(taken.draft),
              ...factsNamed(taken.effects),
              ...factsOfNamed({
                rows: O.getOrElse(taken.draft.leftOver, (): Named["rows"] => ({})),
                beside: taken.draft.leftOverBeside
              })
            ]
            for (const fact of [...factsIn(left), ...factsOf(draft)]) {
              expect(
                has(now, fact) || onServer(taken.draft, server, fact),
                `taken up, ${Formatter.format(fact)} is neither on the server, waiting, on a line nor named`
              ).toBe(true)
            }
            // What an entry's line says this tab of hers had saved was saved: nothing unsaved is taken for it.
            for (const fact of savedIn(left)) {
              expect(
                has(server.held, fact) || O.isNone(fact[1]),
                `${Formatter.format(fact)} is taken for saved, and the server never held it`
              ).toBe(true)
            }
            // Nothing of a row whose line asks is on its way because of it.
            for (const send of A.filter(taken.effects, DraftEffect.$is("Send"))) {
              for (const row of [...R.keys(send.delta.set), ...send.delta.clear]) {
                expect(R.has(taken.draft.onHold, row), `row ${row} is sent while its line asks`).toBe(false)
              }
            }
            // Every decision the entry names is one of those kept for the result or a notice, too.
            for (const [row, decision] of R.toEntries(decisionsIn(left).rows)) {
              expect(has(factsIn(left), [row, decision]), "a decision is named that nobody made").toBe(true)
            }
            return taken.draft
          }
        })
        entryLeft = keptForm(waiting(moves(after, server, tab.after)))
      }
    },
    { timeout: 120_000, arbitrary: { runs: 5000, size: 40 } }
  )
})
