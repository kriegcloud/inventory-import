// The review's draft against a server and a network that answer in any order (`support/draftWorld.ts`): the person
// decides, somebody else saves or matches a column, a save is taken by the server and answered late or out of order,
// fails or is refused, reads and other answers arrive out of turn, the person leaves the Review step and comes back,
// reloads, settles lines, takes up a closed tab's rows. Each rule here is one where a wrong result loses a decision
// without a word, or writes over one somebody else made unasked.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import { type DecisionDelta, decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import {
  DraftEffect,
  DraftEvent,
  emptyDraft,
  Keep,
  notSaved,
  Said,
  type Side,
  shown,
  step,
  type Waiting,
  waiting
} from "../src/Draft.machine.ts"
import {
  accepted,
  broken,
  Choices,
  Command,
  dispatch,
  holds,
  kept,
  opened,
  out,
  play,
  quiet,
  regionShows,
  run,
  type World
} from "./support/draftWorld.ts"

const sentRows = (delta: DecisionDelta): ReadonlyArray<string> => [...R.keys(delta.set), ...delta.clear]

/** One decision of a row that waits: made on `madeOn`, over what the server may hold of it (`seen`). */
const waits = (
  decision: O.Option<SavedDecisions[string]>,
  madeOn: number,
  seen = [O.none<SavedDecisions[string]>()]
): Side => ({
  decision,
  madeOn,
  dates: {},
  seen,
  live: false,
  here: true,
  overtaken: false,
  refused: O.none()
})

/** What the server holds once the import is closed: none while it is open. */
const closedAs = (world: World): O.Option<SavedDecisions> =>
  world.server.open ? O.none() : O.some(world.server.decisions)

/** How many orderings each property plays in the suite; raised to 20_000 for a long run by hand. */
const runs = 1000

/**
 * Each property's limit, above the shared 30 s, by its run count: the slowest of the four took 9.6 s for 1,000 runs
 * alone on two pinned cores (the stand-in for CI's runner), so 120 ms a run is twelve times that. 120 s in the suite;
 * a long run by hand at 20,000 gets 40 minutes. A hang in the suite fails inside the job's 15 minutes.
 */
const limit = runs * 120

// Each run draws 30 to 60 picks, each one enabled when it is drawn (`enabled`). A run ends early when nothing is enabled
// any more. The seed is new on every run: a failure is printed under its shortest ordering, which plays it again.
describe("the review's draft, whatever order things happen in", () => {
  it.prop(
    "sends only the person's own rows, never writes over what somebody else decided unasked, and every decision of hers is on the server, waiting, on a line or named",
    { choices: Choices },
    ({ choices }) => play(choices, { confirms: false, elsewhere: false, tabs: false }),
    { timeout: limit, arbitrary: { runs, size: 60 } }
  )

  it.prop(
    "with the person confirming: a confirm the server makes writes what its screen showed, and nothing is sent beside it",
    { choices: Choices },
    ({ choices }) => play(choices, { confirms: true, elsewhere: false, tabs: false }),
    { timeout: limit, arbitrary: { runs, size: 60 } }
  )

  it.prop(
    "with reloads, sign-outs and closed tabs taken up: nothing the person decided is lost or sent blind",
    { choices: Choices },
    ({ choices }) => play(choices, { confirms: false, elsewhere: false, tabs: true }),
    { timeout: limit, arbitrary: { runs, size: 60 } }
  )

  it.prop(
    "with somebody else confirming, reopening or removing the import: a step that knows it is closed sends nothing to it, and the rows left over are named",
    { choices: Choices },
    ({ choices }) => play(choices, { confirms: true, elsewhere: true, tabs: true }),
    { timeout: limit, arbitrary: { runs, size: 60 } }
  )
})

describe("the orderings that lost or hid a decision", () => {
  it("a row decided otherwise since, while an earlier decision of it was on its way, comes back after a reload on a line, and its earlier copy is not sent", () => {
    const world = opened()
    for (const command of [
      Command.cases.SomeoneElse.make({ row: "b", to: "out" }),
      Command.cases.Decide.make({ row: "b", to: "kept" }),
      Command.cases.SaveFails.make({}),
      Command.cases.Decide.make({ row: "a", to: "out" }),
      Command.cases.OtherAnswerSent.make({}),
      Command.cases.Decide.make({ row: "b", to: "nothing" }),
      Command.cases.OtherAnswerArrives.make({}),
      Command.cases.Reload.make({}),
      // After the reload the rows wait. The picture read shows row b decided otherwise since: it is put on a line for the
      // person to see (the server would refuse it anyway); row a goes, over what the server may hold of it.
      Command.cases.ServerTakesRead.make({}),
      Command.cases.ReadArrives.make({}),
      Command.cases.ServerTakesRead.make({}),
      Command.cases.ReadArrives.make({})
    ])
      run(world, command)
    expect([R.keys(world.draft.lines), O.map(A.last(world.saves), (save) => sentRows(save.delta))]).toEqual([
      ["b"],
      O.some(["a"])
    ])
  })

  it("back on Review with a decision unsaved, another person's rows are still followed and never sent over", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.SaveFails.make({}))
    run(world, Command.cases.Leave.make({}))
    run(world, Command.cases.SomeoneElse.make({ row: "b", to: "kept" }))
    run(world, Command.cases.ComeBack.make({}))
    // The row goes at once, as one that waited: written only over what the server may hold of it. Nothing is judged
    // before it goes; the server does that.
    expect(O.map(A.last(world.saves), (save) => [save.delta, save.over])).toEqual(
      O.some([{ set: { a: out }, clear: [] }, { a: [O.none(), O.some(out)] }])
    )
    quiet(world)
    // Both are on the server and on screen: theirs, and the person's own.
    expect([world.server.decisions, shown(world.draft)]).toEqual([
      { a: out, b: kept },
      { a: out, b: kept }
    ])
  })

  it("a quick return after the region was started again starts from what is shown, and the next decision clears nothing", () => {
    const world = opened({ a: out })
    run(world, Command.cases.SomeoneElse.make({ row: "b", to: "kept" }))
    run(world, Command.cases.ReturnToTab.make({}))
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect(world.restarts).toBe(1)
    run(world, Command.cases.Decide.make({ row: "c", to: "out" }))
    run(world, Command.cases.ServerTakesSave.make({}))
    run(world, Command.cases.SaveAnswers.make({}))
    run(world, Command.cases.Leave.make({}))
    run(world, Command.cases.ComeBackQuickly.make({}))
    // Back within the idle time: the region is not the one it was, it is what the draft shows.
    expect([shown(world.draft), regionShows(world)]).toEqual([
      { a: out, b: kept, c: out },
      { a: out, b: kept, c: out }
    ])
    run(world, Command.cases.Decide.make({ row: "a", to: "nothing" }))
    expect(O.map(A.last(world.saves), (save) => save.delta)).toEqual(O.some({ set: {}, clear: ["a"] }))
    quiet(world)
    expect(world.server.decisions).toEqual({ b: kept, c: out })
  })

  it("an answer from another request that lands after a later save keeps the decision just saved on screen", () => {
    const world = opened()
    // A match is taken by the server; its answer is slow.
    run(world, Command.cases.SomeoneElse.make({ row: "b", to: "kept" }))
    run(world, Command.cases.OtherAnswerSent.make({}))
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.ServerTakesSave.make({}))
    // The save's answer is two revisions on: the import is asked again.
    run(world, Command.cases.SaveAnswers.make({}))
    expect(O.isSome(world.read)).toBe(true)
    // The match's answer lands now, without the person's row in it.
    run(world, Command.cases.OtherAnswerArrives.make({}))
    expect(shown(world.draft)).toEqual({ a: out, b: kept })
    // The ask is still out, and its answer is the newer picture.
    expect(O.isSome(world.read)).toBe(true)
    quiet(world)
    expect(shown(world.draft)).toEqual({ a: out, b: kept })
  })

  it("a decision the server refused is held with the reason on the next visit, not shown as standing, and not sent with the next one", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.SaveRefused.make({}))
    run(world, Command.cases.Leave.make({}))
    run(world, Command.cases.ComeBack.make({}))
    expect(shown(world.draft)).toEqual({})
    expect(
      R.map(world.draft.lines, (line) => A.map(line.sides, (side) => [side.decision, side.refused] as const))
    ).toEqual({ a: [[O.some(out), O.some("The import was already imported.")]] })
    run(world, Command.cases.Decide.make({ row: "b", to: "kept" }))
    expect(O.map(A.last(world.saves), (save) => save.delta)).toEqual(O.some({ set: { b: kept }, clear: [] }))
    expect(R.keys(world.draft.lines)).toEqual(["a"])
  })

  it("a save waiting for Save again does not stop a newer draft from being followed", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.SaveFails.make({}))
    run(world, Command.cases.SomeoneElse.make({ row: "b", to: "kept" }))
    run(world, Command.cases.ReturnToTab.make({}))
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect(shown(world.draft)).toEqual({ a: out, b: kept })
    expect(world.restarts).toBe(1)
  })

  it("a save answered after the person left is the person's own: the view moves on, and the return starts nothing again", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.Leave.make({}))
    run(world, Command.cases.ServerTakesSave.make({}))
    run(world, Command.cases.SaveAnswers.make({}))
    expect(O.map(world.view, (view) => view.revision)).toEqual(O.some(2))
    run(world, Command.cases.ComeBack.make({}))
    expect(shown(world.draft)).toEqual({ a: out })
    expect(world.restarts).toBe(0)
  })

  it("a save the server counts as no change is not taken for the person's own next revision", () => {
    const world = opened()
    // The person leaves a row out and takes that back while the save is out; the save fails and waits.
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.Decide.make({ row: "a", to: "nothing" }))
    run(world, Command.cases.SaveFails.make({}))
    // "Save again" sends the clear at once, written only where the server holds what may be hers: what it held when
    // she began (nothing), and the leave-out that failed.
    run(world, Command.cases.SaveAgain.make({}))
    expect(O.map(A.last(world.saves), (save) => [save.delta, save.over])).toEqual(
      O.some([{ set: {}, clear: ["a"] }, { a: [O.none(), O.some(out)] }])
    )
    // Somebody else decides another row before the server takes it. It holds nothing of row a, which is what the clear
    // asks for: nothing changes, at the other person's revision.
    run(world, Command.cases.SomeoneElse.make({ row: "b", to: "kept" }))
    run(world, Command.cases.ServerTakesSave.make({}))
    expect(O.flatMap(A.last(world.saves), (save) => save.answer)).toEqual(
      O.some({ revision: 2, changed: false, notApplied: [], decidedSince: [] })
    )
    run(world, Command.cases.SaveAnswers.make({}))
    // The screen does not claim revision 2 for a picture without the other person's row: it holds what it read,
    // and has asked for the import again, at once.
    holds(world)
    expect(O.map(world.draft.held, (held) => held.revision)).toEqual(O.some(1))
    expect(O.isSome(world.read)).toBe(true)
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect(shown(world.draft)).toEqual({ b: kept })
  })
})

describe("a confirm", () => {
  const sent = (world: World) => O.map(world.confirm, (confirm) => [confirm.revision, confirm.delta] as const)

  it("made on a picture somebody has changed since is refused, writes nothing, and the next one is on their row too", () => {
    const world = opened({ a: out })
    run(world, Command.cases.SomeoneElse.make({ row: "b", to: "kept" }))
    run(world, Command.cases.PressConfirm.make({}))
    expect(sent(world)).toEqual(O.some([1, { set: {}, clear: [] }]))
    run(world, Command.cases.ServerTakesConfirm.make({}))
    expect([O.isNone(closedAs(world)), world.server.decisions]).toEqual([true, { a: out, b: kept }])
    run(world, Command.cases.ConfirmAnswers.make({}))
    // Not made, and said so; the newer picture is asked for, and the button waits for it.
    expect([world.draft.confirm, world.draft.heldBack, O.isSome(world.read)]).toEqual([
      "idle",
      O.some({ read: false, apart: 0, accepts: [] }),
      true
    ])
    run(world, Command.cases.PressConfirm.make({}))
    expect(O.isNone(world.confirm)).toBe(true)
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    // Their row is on screen now, counted, and the region was started again from it.
    expect([shown(world.draft), world.draft.heldBack, world.restarts]).toEqual([
      { a: out, b: kept },
      O.some({ read: true, apart: 1, accepts: [] }),
      1
    ])
    run(world, Command.cases.PressConfirm.make({}))
    expect([sent(world), world.draft.heldBack]).toEqual([O.some([2, { set: {}, clear: [] }]), O.none()])
    run(world, Command.cases.ServerTakesConfirm.make({}))
    expect(closedAs(world)).toEqual(O.some({ a: out, b: kept }))
  })

  it("waits for the save that is out, then carries only the rows not sent yet, with no save beside it", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.Decide.make({ row: "b", to: "kept" }))
    run(world, Command.cases.PressConfirm.make({}))
    expect([world.draft.confirm, O.isNone(world.confirm)]).toEqual(["waiting", true])
    run(world, Command.cases.ServerTakesSave.make({}))
    run(world, Command.cases.SaveAnswers.make({}))
    // Row a is saved at revision 2; the confirm names that revision and carries row b alone.
    expect([sent(world), O.isNone(A.last(world.saves))]).toEqual([O.some([2, { set: { b: kept }, clear: [] }]), true])
    run(world, Command.cases.ServerTakesConfirm.make({}))
    expect(closedAs(world)).toEqual(O.some({ a: out, b: kept }))
    run(world, Command.cases.ConfirmAnswers.make({}))
    // Ended on the confirmed picture, with nothing left over: both rows are in it.
    // Its ids carry on: none is used twice in the page.
    expect(world.draft).toEqual({
      ...emptyDraft,
      onScreen: true,
      epoch: 1,
      lastId: 2,
      ended: true,
      endedOn: { a: out, b: kept }
    })
  })

  it("that waits is held back when its save's answer says somebody else saved in between", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.SomeoneElse.make({ row: "b", to: "kept" }))
    run(world, Command.cases.PressConfirm.make({}))
    run(world, Command.cases.ServerTakesSave.make({}))
    run(world, Command.cases.SaveAnswers.make({}))
    // Two revisions on from the picture held: no confirm goes, the newer picture is asked for.
    expect([world.draft.confirm, world.draft.heldBack, O.isNone(world.confirm), O.isSome(world.read)]).toEqual([
      "idle",
      O.some({ read: false, apart: 0, accepts: [] }),
      true,
      true
    ])
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect([shown(world.draft), world.draft.heldBack]).toEqual([
      { a: out, b: kept },
      O.some({ read: true, apart: 1, accepts: [] })
    ])
  })

  it("that waits is held back by a newer picture that arrives before its save is answered", () => {
    const world = opened()
    run(world, Command.cases.SomeoneElse.make({ row: "b", to: "kept" }))
    run(world, Command.cases.ReturnToTab.make({}))
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.PressConfirm.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect([world.draft.confirm, world.draft.heldBack]).toEqual(["idle", O.some({ read: true, apart: 1, accepts: [] })])
    run(world, Command.cases.ServerTakesSave.make({}))
    run(world, Command.cases.SaveAnswers.make({}))
    expect(O.isNone(world.confirm)).toBe(true)
  })

  it("carries the clear of a decision the person took back and the server never heard of", () => {
    const world = opened({ a: out })
    run(world, Command.cases.Decide.make({ row: "a", to: "nothing" }))
    run(world, Command.cases.SaveFails.make({}))
    run(world, Command.cases.PressConfirm.make({}))
    expect(sent(world)).toEqual(O.some([1, { set: {}, clear: ["a"] }]))
    run(world, Command.cases.ServerTakesConfirm.make({}))
    // Without the clear the import would be confirmed with row a left out, as nobody on this screen saw it.
    expect(closedAs(world)).toEqual(O.some({}))
  })

  it("that did not get through sends nothing and offers no Save again before the import is read; a read that says it is open sends the rows", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.SaveFails.make({}))
    run(world, Command.cases.PressConfirm.make({}))
    run(world, Command.cases.ConfirmFails.make({}))
    // Nothing is sent and nothing offered as a save: the import may be closed. The import is asked for.
    expect([
      world.draft.confirm,
      O.isNone(A.last(world.saves)),
      O.isSome(world.read),
      notSaved(world.draft) > 0
    ]).toEqual(["idle", true, true, false])
    // A Save again pressed from an earlier note asks for the import, and sends nothing.
    const again = step(world.draft, DraftEvent.SaveAgain())
    expect(again.effects).toEqual([DraftEffect.Ask()])
    // It wrote nothing: the read answers the revision held, open, and that is the answer: the rows go by themselves.
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect(O.map(A.last(world.saves), (save) => save.delta)).toEqual(O.some({ set: { a: out }, clear: [] }))
    // Decisions made after it are sent as any are: nothing waits for a picture any more.
    quiet(world)
    expect(world.server.decisions).toEqual({ a: out })
  })

  it("that did not get through, then the step drawn again: the view given again is not the answer, and the next read is", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.SaveFails.make({}))
    run(world, Command.cases.PressConfirm.make({}))
    run(world, Command.cases.ConfirmFails.make({}))
    run(world, Command.cases.Leave.make({}))
    // Back: the view the tab held is given again, and the import is asked for behind it.
    run(world, Command.cases.ComeBackQuickly.make({}))
    expect([world.draft.waitsForPicture, O.isNone(A.last(world.saves))]).toEqual([true, true])
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect([world.draft.waitsForPicture, O.map(A.last(world.saves), (save) => save.delta)]).toEqual([
      false,
      O.some({ set: { a: out }, clear: [] })
    ])
  })
})

describe("rows that wait, kept in the browser", () => {
  /** Row a left out on revision 4, over nothing, never known to be sent. */
  const waitingA: O.Option<Waiting> = O.some({
    rows: { a: waits(O.some(out), 4) },
    lines: {},
    confirms: O.some(0),
    leftOver: O.none()
  })

  it("come back after a reload over what the server holds, and are sent as made on their revision, over what it may hold", () => {
    const back = step(emptyDraft, DraftEvent.Opened({ kept: waitingA }))
    // Nothing is sent before the import's picture has arrived: it says whether the import can still be decided.
    expect([back.effects, R.keys(back.draft.unsent)]).toEqual([[], ["a"]])
    // The picture the step finds goes straight to the server with the row: nothing is judged before it goes.
    const found = step(
      back.draft,
      DraftEvent.ViewArrived({ revision: 9, decisions: { b: kept }, open: true, confirms: 0 })
    )
    expect(shown(found.draft)).toEqual({ a: out, b: kept })
    expect(A.filter(found.effects, DraftEffect.$is("Send"))).toEqual([
      DraftEffect.Send({ id: 1, delta: { set: { a: out }, clear: [] }, madeOn: { a: 4 }, over: { a: [O.none()] } })
    ])
  })

  it("are sent again when a picture arrives after a save that failed, and the failure is said once", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.SaveFails.make({}))
    expect([world.said, notSaved(world.draft) > 0, O.isNone(A.last(world.saves))]).toEqual([1, true, true])
    // An answer of a save nobody waits for (another id) says nothing and changes nothing.
    const stray = step(world.draft, DraftEvent.SaveFailed({ id: 7 }))
    expect([stray.effects, stray.draft]).toEqual([[], world.draft])
    expect(step(world.draft, DraftEvent.SaveRefused({ id: 7, reason: "No." })).draft).toEqual(world.draft)
    run(world, Command.cases.SomeoneElse.make({ row: "b", to: "kept" }))
    run(world, Command.cases.ReturnToTab.make({}))
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect(O.map(A.last(world.saves), (save) => [save.delta, save.over])).toEqual(
      O.some([{ set: { a: out }, clear: [] }, { a: [O.none(), O.some(out)] }])
    )
  })

  it("are named and never sent when somebody else confirms the import, and kept until the result has named them", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.SaveFails.make({}))
    run(world, Command.cases.SomeoneConfirms.make({}))
    run(world, Command.cases.ReturnToTab.make({}))
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    const named = O.some({ rows: { a: O.some(out) }, beside: {}, theirs: {} })
    expect([world.draft.ended, world.draft.leftOver, O.isNone(A.last(world.saves))]).toEqual([true, named, true])
    expect(world.kept).toEqual(O.some({ rows: {}, lines: {}, confirms: O.none(), leftOver: named }))
    // A reload before the result was left: the rows come back as left over, and are named again, not sent.
    run(world, Command.cases.Reload.make({}))
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect([world.draft.leftOver, O.isNone(A.last(world.saves))]).toEqual([named, true])
    dispatch(world, DraftEvent.LeftOverNamed())
    expect([world.draft.leftOver, world.kept]).toEqual([O.none(), O.none()])
  })

  it("that the confirm already wrote are not named: only what the confirmed import does not say", () => {
    const world = opened({ a: out })
    run(world, Command.cases.Decide.make({ row: "b", to: "kept" }))
    run(world, Command.cases.ServerTakesSave.make({}))
    // The server took row b; its answer is lost on the way, and somebody else confirms.
    run(world, Command.cases.SaveFails.make({}))
    run(world, Command.cases.SomeoneConfirms.make({}))
    run(world, Command.cases.ReturnToTab.make({}))
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect([world.draft.ended, world.draft.leftOver]).toEqual([true, O.none()])
  })
})

describe("a save that names what it was made on", () => {
  const accept = decisionFromFlags({ accepted: ["unitCost"], edits: { name: "Steel Tube 1in" } })
  // The Review step is drawn, and holds revision 5.
  const held = step(
    step(emptyDraft, DraftEvent.Opened({ kept: O.none() })).draft,
    DraftEvent.ViewArrived({ revision: 5, decisions: {}, open: true, confirms: 0 })
  ).draft

  it("names the revision the earliest waiting row was decided on, whatever was read since", () => {
    const first = step(held, DraftEvent.Decided({ changes: { a: O.some(out) } }))
    expect(first.effects).toEqual([
      DraftEffect.Send({ id: 1, delta: { set: { a: out }, clear: [] }, madeOn: { a: 5 }, over: {} })
    ])
    // The save fails; a newer picture arrives (somebody matched a column): the row is sent again as made on 5.
    const failed = step(first.draft, DraftEvent.SaveFailed({ id: first.draft.lastId })).draft
    const newer = step(failed, DraftEvent.ViewArrived({ revision: 8, decisions: {}, open: true, confirms: 0 }))
    expect(A.filter(newer.effects, DraftEffect.$is("Send"))).toEqual([
      DraftEffect.Send({
        id: 2,
        delta: { set: { a: out }, clear: [] },
        madeOn: { a: 5 },
        over: { a: [O.none(), O.some(out)] }
      })
    ])
  })

  it("takes out the accepts the server did not apply, keeps the rest of the row, and says which", () => {
    const sent = step(held, DraftEvent.Decided({ changes: { a: O.some(accept) } })).draft
    const stale = [{ rowId: "a", field: "unitCost" }]
    const answered = step(
      sent,
      DraftEvent.SaveAnswered({ id: sent.lastId, revision: 6, changed: true, notApplied: stale, decidedSince: [] })
    )
    const saved = decisionFromFlags({ edits: { name: "Steel Tube 1in" } })
    expect(shown(answered.draft)).toEqual({ a: saved })
    expect(answered.effects).toEqual([
      DraftEffect.Put({ revision: 6, decisions: { a: saved } }),
      DraftEffect.Say({ what: Said.AcceptsTakenBack({ accepts: stale }) }),
      // The region is drawn again from the row as it was saved, and not told of "another screen".
      DraftEffect.Restart({ announce: false })
    ])
  })

  it("asks which items are already there only once the server has the SKU that was typed", () => {
    const sku = decisionFromFlags({ edits: { sku: "X-1" } })
    const first = step(held, DraftEvent.Decided({ changes: { a: O.some(out) } })).draft
    // Typed while the first save is out: it waits behind it.
    const typed = step(first, DraftEvent.Decided({ changes: { b: O.some(sku) } })).draft
    const one = step(
      typed,
      DraftEvent.SaveAnswered({ id: typed.lastId, revision: 6, changed: true, notApplied: [], decidedSince: [] })
    )
    const kinds = A.map(
      DraftEffect.$match({
        Send: () => "send",
        Say: () => "say",
        Ask: () => "ask",
        Put: () => "put",
        Restart: () => "restart",
        Confirm: () => "confirm"
      })
    )
    // The first save's answer sends the SKU, and asks nothing yet: the server does not have it.
    expect(kinds(one.effects)).toEqual(["put", "send"])
    const two = step(
      one.draft,
      DraftEvent.SaveAnswered({ id: one.draft.lastId, revision: 7, changed: true, notApplied: [], decidedSince: [] })
    )
    expect(kinds(two.effects)).toEqual(["put", "ask"])
  })
})

describe("a confirm and the rows around it (his answers 4 and 5)", () => {
  it("made while the person decided another row: the draft ends on the confirmed picture and that row is named", () => {
    const world = opened()
    run(world, Command.cases.PressConfirm.make({}))
    run(world, Command.cases.ServerTakesConfirm.make({}))
    // The commit takes seconds on a large file; the region stays live.
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.ConfirmAnswers.make({}))
    const named = O.some({ rows: { a: O.some(out) }, beside: {}, theirs: {} })
    expect([world.draft.ended, world.draft.leftOver, world.kept]).toEqual([
      true,
      named,
      O.some({ rows: {}, lines: {}, confirms: O.none(), leftOver: named })
    ])
  })

  it("refused because somebody else confirmed it sends nothing: the import is read, and its rows are named", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.SaveFails.make({}))
    run(world, Command.cases.SomeoneConfirms.make({}))
    run(world, Command.cases.PressConfirm.make({}))
    // The server answers AlreadyImported.
    run(world, Command.cases.ConfirmFails.make({}))
    expect([O.isNone(A.last(world.saves)), O.isSome(world.read)]).toEqual([true, true])
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect([O.isNone(A.last(world.saves)), world.draft.ended, world.draft.leftOver]).toEqual([
      true,
      true,
      O.some({ rows: { a: O.some(out) }, beside: {}, theirs: {} })
    ])
  })

  it("made, with its answer lost on the way back: nothing is sent, and the closed picture names nothing it wrote", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.SaveFails.make({}))
    run(world, Command.cases.PressConfirm.make({}))
    run(world, Command.cases.ServerTakesConfirm.make({}))
    expect(closedAs(world)).toEqual(O.some({ a: out }))
    run(world, Command.cases.ConfirmFails.make({}))
    expect(O.isNone(A.last(world.saves))).toBe(true)
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect([O.isNone(A.last(world.saves)), world.draft.ended, world.draft.leftOver]).toEqual([true, true, O.none()])
  })

  it("kept from before a reload, of an import confirmed and opened again since: named once, and not sent into it", () => {
    const kept: O.Option<Waiting> = O.some({
      rows: { a: waits(O.some(out), 4) },
      lines: {},
      confirms: O.some(0),
      leftOver: O.none()
    })
    const back = step({ ...emptyDraft, onScreen: true }, DraftEvent.Opened({ kept }))
    const arrived = step(back.draft, DraftEvent.ViewArrived({ revision: 9, decisions: {}, open: true, confirms: 1 }))
    expect(A.some(arrived.effects, DraftEffect.$is("Send"))).toBe(false)
    expect(A.filter(arrived.effects, DraftEffect.$is("Say"))).toEqual([
      DraftEffect.Say({ what: Said.Outlived({ rows: { a: O.some(out) }, beside: {}, theirs: {} }) })
    ])
    expect([arrived.draft.unsent, waiting(arrived.draft)]).toEqual([{}, O.none()])
  })
})

describe("what a save and a confirm name", () => {
  const atFour = step(emptyDraft, DraftEvent.ViewArrived({ revision: 4, decisions: {}, open: true, confirms: 0 })).draft

  it("names each row's own revision: a row waiting from long ago never dates a newer one", () => {
    const sent = step(atFour, DraftEvent.Decided({ changes: { a: O.some(out) } }))
    const failed = step(sent.draft, DraftEvent.SaveFailed({ id: sent.draft.lastId }))
    // A newer picture: the resend of row a goes, and fails again.
    const resent = step(failed.draft, DraftEvent.ViewArrived({ revision: 5, decisions: {}, open: true, confirms: 0 }))
    const again = step(resent.draft, DraftEvent.SaveFailed({ id: resent.draft.lastId }))
    // Row b goes with it, made on 5; row a keeps 4, and goes over what the server may hold of it (nothing, or the
    // leave-out sent twice).
    const both = step(again.draft, DraftEvent.Decided({ changes: { b: O.some(kept) } }))
    expect(A.filter(both.effects, DraftEffect.$is("Send"))).toEqual([
      DraftEffect.Send({
        id: 3,
        delta: { set: { a: out, b: kept }, clear: [] },
        madeOn: { a: 4, b: 5 },
        over: { a: [O.none(), O.some(out)] }
      })
    ])
  })

  it("decided and undone before anything of it was sent: the entry goes, and no clear is sent", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "b", to: "kept" }))
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.Decide.make({ row: "a", to: "nothing" }))
    expect(world.draft.unsent).toEqual({})
    run(world, Command.cases.ServerTakesSave.make({}))
    run(world, Command.cases.SaveAnswers.make({}))
    expect(O.isNone(A.last(world.saves))).toBe(true)
  })

  it("a row decided again behind a save whose accept was not applied loses that accept too", () => {
    const accepted = decisionFromFlags({ accepted: ["unitCost"] })
    const named = decisionFromFlags({ accepted: ["unitCost"], edits: { name: "Bolt" } })
    const out1 = step(atFour, DraftEvent.Decided({ changes: { r: O.some(accepted) } }))
    const behind = step(out1.draft, DraftEvent.Decided({ changes: { r: O.some(named) } }))
    const answered = step(
      behind.draft,
      DraftEvent.SaveAnswered({
        id: behind.draft.lastId,
        revision: 5,
        changed: true,
        notApplied: [{ rowId: "r", field: "unitCost" }],
        decidedSince: []
      })
    )
    expect(A.filter(answered.effects, DraftEffect.$is("Send"))).toEqual([
      DraftEffect.Send({
        id: 2,
        delta: { set: { r: decisionFromFlags({ edits: { name: "Bolt" } }) }, clear: [] },
        madeOn: { r: 4 },
        over: {}
      })
    ])
  })
})

describe("a confirm held back (the line that says nothing was imported)", () => {
  const atFour = step(emptyDraft, DraftEvent.ViewArrived({ revision: 4, decisions: {}, open: true, confirms: 0 })).draft

  it("that waits for its save goes on the save's own picture, read before the save's answer", () => {
    const world = opened()
    run(world, Command.cases.Decide.make({ row: "a", to: "out" }))
    run(world, Command.cases.PressConfirm.make({}))
    run(world, Command.cases.ServerTakesSave.make({}))
    // The read taken after the save brings the person's own row back before the save's answer does.
    run(world, Command.cases.ReturnToTab.make({}))
    run(world, Command.cases.ServerTakesRead.make({}))
    run(world, Command.cases.ReadArrives.make({}))
    expect([world.draft.confirm, world.draft.heldBack]).toEqual(["waiting", O.none()])
    run(world, Command.cases.SaveAnswers.make({}))
    expect(O.map(world.confirm, (confirm) => confirm.revision)).toEqual(O.some(2))
  })

  it("that waits is held back by a picture later than its save's, even one that changes nothing shown", () => {
    const sending = step(atFour, DraftEvent.Decided({ changes: { a: O.some(out) } }))
    const waits = step(sending.draft, DraftEvent.ConfirmPressed())
    // A match elsewhere (no decision changed) and then the person's row, read at 6.
    const later = step(
      waits.draft,
      DraftEvent.ViewArrived({ revision: 6, decisions: { a: out }, open: true, confirms: 0 })
    )
    expect(later.draft.confirm).toBe("waiting")
    const answered = step(
      later.draft,
      DraftEvent.SaveAnswered({ id: later.draft.lastId, revision: 5, changed: true, notApplied: [], decidedSince: [] })
    )
    expect([A.some(answered.effects, DraftEffect.$is("Confirm")), answered.draft.heldBack]).toEqual([
      false,
      O.some({ read: true, apart: 0, accepts: [] })
    ])
  })

  it("refused for an accept taken back is held back with that accept, read at once, and the person can confirm again", () => {
    const accepted = decisionFromFlags({ accepted: ["unitCost"] })
    const decided = step(atFour, DraftEvent.SaveFailed({ id: atFour.lastId }))
    const withRow = step(decided.draft, DraftEvent.Decided({ changes: { r: O.some(accepted) } }))
    const failed = step(withRow.draft, DraftEvent.SaveFailed({ id: withRow.draft.lastId }))
    const pressed = step(failed.draft, DraftEvent.ConfirmPressed())
    expect(pressed.draft.confirm).toBe("out")
    const stale = step(
      pressed.draft,
      DraftEvent.ConfirmStale({ id: pressed.draft.lastId, accepts: [{ rowId: "r", field: "unitCost" }] })
    )
    // The server checked the revision before the accepts: the screen holds the picture the confirm named, so there is
    // nothing newer to read and the button is free at once (it stayed waiting for a picture nobody would bring).
    expect([stale.draft.heldBack, A.some(stale.effects, DraftEffect.$is("Ask"))]).toEqual([
      O.some({ read: true, apart: 0, accepts: [{ rowId: "r", field: "unitCost" }] }),
      true
    ])
    expect(step(stale.draft, DraftEvent.ConfirmPressed()).draft.confirm).not.toBe("idle")
    // The row's only decision was the accept: without it, it is a decision the person never made, and nothing is
    // sent or kept for it.
    expect([A.filter(stale.effects, DraftEffect.$is("Send")), stale.draft.unsent, waiting(stale.draft)]).toEqual([
      [],
      {},
      O.none()
    ])
  })

  it("refused for an accept taken back keeps the rest of a row that had more than the accept", () => {
    const named = decisionFromFlags({ accepted: ["unitCost"], edits: { name: "Bolt" } })
    const failed = step(
      step(atFour, DraftEvent.Decided({ changes: { r: O.some(named) } })).draft,
      DraftEvent.SaveFailed({ id: 1 })
    )
    const pressed = step(failed.draft, DraftEvent.ConfirmPressed())
    const stale = step(
      pressed.draft,
      DraftEvent.ConfirmStale({ id: pressed.draft.lastId, accepts: [{ rowId: "r", field: "unitCost" }] })
    )
    // Sent again at once, without the accept.
    expect(O.map(stale.draft.flight, (flight) => R.map(flight.rows, (side) => side.decision))).toEqual(
      O.some({ r: O.some(decisionFromFlags({ edits: { name: "Bolt" } })) })
    )
  })
})

describe("orderings the properties met, pinned", () => {
  // Each is played as the properties play an ordering, and every rule they check after it is checked here too.
  it("a closed tab's refused decision, beside the one this tab took up and sent, is settled when she decides the row again: nothing of it is owed", () => {
    expect(
      broken([
        Command.cases.TakeUp.make({ row: "a", to: "out", beside: "no", as: "waiting" }),
        Command.cases.Decide.make({ row: "a", to: "acceptedOut" }),
        Command.cases.TakeUp.make({ row: "a", to: "acceptedOut", beside: "refused", as: "waiting" }),
        Command.cases.Decide.make({ row: "a", to: "accepted" }),
        Command.cases.Decide.make({ row: "a", to: "acceptedOut" }),
        Command.cases.Reload.make({})
      ])
    ).toEqual(O.none())
  })

  it("her own decision trimmed by a match to what a closed tab was refused is still hers, and goes", () => {
    expect(
      broken([
        Command.cases.Decide.make({ row: "a", to: "accepted" }),
        Command.cases.Match.make({}),
        Command.cases.Decide.make({ row: "a", to: "acceptedOut" }),
        Command.cases.TakeUp.make({ row: "a", to: "out", beside: "refused", as: "refused" })
      ])
    ).toEqual(O.none())
  })

  it("a row decided again behind a failed save, beside somebody else's answer, does not wait for nothing after a confirm", () => {
    expect(
      broken([
        Command.cases.Decide.make({ row: "a", to: "out" }),
        Command.cases.ServerTakesSave.make({}),
        Command.cases.SomeoneElse.make({ row: "c", to: "out" }),
        Command.cases.Decide.make({ row: "c", to: "kept" }),
        Command.cases.OtherAnswerSent.make({}),
        Command.cases.SaveFails.make({}),
        Command.cases.OtherAnswerArrives.make({}),
        Command.cases.Decide.make({ row: "a", to: "nothing" }),
        Command.cases.PressConfirm.make({})
      ])
    ).toEqual(O.none())
  })
  it("a pick sent behind a confirm whose answer ends the draft, refused as decided since, comes back as a line: never dropped with the draft it went out from", () => {
    expect(
      broken([
        Command.cases.SomeoneElse.make({ row: "b", to: "acceptedOut" }),
        Command.cases.Match.make({}),
        Command.cases.SomeoneConfirms.make({}),
        Command.cases.PressConfirm.make({}),
        Command.cases.TakeUp.make({ row: "b", to: "accepted", beside: "another", as: "landed" }),
        Command.cases.OtherAnswerSent.make({}),
        Command.cases.SomeoneReopens.make({}),
        Command.cases.SomeoneElse.make({ row: "b", to: "accepted" }),
        Command.cases.SettleAll.make({ which: "theirs" })
      ])
    ).toEqual(O.none())
  })

  it("that line does not count her as having seen what was decided since: a colleague's later decision is not written over unasked", () => {
    expect(
      broken([
        Command.cases.SomeoneConfirms.make({}),
        Command.cases.PressConfirm.make({}),
        Command.cases.TakeUp.make({ row: "b", to: "accepted", beside: "another", as: "landed" }),
        Command.cases.OtherAnswerSent.make({}),
        Command.cases.SomeoneReopens.make({}),
        Command.cases.SomeoneElse.make({ row: "b", to: "kept" })
      ])
    ).toEqual(O.none())
  })
})

describe("a save's answer that comes after its draft closed", () => {
  const acceptName = decisionFromFlags({ accepted: ["name"] })
  /** The events played from nothing: the draft they leave, and everything they asked for, in order. */
  const played = (events: ReadonlyArray<DraftEvent>) =>
    A.reduce(events, { draft: emptyDraft, effects: A.empty<DraftEffect>() }, (before, event) => {
      const next = step(before.draft, event)
      return { draft: next.draft, effects: [...before.effects, ...next.effects] }
    })
  const sends = (effects: ReadonlyArray<DraftEffect>) => A.filter(effects, DraftEffect.$is("Send"))
  const answer = (
    id: number,
    revision: number,
    decidedSince: ReadonlyArray<{ rowId: string; theirs: O.Option<SavedDecisions[string]> }>
  ) => DraftEvent.SaveAnswered({ id, revision, changed: false, notApplied: [], decidedSince })
  /** Row a left out on revision 4, its save failed and sent again (id 2), and the import closed at 6 while it was out. */
  const closedWithSaveOut = (closedHolds: SavedDecisions): ReadonlyArray<DraftEvent> => [
    DraftEvent.Opened({ kept: O.none() }),
    DraftEvent.ViewArrived({ revision: 4, decisions: {}, open: true, confirms: 0 }),
    DraftEvent.Decided({ changes: { a: O.some(out) } }),
    DraftEvent.SaveFailed({ id: 1 }),
    DraftEvent.SaveAgain(),
    DraftEvent.ViewArrived({ revision: 6, decisions: closedHolds, open: false, confirms: 1 })
  ]

  it("does not bring her refused pick back against her own newer decision of the row, saved and answered since", () => {
    // The closed picture named row a (it held another decision): the late answer adds nothing.
    const named = played([
      ...closedWithSaveOut({ a: kept }),
      DraftEvent.ViewArrived({ revision: 7, decisions: {}, open: true, confirms: 1 }),
      DraftEvent.Decided({ changes: { a: O.some(acceptName) } }),
      DraftEvent.SaveAnswered({ id: 3, revision: 8, changed: true, notApplied: [], decidedSince: [] }),
      answer(2, 5, [{ rowId: "a", theirs: O.some(kept) }])
    ])
    expect([named.draft.lines, shown(named.draft)]).toEqual([{}, { a: acceptName }])
    // The closed picture held her decision, so nothing named it; she decided the row again in the reopened import, and
    // that is saved: what the late answer calls decided since is hers.
    const held = played([
      ...closedWithSaveOut({ a: out }),
      DraftEvent.ViewArrived({ revision: 7, decisions: { a: out }, open: true, confirms: 1 }),
      DraftEvent.Decided({ changes: { a: O.some(acceptName) } }),
      DraftEvent.SaveAnswered({ id: 3, revision: 8, changed: true, notApplied: [], decidedSince: [] }),
      answer(2, 8, [{ rowId: "a", theirs: O.some(acceptName) }])
    ])
    expect([held.draft.lines, shown(held.draft)]).toEqual([{}, { a: acceptName }])
  })

  it("brings her refused pick back on the revision it was made on: a pick of it is sent with that revision", () => {
    const events = [
      DraftEvent.Opened({ kept: O.none() }),
      DraftEvent.ViewArrived({ revision: 4, decisions: {}, open: true, confirms: 0 }),
      DraftEvent.Decided({ changes: { a: O.some(accepted) } }),
      // Closed holding her decision, opened again, and somebody decides the row: then her save is judged.
      DraftEvent.ViewArrived({ revision: 5, decisions: { a: accepted }, open: false, confirms: 1 }),
      DraftEvent.ViewArrived({ revision: 7, decisions: { a: kept }, open: true, confirms: 1 }),
      answer(1, 7, [{ rowId: "a", theirs: O.some(kept) }])
    ]
    const before = played(events)
    expect(A.map(before.draft.lines.a?.sides ?? [], (side) => side.madeOn)).toEqual([4])
    const picked = step(
      before.draft,
      DraftEvent.Settled({ picks: [{ rowId: "a", keep: Keep.Side({ decision: O.some(accepted) }) }] })
    )
    expect(A.map(sends(picked.effects), (send) => send.madeOn)).toEqual([{ a: 4 }])
  })

  it("does not name a row a second time, nor put on a line one already said not to be sent, when its draft named it closing", () => {
    // Named by the result, then the late answer: not named again (whatever revision it says).
    for (const revision of [5, 7]) {
      const named = played([
        ...closedWithSaveOut({ a: kept }),
        DraftEvent.LeftOverNamed(),
        answer(2, revision, [{ rowId: "a", theirs: O.some(kept) }])
      ])
      expect(named.draft.leftOver).toEqual(O.none())
    }
    // Said as outlived when the import opened again, then the late answer: not offered to be sent.
    const reopened = played([
      ...closedWithSaveOut({ a: kept }),
      DraftEvent.ViewArrived({ revision: 7, decisions: { a: kept }, open: true, confirms: 1 })
    ])
    expect(
      A.filter(reopened.effects, (effect) => DraftEffect.$is("Say")(effect) && Said.$is("Outlived")(effect.what))
    ).toHaveLength(1)
    const late = step(reopened.draft, answer(2, 8, [{ rowId: "a", theirs: O.some(kept) }]))
    expect([late.draft.lines, late.draft.unsent]).toEqual([{}, {}])
  })

  it("keeps the line of a pick refused in the reopened import while the picture the answer names is read", () => {
    const events = [
      DraftEvent.Opened({ kept: O.none() }),
      DraftEvent.ViewArrived({ revision: 4, decisions: {}, open: true, confirms: 0 }),
      DraftEvent.Decided({ changes: { a: O.some(out) } }),
      // Closed holding her decision, so nothing named it; opened again and held at 7.
      DraftEvent.ViewArrived({ revision: 6, decisions: { a: out }, open: false, confirms: 1 }),
      DraftEvent.ViewArrived({ revision: 7, decisions: { a: out }, open: true, confirms: 1 }),
      // Her save was judged at 9: somebody had decided the row since.
      answer(1, 9, [{ rowId: "a", theirs: O.some(kept) }])
    ]
    const gap = played(events)
    expect([R.keys(gap.draft.lines), R.keys(gap.draft.unsent), R.get(shown(gap.draft), "a")]).toEqual([
      ["a"],
      [],
      O.some(kept)
    ])
    // A save sent in the gap does not carry her refused pick.
    const other = step(gap.draft, DraftEvent.Decided({ changes: { b: O.some(kept) } }))
    expect(A.map(sends(other.effects), (send) => R.keys(send.delta.set))).toEqual([["b"]])
  })

  it("puts no line over a row the closed picture held as hers when the answer was judged before that picture", () => {
    // The answer is from revision 5, before the import closed at 6 holding her decision: what it calls decided since
    // is older than the picture that held hers.
    const late = played([
      ...closedWithSaveOut({ a: out }),
      DraftEvent.ViewArrived({ revision: 7, decisions: { a: out }, open: true, confirms: 1 }),
      answer(2, 5, [{ rowId: "a", theirs: O.some(kept) }])
    ])
    expect([late.draft.lines, late.draft.unsent]).toEqual([{}, {}])
  })

  it("names once a row whose later decision of hers waited behind the save when its draft closed", () => {
    // Left out, sent, then kept while that save was out: the closed picture holds the first, and the second was named
    // closing. The late answer of the first adds neither a line nor a row to send.
    const waited = played([
      DraftEvent.Opened({ kept: O.none() }),
      DraftEvent.ViewArrived({ revision: 4, decisions: {}, open: true, confirms: 0 }),
      DraftEvent.Decided({ changes: { a: O.some(out) } }),
      DraftEvent.Decided({ changes: { a: O.some(kept) } }),
      DraftEvent.ViewArrived({ revision: 6, decisions: { a: out }, open: false, confirms: 1 }),
      DraftEvent.ViewArrived({ revision: 7, decisions: { a: accepted }, open: true, confirms: 1 }),
      answer(1, 7, [{ rowId: "a", theirs: O.some(accepted) }])
    ])
    expect([waited.draft.lines, waited.draft.unsent]).toEqual([{}, {}])
  })
})

describe("seeds the properties were falsified by, played again", () => {
  const seeds = [
    {
      name: "with the person confirming",
      seed: 369148268449177,
      may: { confirms: true, elsewhere: false, tabs: false }
    },
    {
      name: "with the person confirming",
      seed: -2416120108841983,
      may: { confirms: true, elsewhere: false, tabs: false }
    },
    {
      name: "with somebody else confirming, reopening or removing the import",
      seed: 5903557278919753,
      may: { confirms: true, elsewhere: true, tabs: true }
    }
  ] as const
  for (const { may, name, seed } of seeds) {
    // The same limit as the four above: a seeded one took 12.8 s at its slowest in three runs of 1,000, measured with
    // other test runs busy on the same machine.
    it.prop(`${name}, seed ${seed}`, { choices: Choices }, ({ choices }) => play(choices, may), {
      timeout: limit,
      arbitrary: { runs, size: 60, seed }
    })
  }
})
