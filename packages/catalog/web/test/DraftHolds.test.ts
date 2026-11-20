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
import { decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
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
  waiting
} from "../src/Draft.machine.ts"

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

  it("because nobody is signed in is not a refusal: the rows wait, kept, and are sent once a save gets through", () => {
    const signedOut = play(atFour, [DraftEvent.Decided({ changes: { a: O.some(out) } }), DraftEvent.SaveSignedOut()])
    expect([signedOut.draft.onHold, R.keys(signedOut.draft.unsent), signedOut.draft.stalled]).toEqual([{}, ["a"], true])
    expect(A.filter(signedOut.effects, DraftEffect.$is("Say"))).toEqual([DraftEffect.Say({ what: Said.SignedOut() })])
    expect(O.map(waiting(signedOut.draft), (kept) => R.keys(kept.rows))).toEqual(O.some(["a"]))
    // Signed in again: Save again sends it.
    expect(A.map(sends(play(signedOut.draft, [DraftEvent.SaveAgain()])), (send) => send.delta)).toEqual([
      { set: { a: out }, clear: [] }
    ])
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

  it("picked as the person's: sent now, made on the picture held, and the region drawn again without a word", () => {
    const held = play(aWaits, [view(5, { a: kept })]).draft
    const mine = play(held, [DraftEvent.HoldSettled({ rowId: "a", keep: "mine" })])
    expect(sends(mine)).toEqual([DraftEffect.Send({ delta: { set: { a: out }, clear: [] }, madeOn: { a: 5 } })])
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
    // Not ended: a goes back to waiting and is sent into the import opened again.
    expect([seen.draft.ended, R.keys(seen.draft.unsent), O.isSome(seen.draft.flight)]).toEqual([false, [], true])
  })

  it("counts rows against what was shown at the press: a row changed and changed back is not decided otherwise (finding 5)", () => {
    const pressed = play(atFour, [DraftEvent.ConfirmPressed()])
    const moved = play(pressed.draft, [DraftEvent.ConfirmMoved(), view(5, { b: out }), view(6, {})])
    expect(moved.draft.heldBack).toEqual(O.some({ read: true, apart: 0, accepts: [] }))
  })
})
