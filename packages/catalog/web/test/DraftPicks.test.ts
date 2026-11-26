// What a line offers and what a pick does: nothing a pick could be undone by this tab's own save on its way, and the
// line then follows what the server holds; a closed tab's refused decision lets the confirm go once the row is decided
// again and saved; a member who can only view is offered nothing that sends; the confirm sends a waiting row before it
// rides; a refused confirm's put-back; the take-back line; what an older page kept; and how many lines are drawn.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Formatter from "effect/Formatter"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import { MatchTakeBack } from "@inventory/catalog-contract/Import"
import {
  type Draft,
  DraftEffect,
  DraftEvent,
  emptyDraft,
  Keep,
  type LineShown,
  linesShown,
  type Side,
  type Stepped,
  step,
  type Waiting
} from "../src/Draft.machine.ts"
import { lineGroups, linesDrawn, lineWords, takeBackLine } from "../src/internal/leftOver.ts"
import { Notice, noticeWords } from "../src/internal/notices.ts"
import { waitingFromText } from "../src/internal/storedWaiting.ts"

type Decision = SavedDecisions[string]

const out = decisionFromFlags({ out: true })
const kept = decisionFromFlags({ kept: true })
const nothing = decisionFromFlags({})
const accepted = decisionFromFlags({ accepted: ["unitCost"] })
const acceptedOut = decisionFromFlags({ out: true, accepted: ["unitCost"] })

const play = (from: Draft, events: ReadonlyArray<DraftEvent>): Stepped =>
  A.reduce(events, { draft: from, effects: [] } as Stepped, (before, event) => {
    const next = step(before.draft, event)
    return { draft: next.draft, effects: [...before.effects, ...next.effects] }
  })
const view = (revision: number, decisions: SavedDecisions) =>
  DraftEvent.ViewArrived({ waiting: false, matches: [], takenBack: [], revision, decisions, open: true, confirms: 0 })
const at4 = (decisions: SavedDecisions) =>
  play(emptyDraft, [DraftEvent.Opened({ kept: O.none() }), view(4, decisions)]).draft
const decide = (rowId: string, decision: O.Option<Decision>) => DraftEvent.Decided({ changes: { [rowId]: decision } })
const answered = (id: number, revision: number) =>
  DraftEvent.SaveAnswered({ id, revision, changed: true, notApplied: [], decidedSince: [] })
const sends = (stepped: Stepped) => A.filter(stepped.effects, DraftEffect.$is("Send"))
const sideStart: Omit<Side, "decision"> = {
  madeOn: 3,
  dates: {},
  seen: [O.none()],
  live: false,
  here: false,
  overtaken: false,
  refused: O.none()
}
const closed = (decision: O.Option<Decision>, parts: Omit<Side, "decision">): Side => ({ decision, ...parts })
const lineOfA = (sides: ReadonlyArray<Side>): Waiting => ({
  rows: {},
  lines: { a: { sides, theirs: O.none() } },
  confirms: O.some(0),
  leftOver: O.none()
})
const takeUp = (kept: Waiting) => DraftEvent.TakenUp({ here: false, kept })
const pick = (keep: Keep) => DraftEvent.Settled({ picks: [{ rowId: "a", keep }] })
const wordsOfA = (draft: Draft, canDecide: boolean) =>
  O.map(R.get(linesShown(draft), "a"), (line) => {
    const { actions, text } = lineWords({ rowId: "a", line, canDecide })
    return { text, labels: A.map(actions, (action) => action.label) }
  })

describe("a line while this tab's own decision of its row is on its way", () => {
  // This tab keeps row a (on its way); a closed tab had left it out; somebody else accepts a proposal on it meanwhile.
  const asking = play(at4({}), [
    decide("a", O.some(kept)),
    takeUp(lineOfA([closed(O.some(out), { ...sideStart })])),
    view(5, { a: accepted })
  ])

  it("offers no pick, and says they wait for its answer: none could be undone by it", () => {
    expect(wordsOfA(asking.draft, true)).toEqual(
      O.some({
        text: "Row a: saved now: accepted the proposal for Unit cost. This tab: kept over the other row with its SKU (being saved). Your closed tab: left out. What to keep can be picked once this tab's decision of it is saved.",
        labels: []
      })
    )
    // A press made anyway (a button drawn a moment before) does nothing.
    const pressed = step(asking.draft, pick(Keep.Theirs()))
    expect([pressed.draft.lines, sends(pressed)]).toEqual([asking.draft.lines, []])
  })

  it("then follows what the server holds: this tab's saved decision against the closed tab's, said as this tab's", () => {
    const saved = step(asking.draft, answered(1, 6))
    expect(wordsOfA(saved.draft, true)).toEqual(
      O.some({
        text: "Row a: This tab: kept over the other row with its SKU. Your closed tab: left out.",
        labels: ["Keep this tab's", "Use the closed tab's"]
      })
    )
  })

  it("is left out of a press for many, which says how many it covers", () => {
    const line = (going: O.Option<O.Option<Decision>>): LineShown => ({
      sides: [closed(O.some(out), { ...sideStart, here: true, overtaken: true })],
      theirs: O.some(kept).pipe(O.some),
      going,
      since: true
    })
    const groups = lineGroups({
      lines: { "row-1": line(O.none()), "row-2": line(O.none()), "row-3": line(O.some(kept).pipe(O.some)) },
      canDecide: true
    })
    expect(
      A.map(groups, (group) => A.map(group.all, (all) => [all.label, A.map(all.picks, (one) => one.rowId)]))
    ).toEqual([
      [
        ["Use mine for all 2", ["row-1", "row-2"]],
        ["Keep theirs for all 2", ["row-1", "row-2"]]
      ]
    ])
  })
})

describe("a closed tab's refused decision of a row", () => {
  it("lets the confirm go once she has decided that row again and it is saved", () => {
    const refused = closed(O.some(out), { ...sideStart, refused: O.some("Your role was changed.") })
    const decided = play(at4({}), [takeUp(lineOfA([refused])), decide("a", O.some(kept))])
    // While her decision is on its way the refused one is still on the line: she sees it as she decides.
    expect(R.has(decided.draft.lines, "a")).toBe(true)
    const saved = step(decided.draft, answered(1, 5))
    expect(saved.draft.lines).toEqual({})
    expect(A.some(step(saved.draft, DraftEvent.ConfirmPressed()).effects, DraftEffect.$is("Confirm"))).toBe(true)
  })

  it("decided again and refused in this tab too: both are on the line, nothing is sent, the confirm waits", () => {
    const refused = closed(O.some(out), { ...sideStart, refused: O.some("Your role was changed.") })
    const decided = play(at4({}), [takeUp(lineOfA([refused])), decide("a", O.some(kept))])
    const again = step(decided.draft, DraftEvent.SaveRefused({ id: 1, reason: "Your role was changed." }))
    expect(O.map(R.get(again.draft.lines, "a"), (line) => A.map(line.sides, (side) => side.decision))).toEqual(
      O.some([O.some(kept)])
    )
    expect(A.some(step(again.draft, DraftEvent.ConfirmPressed()).effects, DraftEffect.$is("Confirm"))).toBe(false)
  })
})

describe("a member who can only view", () => {
  it("is offered no pick of a closed tab's decision, nor of this tab's, nor one press that sends many", () => {
    const line: LineShown = {
      sides: [closed(O.some(kept), { ...sideStart, here: true }), closed(O.some(out), { ...sideStart })],
      theirs: O.some(O.some(accepted)),
      going: O.none(),
      since: true
    }
    expect(A.map(lineWords({ rowId: "row-1", line, canDecide: false }).actions, (one) => one.label)).toEqual([
      "Keep theirs"
    ])
    const groups = lineGroups({ lines: { "row-1": line, "row-2": line }, canDecide: false })
    expect(A.flatMap(groups, (group) => A.map(group.all, (all) => all.label))).toEqual(["Keep theirs for all 2"])
  })
})

describe("the confirm and a row that waits", () => {
  it("sends the row first where what it stands over is not the picture the confirm names, and confirms after", () => {
    // Her kept of row a waits over an accept a match took back since: the picture holds what the match left (left
    // out), which the screen explains, but the server must judge the row before a confirm names that picture.
    const side: Side = { ...closed(O.some(kept), { ...sideStart, seen: [O.some(acceptedOut)] }), here: true }
    const draft: Draft = {
      ...at4({ a: out }),
      matches: [4],
      takenBack: [{ revision: 4, rows: ["a"] }],
      unsent: { a: side }
    }
    const pressed = step(draft, DraftEvent.ConfirmPressed())
    expect([
      A.map(pressed.effects, DraftEffect.$is("Send")),
      pressed.draft.confirm,
      A.map(sends(pressed), (send) => send.over)
    ]).toEqual([[true], "waiting", [{ a: [O.some(acceptedOut)] }]])
  })

  it("refused for an accept taken back, a row left with nothing goes as a put-back where the server holds more", () => {
    // Row a is kept on the server; she accepted a proposal on it instead, and the confirm carried that.
    const side: Side = {
      ...closed(O.some(accepted), { ...sideStart, seen: [O.some(kept)], madeOn: 4 }),
      here: true,
      live: true
    }
    const confirmed = step({ ...at4({ a: kept }), unsent: { a: side } }, DraftEvent.ConfirmPressed())
    expect(A.map(confirmed.effects, DraftEffect.$is("Confirm"))).toEqual([true])
    const stale = step(
      confirmed.draft,
      DraftEvent.ConfirmStale({
        id: confirmed.draft.lastId,
        accepts: [{ rowId: "a", field: "unitCost", kind: "accept" as const }]
      })
    )
    expect(A.map(sends(stale), (send) => send.delta)).toEqual([{ set: { a: nothing }, clear: [] }])
  })
})

describe("the line that names what a match took back", () => {
  // @effect-diagnostics-next-line schemaSync:off
  const taken = S.decodeSync(MatchTakeBack)({
    revision: 7,
    by: "Marcus Oyelaran",
    field: "unitCost",
    kind: "accept",
    count: 3,
    rows: ["row-4", "row-9", "row-12"]
  })

  it("names the rows not decided again, and tells only somebody who can decide to decide again", () => {
    const decisions = { "row-9": accepted }
    expect([
      takeBackLine({ taken, decisions, canDecide: true }),
      takeBackLine({ taken, decisions, canDecide: false })
    ]).toEqual([
      O.some(
        "Marcus Oyelaran matched Unit cost again: 2 accepted proposals were taken back, on rows 4 and 12. Each row shows what it reads now, to decide again."
      ),
      O.some(
        "Marcus Oyelaran matched Unit cost again: 2 accepted proposals were taken back, on rows 4 and 12. Each row shows what it reads now."
      )
    ])
  })

  it("is gone once every row of it was decided again", () => {
    const decisions = { "row-4": accepted, "row-9": accepted, "row-12": acceptedOut }
    expect(takeBackLine({ taken, decisions, canDecide: true })).toEqual(O.none())
  })
})

describe("what an older page kept", () => {
  const older = (held: object, rows: object): O.Option<Waiting> =>
    waitingFromText(
      O.some(Formatter.formatJson({ madeOn: { "row-12": 4 }, leftOver: false, rows, held: { "row-12": held } }))
    )
  const read = (kept: O.Option<Waiting>) =>
    O.map(kept, (waits) =>
      R.map(waits.lines, (line) => ({
        sides: A.map(line.sides, (side) => [side.decision, side.here, side.overtaken] as const),
        theirs: line.theirs
      }))
    )

  it("reads a row held as decided elsewhere as this tab's decision against theirs", () => {
    expect(
      read(older({ mine: { out: true }, madeOn: 3, why: { kind: "elsewhere", theirs: { kept: true } } }, {}))
    ).toEqual(O.some({ "row-12": { sides: [[O.some(out), true, true]], theirs: O.some(O.some(kept)) } }))
  })

  it("reads a row held for closed tabs, with no decision of this tab's named, as the closed tabs' line alone", () => {
    const closedOnes = [{ decision: { out: true }, madeOn: 3, seen: null, refused: null }]
    expect(
      read(
        older(
          { mine: { kept: true }, madeOn: 3, why: { kind: "othertab" }, closed: closedOnes },
          { "row-12": { kept: true } }
        )
      )
    ).toEqual(O.some({ "row-12": { sides: [[O.some(out), false, false]], theirs: O.none() } }))
  })
})

describe("what a tab is told of its decisions taken up", () => {
  it("names rows that were only to be named as not part of the import, and the others as taken up", () => {
    const at = 0
    const of = { importId: "imp_1", fileName: O.some("items_messy.csv"), rows: ["row-12"], at }
    expect([
      noticeWords(Notice.cases.TakenUp.make({ ...of, named: O.some(true) })).text,
      noticeWords(Notice.cases.TakenUp.make(of)).text
    ]).toEqual([
      "Row 12 of items_messy.csv: your decision was not part of the import that was confirmed, and another tab of yours names it now.",
      "Row 12 of items_messy.csv: another tab of yours has your decision now, and this tab no longer does."
    ])
  })
})

describe("the lines of one kind", () => {
  it("are drawn ten at first, the rest behind a press that says how many are left", () => {
    const lines = A.makeBy(23, (n) => `row-${n}`)
    const first = linesDrawn({ lines, drawn: 10 })
    const next = linesDrawn({ lines, drawn: O.getOrThrow(first.more).drawn })
    const last = linesDrawn({ lines, drawn: O.getOrThrow(next.more).drawn })
    expect([
      first.shown.length,
      O.map(first.more, (more) => more.label),
      next.shown.length,
      O.map(next.more, (more) => more.label),
      last.shown.length,
      last.more
    ]).toEqual([10, O.some("Show more of the 13 rows left"), 20, O.some("Show more of the 3 rows left"), 23, O.none()])
  })
})
