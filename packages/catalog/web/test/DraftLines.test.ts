// The person's decisions the server has not taken, as one pure transition: a row that waited goes with what it may be
// written over, and the server says when somebody decided it since; what the server may hold of a row is trimmed by
// each answer; an answer settles only its own save; and every row has one line, of one shape, while more than one
// answer of it is alive or one was refused: named whole when the import closes, never sent by itself while it asks,
// and never holding this tab's ready decision for a closed tab's refused one.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Formatter from "effect/Formatter"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import {
  type Draft,
  DraftEffect,
  DraftEvent,
  decisionsIn,
  emptyDraft,
  Keep,
  type LineShown,
  type Side,
  shown,
  type Stepped,
  step,
  type Waiting,
  waiting
} from "../src/Draft.machine.ts"
import { lineGroups, linesAsk, lineWords } from "../src/internal/leftOver.ts"
import { keptForm, waitingFromText } from "../src/internal/storedWaiting.ts"

type Decision = SavedDecisions[string]

const out = decisionFromFlags({ out: true })
const kept = decisionFromFlags({ kept: true })
const nothing = decisionFromFlags({})
const accepted = decisionFromFlags({ accepted: ["unitCost"] })
const acceptedOut = decisionFromFlags({ out: true, accepted: ["unitCost"] })
const keptAccepted = decisionFromFlags({ kept: true, accepted: ["unitCost"] })
const notApplied = [{ rowId: "a", field: "unitCost", kind: "accept" as const }]

/** Events one after another, from a draft: the last draft, and every effect on the way. */
const play = (from: Draft, events: ReadonlyArray<DraftEvent>): Stepped =>
  A.reduce(events, { draft: from, effects: Array<Stepped["effects"][number]>() } satisfies Stepped, (before, event) => {
    const next = step(before.draft, event)
    return { draft: next.draft, effects: [...before.effects, ...next.effects] }
  })

const view = (revision: number, decisions: SavedDecisions, matches: ReadonlyArray<number>) =>
  DraftEvent.ViewArrived({ waiting: false, takenBack: [], revision, decisions, open: true, confirms: 0, matches })

/** The Review step drawn over revision 4, with these decisions stored. */
const at4 = (decisions: SavedDecisions) =>
  play(emptyDraft, [DraftEvent.Opened({ kept: O.none() }), view(4, decisions, [])]).draft

const decide = (rowId: string, decision: O.Option<Decision>) => DraftEvent.Decided({ changes: { [rowId]: decision } })
const sends = (stepped: Stepped) => A.filter(stepped.effects, DraftEffect.$is("Send"))
const lastSend = (stepped: Stepped) => A.last(sends(stepped))

interface Answer {
  readonly changed: boolean
  readonly decidedSince: ReadonlyArray<{ readonly rowId: string; readonly theirs: O.Option<Decision> }>
  readonly notApplied: ReadonlyArray<{ readonly rowId: string; readonly field: string; readonly kind: "accept" }>
}
const answerStart: Answer = { changed: true, notApplied: [], decidedSince: [] }
const answered = (id: number, revision: number, more: Answer) => DraftEvent.SaveAnswered({ id, revision, ...more })

/** One decision a closed tab kept of row a: made on revision 3, over what it saw. */
const closedStart: Omit<Side, "decision"> = {
  madeOn: 3,
  dates: {},
  seen: [O.none()],
  live: false,
  here: false,
  overtaken: false,
  refused: O.none()
}
const closed = (decision: O.Option<Decision>, parts: Omit<Side, "decision">): Side => ({ decision, ...parts })

/** What a closed tab kept. */
const entry = (parts: Partial<Waiting>): Waiting => ({
  rows: {},
  lines: {},
  confirms: O.some(0),
  leftOver: O.none(),
  ...parts
})
const lineOfA = (sides: ReadonlyArray<Side>): Waiting => entry({ lines: { a: { sides, theirs: O.none() } } })
const takeUp = (kept: Waiting) => DraftEvent.TakenUp({ here: false, kept })
const pick = (keep: Keep) => DraftEvent.Settled({ picks: [{ rowId: "a", keep }] })

/** Row a's line as the screen reads it: each side's decision, whether it is this tab's and refused; and theirs. */
const lineOf = (draft: Draft) =>
  O.map(R.get(draft.lines, "a"), (line) => ({
    sides: A.map(line.sides, (side) => [side.decision, side.here, O.isSome(side.refused)] as const),
    theirs: line.theirs
  }))

describe("a row that waited (the server decides whether it may be written)", () => {
  it("goes with what it may be written over, and a press that never waited goes without; nothing is asked first", () => {
    const failed = play(at4({}), [decide("a", O.some(out)), DraftEvent.SaveFailed({ id: 1 })])
    expect(step(failed.draft, decide("b", O.some(kept))).effects).toEqual([
      DraftEffect.Send({
        id: 2,
        delta: { set: { a: out, b: kept }, clear: [] },
        madeOn: { a: 4, b: 4 },
        // What the server may hold of it from this tab: what it held when she began, and the leave-out sent before.
        over: { a: [O.none(), O.some(out)] }
      })
    ])
  })

  it("is not sent by the picture given again while the import is asked anew; the next answer sends it over what it may hold", () => {
    const failed = play(at4({}), [decide("a", O.some(out)), DraftEvent.SaveFailed({ id: 1 })]).draft
    const again = step(
      failed,
      DraftEvent.ViewArrived({
        matches: [],
        takenBack: [],
        revision: 4,
        decisions: {},
        open: true,
        confirms: 0,
        waiting: true
      })
    )
    expect(sends(again)).toEqual([])
    expect(O.map(lastSend(step(again.draft, view(5, { b: kept }, []))), (send) => send.over)).toEqual(
      O.some({ a: [O.none(), O.some(out)] })
    )
  })

  it("decided since by somebody else, as the server answers, is a line with theirs, and is not sent again by itself", () => {
    const sent = play(at4({}), [decide("a", O.some(out)), DraftEvent.SaveFailed({ id: 1 }), decide("b", O.some(kept))])
    const told = step(
      sent.draft,
      answered(2, 6, { ...answerStart, decidedSince: [{ rowId: "a", theirs: O.some(kept) }] })
    )
    expect(lineOf(told.draft)).toEqual(O.some({ sides: [[O.some(out), true, false]], theirs: O.some(O.some(kept)) }))
    expect(shown(told.draft)["a"]).toEqual(kept)
    expect(A.flatMap(sends(told), (send) => R.keys(send.delta.set))).toEqual([])
  })

  it("behind a save whose answer says somebody saved in between is no live press: it goes with what it may be written over", () => {
    const behind = play(at4({}), [decide("a", O.some(out)), decide("b", O.some(kept))])
    // Revision 6, two on from the picture held: somebody else saved in between.
    expect(
      O.map(lastSend(step(behind.draft, answered(1, 6, { ...answerStart }))), (send) => [send.delta.set, send.over])
    ).toEqual(O.some([{ b: kept }, { b: [O.none()] }]))
  })

  it("over nothing, beside a picture that holds a decision with nothing in it, is not on a line: nobody decided it", () => {
    const failed = play(at4({}), [decide("a", O.some(out)), DraftEvent.SaveFailed({ id: 1 })]).draft
    const arrived = step(failed, view(5, { a: nothing }, []))
    expect([lineOf(arrived.draft), A.length(sends(arrived))]).toEqual([O.none(), 1])
  })

  it("over a stored decision a match took part of back is not on a line: the take-back is nobody's decision", () => {
    const failed = play(at4({ a: accepted }), [decide("a", O.some(keptAccepted)), DraftEvent.SaveFailed({ id: 1 })])
    // The match takes the stored accept back at revision 5, and names row a.
    const taken = DraftEvent.ViewArrived({
      waiting: false,
      revision: 5,
      decisions: { a: nothing },
      open: true,
      confirms: 0,
      matches: [5],
      takenBack: [{ revision: 5, rows: ["a"] }]
    })
    const arrived = step(failed.draft, taken)
    expect([lineOf(arrived.draft), A.length(sends(arrived))]).toEqual([O.none(), 1])
    // The same change with no take-back named is somebody's decision: it is said on a line.
    const elsewhere = step(failed.draft, view(5, { a: nothing }, []))
    expect(O.map(lineOf(elsewhere.draft), (line) => line.theirs)).toEqual(O.some(nothing).pipe(O.some, O.some))
  })
})

describe("what the server may hold of a row", () => {
  it("is trimmed to what an answer says it stored, for a decision made while that save was out", () => {
    const behind = play(at4({}), [decide("a", O.some(out)), decide("a", O.some(kept))])
    expect(O.map(lastSend(step(behind.draft, answered(1, 6, { ...answerStart }))), (send) => send.over)).toEqual(
      O.some({ a: [O.some(out)] })
    )
  })

  it("is what an answer stored, for a decision made after it", () => {
    const after = play(at4({}), [
      decide("a", O.some(out)),
      answered(1, 6, { ...answerStart }),
      decide("a", O.some(kept))
    ])
    expect(O.map(lastSend(after), (send) => send.over)).toEqual(O.some({ a: [O.some(out)] }))
  })
})

describe("an answer belongs to its save", () => {
  it("of another id settles nothing", () => {
    const sent = step(at4({}), decide("a", O.some(out))).draft
    for (const event of [
      answered(9, 5, { ...answerStart }),
      DraftEvent.SaveFailed({ id: 9 }),
      DraftEvent.SaveRefused({ id: 9, reason: "No." })
    ]) {
      expect(step(sent, event).draft).toEqual(sent)
    }
  })

  it("of a save sent before the draft started again settles nothing of the next one, whose id is new", () => {
    const sent = step(at4({}), decide("a", O.some(out))).draft
    // Somebody confirms and opens the import again while the save is out: the draft starts again.
    const reopened = play(sent, [
      DraftEvent.ViewArrived({
        waiting: false,
        matches: [],
        takenBack: [],
        revision: 5,
        decisions: {},
        open: false,
        confirms: 1
      }),
      DraftEvent.ViewArrived({
        waiting: false,
        matches: [],
        takenBack: [],
        revision: 6,
        decisions: {},
        open: true,
        confirms: 1
      }),
      decide("b", O.some(kept))
    ])
    expect(O.map(lastSend(reopened), (send) => send.id)).toEqual(O.some(2))
    expect(O.map(step(reopened.draft, answered(1, 7, { ...answerStart })).draft.flight, (flight) => flight.id)).toEqual(
      O.some(2)
    )
  })
})

describe("one line per row", () => {
  /** This tab decided row a and the server has it; then a closed tab's left-out of it, over nothing, is taken up. */
  // (As that tab kept it, the decision was its own: here it is a closed tab's.)
  const takenUp = play(at4({}), [
    decide("a", O.some(kept)),
    answered(1, 5, { ...answerStart }),
    takeUp(entry({ rows: { a: closed(O.some(out), { ...closedStart, here: true }) } }))
  ])

  it("follows what the server holds: theirs follows each picture, and a side the server comes to hold goes", () => {
    expect(lineOf(takenUp.draft)).toEqual(
      O.some({ sides: [[O.some(out), false, false]], theirs: O.some(O.some(kept)) })
    )
    const moved = step(takenUp.draft, view(6, { a: acceptedOut }, []))
    expect(O.map(lineOf(moved.draft), (line) => line.theirs)).toEqual(O.some(acceptedOut).pipe(O.some, O.some))
    // The server holds the closed tab's: the line goes, and nothing is sent again for it.
    const held = step(moved.draft, view(7, { a: out }, []))
    expect([lineOf(held.draft), sends(held)]).toEqual([O.none(), []])
  })

  it("is named whole when somebody else confirms the import: each side, and theirs", () => {
    const ended = step(
      takenUp.draft,
      DraftEvent.ViewArrived({
        waiting: false,
        matches: [],
        takenBack: [],
        revision: 6,
        decisions: { a: kept },
        open: false,
        confirms: 1
      })
    )
    expect(ended.draft.leftOver).toEqual(O.some({ rows: { a: O.some(out) }, beside: {}, theirs: { a: O.some(kept) } }))
  })

  it("with this tab's and a closed tab's decisions is named whole when the import closes, is removed, or outlives a confirm", () => {
    // This tab kept row a and the save failed; a closed tab's left-out of it is taken up beside it.
    const asks = play(at4({}), [
      decide("a", O.some(kept)),
      DraftEvent.SaveFailed({ id: 1 }),
      takeUp(entry({ rows: { a: closed(O.some(out), { ...closedStart }) } }))
    ]).draft
    expect(lineOf(asks)).toEqual(
      O.some({
        sides: [
          [O.some(kept), true, false],
          [O.some(out), false, false]
        ],
        theirs: O.none()
      })
    )
    const whole = { rows: { a: O.some(kept) }, beside: { a: [O.some(out)] }, theirs: {} }
    expect(
      step(
        asks,
        DraftEvent.ViewArrived({
          waiting: false,
          matches: [],
          takenBack: [],
          revision: 5,
          decisions: {},
          open: false,
          confirms: 1
        })
      ).draft.leftOver
    ).toEqual(O.some(whole))
    // Removed: what this browser keeps of it is named, whole.
    expect(O.map(waiting(asks), decisionsIn)).toEqual(O.some(whole))
    // Confirmed and opened again: said, whole, and not sent into it.
    const outlived = step(
      asks,
      DraftEvent.ViewArrived({
        waiting: false,
        matches: [],
        takenBack: [],
        revision: 6,
        decisions: {},
        open: true,
        confirms: 1
      })
    )
    expect([
      A.filter(outlived.effects, DraftEffect.$is("Say")).length,
      A.length(sends(outlived)),
      outlived.draft.lines
    ]).toEqual([1, 0, {}])
  })

  it("takes up a closed tab's decision of a row that has a line as another side of it", () => {
    const two = play(at4({}), [
      takeUp(lineOfA([closed(O.some(out), { ...closedStart }), closed(O.some(kept), { ...closedStart })])),
      takeUp(entry({ rows: { a: closed(O.some(accepted), { ...closedStart }) } }))
    ])
    expect(lineOf(two.draft)).toEqual(
      O.some({
        sides: [
          [O.some(out), false, false],
          [O.some(kept), false, false],
          [O.some(accepted), false, false]
        ],
        theirs: O.none()
      })
    )
  })

  it("reads two closed tabs' same decision, an empty one and none included, as one side", () => {
    // Over the row as stored (kept), so neither is what the server holds.
    const over = { ...closedStart, seen: [O.some(kept)] }
    const both = play(at4({ a: kept }), [
      takeUp(lineOfA([closed(O.some(nothing), over), closed(O.some(out), over)])),
      takeUp(entry({ rows: { a: closed(O.none(), over) } }))
    ])
    expect(O.map(lineOf(both.draft), (line) => line.sides.length)).toEqual(O.some(2))
  })

  it("never holds this tab's ready decision for a closed tab's refused one: this tab's goes, the refused one stays to be dismissed", () => {
    const refused = closed(O.some(out), { ...closedStart, refused: O.some("Your role was changed.") })
    const decided = play(at4({}), [takeUp(lineOfA([refused])), decide("a", O.some(kept))])
    expect(O.map(lastSend(decided), (send) => send.delta.set)).toEqual(O.some({ a: kept }))
    expect(lineOf(decided.draft)).toEqual(O.some({ sides: [[O.some(out), false, true]], theirs: O.none() }))
  })

  it("picking a closed tab's side sends it over what that tab, and the side she lets go, may have put there; never what another tab only saw", () => {
    // Closed tab 1 left row a out over nothing; closed tab 2 kept it over what it saw, sent that, and never heard back.
    const saw = O.some(decisionFromFlags({ edits: { name: "Rope" } }))
    const sides = [
      closed(O.some(out), { ...closedStart }),
      closed(O.some(kept), { ...closedStart, seen: [saw, O.some(kept)] })
    ]
    const picked = play(at4({}), [takeUp(lineOfA(sides)), pick(Keep.Side({ decision: O.some(out) }))])
    expect(O.map(lastSend(picked), (send) => [send.delta.set, send.over, send.madeOn])).toEqual(
      O.some([{ a: out }, { a: [O.none(), O.some(kept)] }, { a: 3 }])
    )
  })

  it("never sends a refused side by a pick; picking theirs lets every side go and sends nothing", () => {
    const taken = step(
      at4({}),
      takeUp(
        lineOfA([
          closed(O.some(out), { ...closedStart, refused: O.some("No.") }),
          closed(O.some(kept), { ...closedStart })
        ])
      )
    )
    expect(sends(step(taken.draft, pick(Keep.Side({ decision: O.some(out) }))))).toEqual([])
    const theirs = step(taken.draft, pick(Keep.Theirs()))
    expect([sends(theirs), theirs.draft.lines]).toEqual([[], {}])
  })
})

describe("the confirm while a line asks", () => {
  const asks = step(at4({}), takeUp(lineOfA([closed(O.some(out), { ...closedStart, refused: O.some("No.") })]))).draft

  it("imports nothing: each press is counted, to take the person to the lines, and a dismissed line frees it", () => {
    const once = step(asks, DraftEvent.ConfirmPressed())
    const twice = step(once.draft, DraftEvent.ConfirmPressed())
    expect([A.some(twice.effects, DraftEffect.$is("Confirm")), once.draft.stopped, twice.draft.stopped]).toEqual([
      false,
      1,
      2
    ])
    const dismissed = step(twice.draft, pick(Keep.Theirs()))
    expect(dismissed.draft.stopped).toBe(0)
    expect(A.some(step(dismissed.draft, DraftEvent.ConfirmPressed()).effects, DraftEffect.$is("Confirm"))).toBe(true)
  })
})

describe("the lines as they are said", () => {
  const ownStart: Omit<Side, "decision"> = { ...closedStart, here: true }
  const own = (decision: O.Option<Decision>, parts: Omit<Side, "decision">): Side => ({ decision, ...parts })
  const since = (decision: Decision): LineShown => ({
    sides: [own(O.some(decision), { ...ownStart })],
    theirs: O.some(O.some(kept)),
    going: O.none(),
    since: true
  })
  const refusedLine: LineShown = {
    sides: [own(O.some(out), { ...ownStart, refused: O.some("No.") })],
    theirs: O.none(),
    going: O.none(),
    since: false
  }

  it("offer one press for every line that offers the same pick, never sending a refused one, and say how many", () => {
    const groups = lineGroups({
      lines: { "row-1": since(out), "row-2": since(out), "row-3": refusedLine },
      canDecide: true
    })
    expect(A.map(groups, (group) => [group.asked, A.map(group.all, (all) => [all.label, all.picks.length])])).toEqual([
      [
        "since",
        [
          ["Use mine for all 2", 2],
          ["Keep theirs for all 2", 2]
        ]
      ],
      ["refused", []]
    ])
    expect(linesAsk(groups)).toBe(
      "2 rows were decided since by someone else or another tab: pick whose decision stands. 1 row could not be saved: decide it again in the review, or dismiss the line."
    )
  })

  it("offer a member who can only view the picks that send nothing", () => {
    const { actions } = lineWords({ rowId: "row-1", line: since(out), canDecide: false })
    expect(A.map(actions, (action) => action.label)).toEqual(["Keep theirs"])
  })

  it("say a row taken up from closed tabs as theirs, never as this tab's", () => {
    const line: LineShown = {
      sides: [closed(O.some(out), { ...closedStart }), closed(O.some(kept), { ...closedStart })],
      theirs: O.none(),
      going: O.none(),
      since: false
    }
    const { text } = lineWords({ rowId: "row-4", line, canDecide: true })
    expect([
      Str.includes("This tab")(text),
      Str.includes("Your closed tab 1")(text),
      Str.includes("Your closed tab 2")(text)
    ]).toEqual([false, true, true])
  })

  it("read a closed tab's decision that is this tab's too once", () => {
    const line: LineShown = {
      sides: [
        own(O.some(kept), { ...ownStart }),
        closed(O.some(kept), { ...closedStart }),
        closed(O.some(out), { ...closedStart })
      ],
      theirs: O.none(),
      going: O.none(),
      since: false
    }
    const { text } = lineWords({ rowId: "row-4", line, canDecide: true })
    expect([
      Str.includes("This tab")(text),
      Str.includes("Your closed tab:")(text),
      Str.includes("closed tab 2")(text)
    ]).toEqual([true, true, false])
  })
})

describe("a decision whose parts a match took back", () => {
  it("emptied by what was not applied goes as a put-back when the server holds more of the row than nothing", () => {
    const more = play(at4({}), [
      decide("a", O.some(keptAccepted)),
      decide("a", O.some(nothing)),
      answered(1, 5, { ...answerStart, notApplied })
    ])
    expect(O.map(lastSend(more), (send) => send.delta.set)).toEqual(O.some({ a: nothing }))
  })

  it("made on a column matched since is dated to the picture it was made on", () => {
    // Row a left out on 4; somebody matches the column the accept rests on (revision 6); she accepts on the new column.
    const behind = play(at4({}), [decide("a", O.some(out)), view(6, {}, [6]), decide("a", O.some(acceptedOut))])
    expect(
      O.map(lastSend(step(behind.draft, answered(1, 7, { ...answerStart }))), (send) => [send.delta.set, send.madeOn])
    ).toEqual(O.some([{ a: acceptedOut }, { a: 6 }]))
  })
})

describe("what an older page kept", () => {
  /** A value as the browser keeps it, written by an older page: text of its own, not through this page's schema. */
  const older = (held: object): O.Option<Waiting> =>
    waitingFromText(
      O.some(
        Formatter.formatJson({
          madeOn: { "row-12": 4 },
          leftOver: false,
          rows: { "row-12": { kept: true } },
          held: { "row-12": held }
        })
      )
    )
  /** What it reads as: this tab's decision waiting, and the closed tab's on the row's line. */
  const read = (kept: O.Option<Waiting>) =>
    O.map(kept, (waits) => ({
      rows: R.map(waits.rows, (side) => [side.decision, side.here, side.madeOn] as const),
      lines: R.map(waits.lines, (line) =>
        A.map(line.sides, (side) => [side.decision, side.here, side.madeOn, side.refused] as const)
      )
    }))
  const asIs = (refused: O.Option<string>) =>
    O.some({
      rows: { "row-12": [O.some(kept), true, 4] },
      lines: { "row-12": [[O.some(out), false, 3, refused]] }
    })

  it("reads a closed tab's decision held beside this tab's as that line, with or without this tab's named, and refused", () => {
    expect([
      read(older({ mine: { out: true }, madeOn: 3, why: { kind: "othertab", thisTab: { kept: true } } })),
      read(older({ mine: { out: true }, madeOn: 3, why: { kind: "othertab" } })),
      read(older({ mine: { out: true }, madeOn: 3, why: { kind: "refused", reason: "No." } }))
    ]).toEqual([asIs(O.none()), asIs(O.none()), asIs(O.some("No."))])
  })

  it("comes back after a reload as the draft kept it, every side of every line included", () => {
    const sides = [
      closed(O.some(out), { ...closedStart }),
      closed(O.some(kept), { ...closedStart, seen: [O.none(), O.some(kept)], refused: O.some("No.") })
    ]
    const kept1 = waiting(play(at4({}), [takeUp(lineOfA(sides))]).draft)
    expect(keptForm(kept1)).toEqual(kept1)
  })
})

describe("pictures that come late or show what she saw", () => {
  it("a closed picture older than a save's answer ends nothing: the import was opened again since", () => {
    const answeredLater = play(at4({}), [
      decide("a", O.some(out)),
      answered(1, 7, { ...answerStart }),
      decide("b", O.some(kept))
    ])
    const late = step(
      answeredLater.draft,
      DraftEvent.ViewArrived({
        waiting: false,
        matches: [],
        takenBack: [],
        revision: 5,
        decisions: {},
        open: false,
        confirms: 1
      })
    )
    expect([late.draft.ended, O.isSome(late.draft.flight)]).toEqual([false, true])
  })

  it("a decision pressed on a screen that showed what the server holds stands over it: she saw it, and is not asked", () => {
    // Her own kept of row b, never sent, waits beside a picture that holds the same (somebody kept it too).
    const own: Side = {
      ...closed(O.some(kept), { ...closedStart }),
      here: true,
      madeOn: 4,
      seen: [O.none(), O.some(accepted)]
    }
    const draft: Draft = { ...at4({}), held: O.some({ revision: 5, decisions: { b: kept } }), unsent: { b: own } }
    const pressed = step(draft, decide("b", O.some(accepted)))
    expect([R.has(pressed.draft.lines, "b"), O.map(lastSend(pressed), (send) => send.over)]).toEqual([
      false,
      O.some({ b: [O.none(), O.some(accepted), O.some(kept)] })
    ])
  })
})
