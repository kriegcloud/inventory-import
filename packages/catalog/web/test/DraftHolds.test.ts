// The person's rows the draft holds instead of sending (Benjamin, 2026-11-20, group 3), and the confirm the screen
// holds back, as one pure transition. A refused save keeps its rows with the reason, the rows behind it still wait,
// and nobody signed in is not a refusal ("Keep them, say why"). A waiting row decided otherwise elsewhere since is
// held with both decisions until the person picks ("Hold it, show both, ask"). A decision a re-match took back
// leaves the part it was out of the row, whatever kind it was. And a held-back confirm frees its button once the
// screen holds the picture it waits for, counting rows from what was shown at the press.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
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
  Hold,
  Said,
  shown,
  type Stepped,
  step,
  type Waiting,
  waiting
} from "../src/Draft.machine.ts"
import { holdLine, takeBackWords } from "../src/internal/leftOver.ts"
import { keptForm } from "../src/internal/storedWaiting.ts"

/** One match's take-backs as the view carries them, read through the contract's schema. */
// @effect-diagnostics-next-line schemaSync:off
const takeBack = S.decodeUnknownSync(MatchTakeBack)

const out = decisionFromFlags({ out: true })
const kept = decisionFromFlags({ kept: true })

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

describe("a refused save", () => {
  it("keeps its rows with the server's reason, not shown as standing and not sent; the rows behind it still wait and go", () => {
    const out1 = play(atFour, [DraftEvent.Decided({ changes: { a: O.some(out) } })])
    // While a's save is out, the person decides b.
    const behind = play(out1.draft, [DraftEvent.Decided({ changes: { b: O.some(kept) } })])
    const refused = play(behind.draft, [DraftEvent.SaveRefused({ reason: "Your role was changed." })])
    expect(refused.draft.onHold).toEqual({
      a: { mine: O.some(out), madeOn: 4, why: Hold.Refused({ reason: "Your role was changed." }) }
    })
    // a is not shown as standing; b is, and waits.
    expect([shown(refused.draft), R.keys(refused.draft.unsent)]).toEqual([{ b: kept }, ["b"]])
    expect(A.filter(refused.effects, DraftEffect.$is("Say"))).toEqual([
      DraftEffect.Say({ what: Said.Refused({ reason: "Your role was changed." }) })
    ])
    // The picture asked for says the import is open: b is sent, a is not.
    const read = play(refused.draft, [view(4)])
    expect(A.map(sends(read), (send) => send.delta)).toEqual([{ set: { b: kept }, clear: [] }])
    // Kept in the browser with the waiting rows: a reload finds it on hold.
    expect(O.map(waiting(read.draft), (kept) => R.keys(kept.held))).toEqual(O.some(["a"]))
  })

  it("is settled by deciding the row again (sent as any decision) or by dismissing it (let go, nothing sent)", () => {
    const refused = play(atFour, [
      DraftEvent.Decided({ changes: { a: O.some(out), c: O.some(out) } }),
      DraftEvent.SaveRefused({ reason: "No." })
    ])
    expect(R.keys(refused.draft.onHold)).toEqual(["a", "c"])
    const again = play(refused.draft, [DraftEvent.Decided({ changes: { a: O.some(kept) } })])
    expect([R.keys(again.draft.onHold), A.map(sends(again), (send) => send.delta)]).toEqual([
      ["c"],
      [{ set: { a: kept }, clear: [] }]
    ])
    const dismissed = play(again.draft, [DraftEvent.HoldSettled({ rowId: "c", keep: "theirs" })])
    expect([R.keys(dismissed.draft.onHold), sends(dismissed)]).toEqual([[], []])
  })

  it("because nobody is signed in is not a refusal: the rows wait, kept, and are sent once a fresh picture has checked them", () => {
    const signedOut = play(atFour, [DraftEvent.Decided({ changes: { a: O.some(out) } }), DraftEvent.SaveSignedOut()])
    expect([signedOut.draft.onHold, R.keys(signedOut.draft.unsent), signedOut.draft.stalled]).toEqual([{}, ["a"], true])
    expect(A.filter(signedOut.effects, DraftEffect.$is("Say"))).toEqual([DraftEffect.Say({ what: Said.SignedOut() })])
    expect(O.map(waiting(signedOut.draft), (kept) => R.keys(kept.rows))).toEqual(O.some(["a"]))
    // Save again asks for the import first: the row waits, and is checked before it goes.
    const again = play(signedOut.draft, [DraftEvent.SaveAgain()])
    expect([sends(again), A.filter(again.effects, DraftEffect.$is("Ask"))]).toEqual([[], [DraftEffect.Ask()]])
    // Signed in again: the picture the step reads then sends it.
    expect(A.map(sends(play(again.draft, [view(4)])), (send) => send.delta)).toEqual([{ set: { a: out }, clear: [] }])
  })
})

describe("a waiting row decided elsewhere since", () => {
  /** Row a decided out on revision 4, its save failed: it waits. */
  const aWaits = play(atFour, [DraftEvent.Decided({ changes: { a: O.some(out) } }), DraftEvent.SaveFailed()]).draft

  it("is held with theirs and the person's: nothing is sent for it, the other waiting rows go", () => {
    const withB = play(aWaits, [DraftEvent.Decided({ changes: { b: O.some(out) } }), DraftEvent.SaveFailed()]).draft
    // Somebody else kept row a meanwhile.
    const arrived = play(withB, [view(5, { a: kept })])
    expect(arrived.draft.onHold).toEqual({
      a: { mine: O.some(out), madeOn: 4, why: Hold.Elsewhere({ theirs: O.some(kept) }) }
    })
    expect(A.map(sends(arrived), (send) => send.delta)).toEqual([{ set: { b: out }, clear: [] }])
    // The screen shows theirs until the person picks.
    expect(shown(arrived.draft)).toEqual({ a: kept, b: out })
  })

  it("is not held when the picture holds the person's own earlier decision: the save that failed was taken", () => {
    const again = play(aWaits, [DraftEvent.Decided({ changes: { a: O.some(kept) } })])
    // a went out as kept; the server took the first save (out) after all.
    const arrived = play(again.draft, [view(5, { a: out })])
    expect(arrived.draft.onHold).toEqual({})
  })

  it("picked as the person's: sent now, made on the revision it was made on (never re-dated), and the region drawn again without a word", () => {
    const held = play(aWaits, [view(5, { a: kept })]).draft
    const mine = play(held, [DraftEvent.HoldSettled({ rowId: "a", keep: "mine" })])
    // Made on 4, as the hold kept it: a column matched again at 5 still takes back what it rested on.
    expect(sends(mine)).toEqual([DraftEffect.Send({ delta: { set: { a: out }, clear: [] }, madeOn: { a: 4 } })])
    expect([mine.draft.onHold, shown(mine.draft)]).toEqual([{}, { a: out }])
    expect(A.filter(mine.effects, DraftEffect.$is("Restart"))).toEqual([DraftEffect.Restart({ announce: false })])
  })

  it("picked as theirs: let go, and nothing is sent", () => {
    const held = play(aWaits, [view(5, { a: kept })]).draft
    const theirs = play(held, [DraftEvent.HoldSettled({ rowId: "a", keep: "theirs" })])
    expect([theirs.draft.onHold, sends(theirs), shown(theirs.draft)]).toEqual([{}, [], { a: kept }])
  })
})

describe("a decision a re-match took back", () => {
  const save = (decision: ReturnType<typeof decisionFromFlags>) =>
    play(atFour, [DraftEvent.Decided({ changes: { r: O.some(decision) } })]).draft

  it.each([
    ["a Replace", decisionFromFlags({ stored: "replace", out: false }), "stored", "sku", decisionFromFlags({})],
    ["a keep-one-of-two", decisionFromFlags({ kept: true }), "twin", "sku", decisionFromFlags({})],
    [
      "an undone fix",
      decisionFromFlags({ reverted: ["uom"], accepted: ["unitCost"] }),
      "undo",
      "uom",
      decisionFromFlags({ accepted: ["unitCost"] })
    ],
    ["a row left out stays left out", decisionFromFlags({ out: true, kept: true }), "twin", "sku", out]
  ] as const)("leaves %s out of the row, and keeps the rest of it", (_name, decision, kind, field, after) => {
    const answered = play(save(decision), [
      DraftEvent.SaveAnswered({ revision: 5, changed: true, notApplied: [{ rowId: "r", field, kind }] })
    ])
    expect(shown(answered.draft)["r"]).toEqual(after)
  })
})

describe("a confirm held back", () => {
  it("after a newer picture arrived while it was out is read at once: the button is free (review finding 2)", () => {
    const pressed = play(atFour, [DraftEvent.ConfirmPressed()])
    const moved = play(pressed.draft, [view(5, { b: out }), DraftEvent.ConfirmMoved()])
    expect(moved.draft.heldBack).toEqual(O.some({ read: true, apart: 1, accepts: [] }))
    expect(play(moved.draft, [DraftEvent.ConfirmPressed()]).draft.confirm).toBe("out")
  })

  it("that waited for a save answered with an accept taken back names it, and is read once its picture is held (finding 3)", () => {
    const accepted = decisionFromFlags({ accepted: ["unitCost"] })
    const waits = play(atFour, [DraftEvent.Decided({ changes: { r: O.some(accepted) } }), DraftEvent.ConfirmPressed()])
    const answered = play(waits.draft, [
      DraftEvent.SaveAnswered({ revision: 5, changed: true, notApplied: [{ rowId: "r", field: "unitCost" }] })
    ])
    expect(answered.draft.heldBack).toEqual(
      O.some({ read: true, apart: 0, accepts: [{ rowId: "r", field: "unitCost" }] })
    )
  })

  it("does not end on a closed picture the import has since been opened again past (finding 4)", () => {
    const aWaits = play(atFour, [DraftEvent.Decided({ changes: { a: O.some(out) } }), DraftEvent.SaveFailed()]).draft
    const out1 = play(aWaits, [DraftEvent.ConfirmPressed()])
    const seen = play(out1.draft, [
      DraftEvent.ViewArrived({ revision: 5, decisions: {}, open: false, confirms: 1 }),
      DraftEvent.ViewArrived({ revision: 6, decisions: {}, open: true, confirms: 1 }),
      DraftEvent.ConfirmMoved()
    ])
    // Not ended: a goes back to waiting, and the import opened again is asked for.
    expect([seen.draft.ended, R.keys(seen.draft.unsent), O.isSome(seen.draft.flight)]).toEqual([false, ["a"], false])
    // The picture asked for checks it, and it is sent into the import opened again.
    const read = play(seen.draft, [DraftEvent.ViewArrived({ revision: 6, decisions: {}, open: true, confirms: 1 })])
    expect(A.map(sends(read), (send) => send.delta)).toEqual([{ set: { a: out }, clear: [] }])
  })

  it("counts rows against what was shown at the press: a row changed and changed back is not decided otherwise (finding 5)", () => {
    const pressed = play(atFour, [DraftEvent.ConfirmPressed()])
    const moved = play(pressed.draft, [DraftEvent.ConfirmMoved(), view(5, { b: out }), view(6, {})])
    expect(moved.draft.heldBack).toEqual(O.some({ read: true, apart: 0, accepts: [] }))
  })
})

// The third review, group 3: G2 "Hold it, show both, ask" on every path a waiting row leaves by. A waiting row (after
// a failed save, a reload, or taken up from a tab that is gone) is never sent until a fresh picture at least as new as
// the one held has checked it; the import is asked for instead.
describe("a waiting row is checked before it goes, on every path (G2)", () => {
  /** Row a decided out on revision 4, its save failed: it waits. */
  const aWaits = play(atFour, [DraftEvent.Decided({ changes: { a: O.some(out) } }), DraftEvent.SaveFailed()]).draft
  /** The view the tab held, given again while it is asked anew (a return to the tab). */
  const givenAgain = (revision: number, decisions: SavedDecisions = {}) =>
    DraftEvent.ViewArrived({ revision, decisions, open: true, confirms: 0, waiting: true })

  it("a return to the tab gives the view again: that is no answer, and nothing waiting is sent (g2-bypassed-on-focus-decide-saveagain)", () => {
    const back = play(aWaits, [givenAgain(4)])
    // Nor is the import asked again: the read that is out (the return's own) brings the fresh picture, and asking
    // again while it is out would only give the view again.
    expect([sends(back), A.some(back.effects, DraftEffect.$is("Ask"))]).toEqual([[], false])
    // Its answer checks the row, and sends it.
    expect(A.map(sends(play(back.draft, [view(4)])), (send) => send.delta)).toEqual([{ set: { a: out }, clear: [] }])
  })

  it("the next decision sends only itself; the waiting row waits for a fresh picture (in-tab-waiting-row-sent-blind)", () => {
    const next = play(aWaits, [DraftEvent.Decided({ changes: { b: O.some(kept) } })])
    expect(A.map(sends(next), (send) => send.delta)).toEqual([{ set: { b: kept }, clear: [] }])
    expect(A.some(next.effects, DraftEffect.$is("Ask"))).toBe(true)
  })

  it("Save again asks for the import and sends nothing until its answer has checked the row", () => {
    const again = play(aWaits, [DraftEvent.SaveAgain()])
    expect([sends(again), A.filter(again.effects, DraftEffect.$is("Ask"))]).toEqual([[], [DraftEffect.Ask()]])
    // Somebody else kept row a meanwhile (revision 5): the answer holds it, and still sends nothing for it.
    const answered = play(again.draft, [view(5, { a: kept })])
    expect([sends(answered), R.keys(answered.draft.onHold)]).toEqual([[], ["a"]])
  })

  it("a stalled row, a colleague's change, the view given again, then a decision of another row: the row is never sent over theirs", () => {
    const after = play(aWaits, [
      givenAgain(4),
      DraftEvent.Decided({ changes: { b: O.some(kept) } }),
      view(5, { a: kept })
    ])
    expect(A.flatMap(sends(after), (send) => R.keys(send.delta.set))).toEqual(["b"])
    expect(after.draft.onHold).toEqual({
      a: { mine: O.some(out), madeOn: 4, why: Hold.Elsewhere({ theirs: O.some(kept) }) }
    })
  })

  it("is held when someone else picks a value the person had only in a row that never left the browser (g2-seen-counts-unsent-values)", () => {
    const after = play(atFour, [
      DraftEvent.Decided({ changes: { b: O.some(out) } }),
      // While b's save is out, a is marked kept, then changed to out: kept never leaves the browser.
      DraftEvent.Decided({ changes: { a: O.some(kept) } }),
      DraftEvent.Decided({ changes: { a: O.some(out) } }),
      DraftEvent.SaveFailed(),
      // Dana keeps row a.
      view(5, { a: kept })
    ])
    expect(R.keys(after.draft.onHold)).toEqual(["a"])
    expect(A.flatMap(sends(after), (send) => R.keys(send.delta.set))).toEqual(["b", "b"])
  })

  const goneTab = (rows: Waiting["rows"], madeOn: Waiting["madeOn"] = {}): Waiting => ({
    rows,
    madeOn,
    confirms: O.some(0),
    leftOver: false,
    seen: R.map(rows, (change) => [O.none(), change]),
    held: {}
  })

  it("rows taken up after the first picture are not sent at once: the import is asked for, and its answer holds a row decided since (takenup-sends-without-g2)", () => {
    const taken = play(atFour, [DraftEvent.TakenUp({ kept: goneTab({ a: O.some(out) }, { a: 3 }) })])
    expect([sends(taken), A.some(taken.effects, DraftEffect.$is("Ask"))]).toEqual([[], true])
    const answered = play(taken.draft, [view(5, { a: kept })])
    expect([sends(answered), answered.draft.onHold]).toEqual([
      [],
      { a: { mine: O.some(out), madeOn: 3, why: Hold.Elsewhere({ theirs: O.some(kept) }) } }
    ])
  })

  it("rows taken up before the first picture are checked by the first answer, never by the view the step finds (it may be older)", () => {
    const opened = play(emptyDraft, [DraftEvent.Opened({ kept: O.none() })]).draft
    // The tab held the view of revision 4 (the Match step read it); Marcus kept row a since.
    const found = play(opened, [DraftEvent.TakenUp({ kept: goneTab({ a: O.some(out), b: O.some(out) }) }), view(4)])
    expect([sends(found), A.some(found.effects, DraftEffect.$is("Ask"))]).toEqual([[], true])
    const taken = play(found.draft, [view(5, { a: kept })])
    expect([A.flatMap(sends(taken), (send) => R.keys(send.delta.set)), R.keys(taken.draft.onHold)]).toEqual([
      ["b"],
      ["a"]
    ])
  })

  it("the Review step drawn again gives the view it held: a row that waits is not checked by it, and goes over nobody's newer decision (redraw-skips-g2)", () => {
    // Row a waits at revision 4; the person goes to the Match step; someone keeps row a (revision 5); back to Review.
    const back = play(aWaits, [DraftEvent.Left(), DraftEvent.Opened({ kept: O.none() }), view(4)])
    expect([sends(back), A.some(back.effects, DraftEffect.$is("Ask"))]).toEqual([[], true])
    // The import asked for answers with revision 5: row a is held, both said.
    const answered = play(back.draft, [view(5, { a: kept })])
    expect([sends(answered), answered.draft.onHold]).toEqual([
      [],
      { a: { mine: O.some(out), madeOn: 4, why: Hold.Elsewhere({ theirs: O.some(kept) }) } }
    ])
  })

  it("rows taken up are checked by the gone tab's values seen, not by what this tab once saw of the row (takenup-seen-override)", () => {
    // This tab left row a out, and it was saved: the server holds out, which this tab saw.
    const saved = play(atFour, [
      DraftEvent.Decided({ changes: { a: O.some(out) } }),
      DraftEvent.SaveAnswered({ revision: 5, changed: true, notApplied: [] })
    ]).draft
    // A gone tab had kept row a, beginning from nothing: this tab's out is a decision made since, elsewhere.
    const taken = play(saved, [
      DraftEvent.TakenUp({
        kept: { ...goneTab({ a: O.some(kept) }, { a: 4 }), seen: { a: [O.none(), O.some(kept)] } }
      }),
      view(5, { a: out })
    ])
    expect([sends(taken), taken.draft.onHold]).toEqual([
      [],
      { a: { mine: O.some(kept), madeOn: 4, why: Hold.Elsewhere({ theirs: O.some(out) }) } }
    ])
  })

  it("a hold follows later pictures: theirs is what the server holds now, and the hold lets go once the server holds the person's (elsewhere-hold-theirs-frozen)", () => {
    const held = play(aWaits, [view(5, { a: kept })]).draft
    const moved = play(held, [view(6, {})])
    expect(moved.draft.onHold).toEqual({
      a: { mine: O.some(out), madeOn: 4, why: Hold.Elsewhere({ theirs: O.none() }) }
    })
    const same = play(moved.draft, [view(7, { a: out })])
    expect([same.draft.onHold, sends(same)]).toEqual([{}, []])
  })

  it("a waiting row is checked against the picture a confirm names: one decided otherwise is held, and nothing is confirmed", () => {
    const pressed = play(aWaits, [givenAgain(5, { a: kept }), DraftEvent.ConfirmPressed()])
    expect([A.some(pressed.effects, DraftEffect.$is("Confirm")), R.keys(pressed.draft.onHold)]).toEqual([false, ["a"]])
  })
})

describe("rows a tab that is gone kept, never dropped without a word", () => {
  const goneTab = (rows: Waiting["rows"], parts: Partial<Waiting> = {}): Waiting => ({
    rows,
    madeOn: R.map(rows, () => 3),
    confirms: O.some(0),
    leftOver: false,
    seen: {},
    held: {},
    ...parts
  })

  it("a row this tab decided otherwise is held, both said, until the person picks (takeup-drops-gone-tab-decision-unnamed)", () => {
    const here = play(atFour, [DraftEvent.Decided({ changes: { r: O.some(kept) } }), DraftEvent.SaveFailed()]).draft
    const taken = play(here, [DraftEvent.TakenUp({ kept: goneTab({ r: O.some(out) }) })])
    expect(taken.draft.onHold).toEqual({
      r: { mine: O.some(out), madeOn: 3, why: Hold.OtherTab({ thisTab: O.some(kept) }) }
    })
    // This tab's decision stays as it was: still waiting, still shown.
    expect([R.keys(taken.draft.unsent), shown(taken.draft)]).toEqual([["r"], { r: kept }])
    // "Use the other tab's" sends it, as made on its own revision, once a fresh picture has checked the row (this
    // tab's decision of it was waiting).
    const theirs = play(taken.draft, [DraftEvent.HoldSettled({ rowId: "r", keep: "mine" }), view(5)])
    expect(A.map(sends(theirs), (send) => [send.delta.set, send.madeOn])).toEqual([[{ r: out }, { r: 3 }]])
  })

  it("this tab's own decision stays beside the other tab's: a failed save of it, Keep this tab's and a reload never lose it (othertab-loses-own)", () => {
    // Row 12 kept in this tab, its save out; the gone tab had left it out.
    const out1 = play(atFour, [DraftEvent.Decided({ changes: { r: O.some(kept) } })]).draft
    const taken = play(out1, [DraftEvent.TakenUp({ kept: goneTab({ r: O.some(out) }) }), DraftEvent.SaveFailed()])
    expect([R.keys(taken.draft.onHold), taken.draft.unsent]).toEqual([["r"], { r: O.some(kept) }])
    // Kept in this browser beside the hold, and back after a reload.
    expect(O.map(waiting(taken.draft), (kept) => [kept.rows, R.keys(kept.held)])).toEqual(
      O.some([{ r: O.some(kept) }, ["r"]])
    )
    const reloaded = play(emptyDraft, [DraftEvent.Opened({ kept: keptForm(waiting(taken.draft)) })]).draft
    expect([reloaded.unsent, R.keys(reloaded.onHold)]).toEqual([{ r: O.some(kept) }, ["r"]])
    // Keep this tab's: this tab's decision goes, once a fresh picture has checked it.
    const keepHere = play(taken.draft, [DraftEvent.HoldSettled({ rowId: "r", keep: "theirs" }), view(5)])
    expect(A.map(sends(keepHere), (send) => send.delta)).toEqual([{ set: { r: kept }, clear: [] }])
  })

  it("Keep this tab's decides this tab's again where it is no longer on its way, and nothing of it on the server", () => {
    // This tab's decision of row 12 was refused after the hold was made: it is only in the line now.
    const out1 = play(atFour, [DraftEvent.Decided({ changes: { r: O.some(kept) } })]).draft
    const taken = play(out1, [
      DraftEvent.TakenUp({ kept: goneTab({ r: O.some(out) }) }),
      DraftEvent.SaveRefused({ reason: "No." })
    ])
    expect([taken.draft.unsent, R.keys(taken.draft.onHold)]).toEqual([{}, ["r"]])
    const keepHere = play(taken.draft, [view(4), DraftEvent.HoldSettled({ rowId: "r", keep: "theirs" })])
    expect(A.map(sends(keepHere), (send) => send.delta)).toEqual([{ set: { r: kept }, clear: [] }])
  })

  it("a ready row of this tab beside the other tab's goes nowhere while the line asks: not with the next save, not in a confirm", () => {
    // Row b's save is out; row 12 kept in this tab waits behind it; the gone tab had left 12 out.
    const behind = play(atFour, [
      DraftEvent.Decided({ changes: { b: O.some(out) } }),
      DraftEvent.Decided({ changes: { r: O.some(kept) } }),
      DraftEvent.TakenUp({ kept: goneTab({ r: O.some(out) }) })
    ]).draft
    const answered = play(behind, [DraftEvent.SaveAnswered({ revision: 5, changed: true, notApplied: [] })])
    expect(sends(answered)).toEqual([])
    const pressed = play(answered.draft, [DraftEvent.ConfirmPressed()])
    expect(A.some(pressed.effects, DraftEffect.$is("Confirm"))).toBe(false)
  })

  it("the server holding the other tab's decision does not let the line go: this tab's differs, and is never sent unasked", () => {
    const here = play(atFour, [DraftEvent.Decided({ changes: { r: O.some(kept) } }), DraftEvent.SaveFailed()]).draft
    const taken = play(here, [DraftEvent.TakenUp({ kept: goneTab({ r: O.some(out) }) })]).draft
    // The gone tab's save had reached the server after all.
    const arrived = play(taken, [view(5, { r: out })])
    expect([sends(arrived), arrived.draft.onHold]).toEqual([
      [],
      { r: { mine: O.some(out), madeOn: 3, why: Hold.OtherTab({ thisTab: O.some(kept) }) } }
    ])
  })

  it("a gone tab's refused row stays refused beside this tab's decision, never offered to be sent as the other tab's", () => {
    const here = play(atFour, [DraftEvent.Decided({ changes: { r: O.some(kept) } }), DraftEvent.SaveFailed()]).draft
    const refused = { mine: O.some(out), madeOn: 3, why: Hold.Refused({ reason: "Your role was changed." }) }
    const taken = play(here, [DraftEvent.TakenUp({ kept: goneTab({}, { held: { r: refused } }) })])
    expect([taken.draft.onHold, taken.draft.unsent]).toEqual([{ r: refused }, { r: O.some(kept) }])
  })

  it("decided the same in both tabs: nothing is held, nothing lost", () => {
    const here = play(atFour, [DraftEvent.Decided({ changes: { r: O.some(out) } }), DraftEvent.SaveFailed()]).draft
    expect(play(here, [DraftEvent.TakenUp({ kept: goneTab({ r: O.some(out) }) })]).draft.onHold).toEqual({})
  })

  it("a row this tab holds on hold already is named, not dropped silently", () => {
    const refused = play(atFour, [
      DraftEvent.Decided({ changes: { r: O.some(kept) } }),
      DraftEvent.SaveRefused({ reason: "No." })
    ])
    const taken = play(refused.draft, [DraftEvent.TakenUp({ kept: goneTab({ r: O.some(out) }) })])
    expect(A.filter(taken.effects, DraftEffect.$is("Say"))).toEqual([
      DraftEffect.Say({ what: Said.NotTakenUp({ rows: { r: O.some(out) } }) })
    ])
  })

  it("into an import confirmed since, they are left over and named by the result, unless the confirm wrote them (takenup-into-ended-draft-dropped)", () => {
    const ended = play(atFour, [
      DraftEvent.ViewArrived({ revision: 5, decisions: { b: out }, open: false, confirms: 1 })
    ]).draft
    expect(ended.ended).toBe(true)
    const taken = play(ended, [DraftEvent.TakenUp({ kept: goneTab({ a: O.some(out), b: O.some(out) }) })])
    expect(taken.draft.leftOver).toEqual(O.some({ a: O.some(out) }))
    // Kept in the browser as rows left over until the result has named them.
    expect(O.map(waiting(taken.draft), (kept) => [kept.leftOver, R.keys(kept.rows)])).toEqual(O.some([true, ["a"]]))
  })

  it("rows a closed import left over, taken into an import opened again, are named and never sent", () => {
    const taken = play(atFour, [DraftEvent.TakenUp({ kept: goneTab({ a: O.some(out) }, { leftOver: true }) })])
    expect([sends(taken), A.filter(taken.effects, DraftEffect.$is("Say"))]).toEqual([
      [],
      [DraftEffect.Say({ what: Said.Outlived({ rows: { a: O.some(out) } }) })]
    ])
  })
})

describe("a draft with no picture held", () => {
  it("sends nothing for a decision (it would go made on nothing): the import is asked for, and its picture sends it (decided-after-let-go)", () => {
    const decided = play(emptyDraft, [DraftEvent.Decided({ changes: { a: O.some(out) } })])
    expect([sends(decided), A.some(decided.effects, DraftEffect.$is("Ask"))]).toEqual([[], true])
  })
})

describe("what a decision sent again names as made on", () => {
  it("a row decided again keeps the revision of the decision it rests on (madeon-moved-forward-on-redecide-and-hold)", () => {
    const accepted = decisionFromFlags({ accepted: ["unitCost"] })
    const named = decisionFromFlags({ accepted: ["unitCost"], edits: { name: "Bolt" } })
    // Row r accepted on 4 waits behind the save of row a; a match moves the picture to 6 meanwhile.
    const behind = play(atFour, [
      DraftEvent.Decided({ changes: { a: O.some(out) } }),
      DraftEvent.Decided({ changes: { r: O.some(accepted) } }),
      view(6, {}),
      DraftEvent.Decided({ changes: { r: O.some(named) } }),
      DraftEvent.SaveAnswered({ revision: 7, changed: true, notApplied: [] })
    ])
    expect(A.map(sends(behind), (send) => send.madeOn)).toEqual([{ a: 4 }, { r: 4 }])
  })
})

describe("the line above the review", () => {
  const refusedClear = { mine: O.none(), madeOn: 4, why: Hold.Refused({ reason: "Your role was changed." }) }

  it("says a refused take-back in the person's own words (refused-clear-words)", () => {
    expect(holdLine({ rowId: "row-12", held: refusedClear, canDecide: true }).text).toBe(
      "Row 12: you took your decision back. Not saved: Your role was changed."
    )
  })

  it("names someone else or another tab for a decision made elsewhere, and offers a view-only member Keep theirs (viewer-cannot-settle-elsewhere-hold)", () => {
    const held = { mine: O.some(out), madeOn: 4, why: Hold.Elsewhere({ theirs: O.some(kept) }) }
    const viewer = holdLine({ rowId: "row-4", held, canDecide: false })
    expect(viewer.text).toBe(
      "Row 4: decided since by someone else or another tab: kept over the other row with its SKU. Yours: left out."
    )
    expect(viewer.actions).toEqual([{ keep: "theirs", label: "Keep theirs" }])
    expect(A.map(holdLine({ rowId: "row-4", held, canDecide: true }).actions, (action) => action.keep)).toEqual([
      "mine",
      "theirs"
    ])
  })

  it("says a gone tab's decision as from the person's other tab", () => {
    const held = { mine: O.some(out), madeOn: 3, why: Hold.OtherTab({ thisTab: O.some(kept) }) }
    expect(holdLine({ rowId: "row-12", held, canDecide: true })).toEqual({
      text: "Row 12: from your other tab: left out. This tab: kept over the other row with its SKU.",
      actions: [
        { keep: "mine", label: "Use the other tab's" },
        { keep: "theirs", label: "Keep this tab's" }
      ]
    })
  })
})

describe("what a match took back", () => {
  it("is said as taken back, not as a change on another screen", () => {
    const arrived = play(atFour, [
      DraftEvent.ViewArrived({
        revision: 5,
        decisions: { a: out },
        open: true,
        confirms: 0,
        takenBack: [{ revision: 5, rows: ["a"] }]
      })
    ])
    expect(A.filter(arrived.effects, DraftEffect.$is("Restart"))).toEqual([DraftEffect.Restart({ announce: false })])
    // Without a take-back at that revision, the same change is somebody else's.
    const other = play(atFour, [view(5, { a: out })])
    expect(A.filter(other.effects, DraftEffect.$is("Restart"))).toEqual([DraftEffect.Restart({ announce: true })])
  })

  it("explains only its own rows: another decision in the same jump is still said as a change on another screen (takeback-hides-unrelated)", () => {
    const arrived = play(atFour, [
      DraftEvent.ViewArrived({
        revision: 6,
        decisions: { a: out, b: kept },
        open: true,
        confirms: 0,
        takenBack: [{ revision: 5, rows: ["a"] }]
      })
    ])
    expect(A.filter(arrived.effects, DraftEffect.$is("Restart"))).toEqual([DraftEffect.Restart({ announce: true })])
  })

  it("is named by who matched, the field, the kind, how many and which rows", () => {
    expect(
      takeBackWords(
        takeBack({ revision: 9, by: "Marcus", field: "sku", kind: "stored", count: 2, rows: ["row-4", "row-9"] })
      )
    ).toBe("Marcus matched SKU again: 2 keep-or-replace answers were taken back, on rows 4 and 9.")
    const many = A.map(A.range(1, 12), (n) => `row-${n}`)
    expect(
      takeBackWords(takeBack({ revision: 9, by: "Marcus", field: "unitCost", kind: "accept", count: 300, rows: many }))
    ).toBe(
      "Marcus matched Unit cost again: 300 accepted proposals were taken back, on rows 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 and 290 more."
    )
  })
})
