// The review's draft against a server and a network that answer in any order: the person decides, somebody else
// saves, a save is taken by the server and answered late, fails or is refused, reads and other answers arrive out of
// turn, the person leaves the Review step and comes back. Each rule here is one where a wrong result loses a decision
// without a word: the person's own, or one somebody else made on the same import.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Eq from "effect/Equal"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { type DecisionDelta, decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import {
  type Draft,
  type DraftEffect,
  DraftEvent,
  emptyDraft,
  over,
  type Picture,
  type RowChanges,
  settled,
  shown,
  step
} from "../src/Draft.machine.ts"

const out = decisionFromFlags({ out: true })
const kept = decisionFromFlags({ kept: true })

const Row = S.Literals(["a", "b", "c"])
const To = S.Literals(["out", "kept", "nothing"])
const tagged = <const Tag extends string>(tag: Tag) => S.Struct({ _tag: S.tag(tag) })

/** Everything that can happen, in any order. */
const Command = S.Union([
  S.Struct({ _tag: S.tag("Decide"), row: Row, to: To }),
  S.Struct({ _tag: S.tag("SomeoneElse"), row: Row, to: To }),
  tagged("ServerTakesSave"),
  tagged("SaveAnswers"),
  tagged("SaveFails"),
  tagged("SaveRefused"),
  tagged("SaveAgain"),
  tagged("ReturnToTab"),
  tagged("ServerTakesRead"),
  tagged("ReadArrives"),
  tagged("OtherAnswerSent"),
  tagged("OtherAnswerArrives"),
  tagged("Leave"),
  tagged("ComeBack")
])
type Command = typeof Command.Type

const change = (row: string, to: "out" | "kept" | "nothing"): RowChanges => ({
  [row]: to === "nothing" ? O.none() : O.some(to === "out" ? out : kept)
})

/** The screen, the server, and what is on its way between them. */
interface World {
  draft: Draft
  server: Picture
  /** The import's view as the tab holds it: what every screen of the import reads. */
  view: O.Option<Picture>
  /** The save that is out: on its way, or taken by the server with the revision it will answer. */
  save: O.Option<{ readonly delta: DecisionDelta; readonly answer: O.Option<number> }>
  /** The read that is out: on its way, or taken by the server with the picture it will answer. */
  read: O.Option<O.Option<Picture>>
  /** Pictures on their way from other requests (a match, a card's Continue), oldest first. */
  late: Array<Picture>
  /** The rows the person changed on this screen that the server has not confirmed, each with what they chose. */
  dirty: Record<string, "out" | "kept" | "nothing">
  /** The rows the server confirmed for the person, until somebody else changes the row or the person does again. */
  confirmed: Record<string, "out" | "kept" | "nothing">
  /** Rows of the save the server has taken that somebody else decided again before its answer arrived. */
  overtaken: Record<string, true>
  /** Every picture the server has held, by revision. */
  history: Record<number, SavedDecisions>
  /**
   * The server took a save of the person's that changed nothing (somebody else had just decided the same): its answer
   * names their revision, which reads as the person's own. Until the next read, the picture held may lack their rows.
   */
  mayLack: boolean
  restarts: number
}

const start = (): World => ({
  draft: emptyDraft,
  server: { revision: 1, decisions: {} },
  view: O.none(),
  save: O.none(),
  read: O.none(),
  late: [],
  dirty: {},
  confirmed: {},
  overtaken: {},
  history: { 1: {} },
  mayLack: false,
  restarts: 0
})

/** The server takes rows; true when they changed something. A save that changes nothing is no new revision. */
const serverTakes = (world: World, changes: RowChanges): boolean => {
  const next = over(world.server.decisions, changes)
  if (Eq.equals(next, world.server.decisions)) return false
  world.server = { revision: world.server.revision + 1, decisions: next }
  world.history[world.server.revision] = next
  return true
}

const valueOf = (to: "out" | "kept" | "nothing") => (to === "nothing" ? O.none() : O.some(to === "out" ? out : kept))

/** A picture is put into the tab's view: never one of an earlier revision, and an ask that is out is issued again. */
const put = (world: World, picture: Picture): void => {
  if (O.exists(world.view, (view) => view.revision > picture.revision)) return
  world.view = O.some(picture)
  if (O.isSome(world.read)) world.read = O.some(O.none())
  if (world.draft.onScreen) dispatch(world, DraftEvent.ViewArrived(picture))
}

const perform = (world: World, effect: DraftEffect): void => {
  if (effect._tag === "Send") {
    // One save at a time, and only of rows the person changed here and the server has not confirmed.
    expect(O.isNone(world.save)).toBe(true)
    for (const row of [...R.keys(effect.delta.set), ...effect.delta.clear]) {
      expect(R.has(world.dirty, row)).toBe(true)
      // And what is sent for the row is what the person last chose for it.
      expect(R.get(effect.delta.set, row)).toEqual(valueOf(world.dirty[row] ?? "nothing"))
    }
    world.save = O.some({ delta: effect.delta, answer: O.none() })
  } else if (effect._tag === "Ask") world.read = O.some(O.none())
  else if (effect._tag === "Put") {
    // The person's own save moves the view on, never back.
    expect(O.exists(world.view, (view) => view.revision > effect.revision)).toBe(false)
    put(world, { revision: effect.revision, decisions: effect.decisions })
  } else world.restarts += 1
}

const dispatch = (world: World, event: DraftEvent): void => {
  const stepped = step(world.draft, event)
  world.draft = stepped.draft
  for (const effect of stepped.effects) perform(world, effect)
}

const sentRows = (delta: DecisionDelta): ReadonlyArray<string> => [...R.keys(delta.set), ...delta.clear]

const run = (world: World, command: Command): void => {
  switch (command._tag) {
    case "Decide": {
      const changes = change(command.row, command.to)
      if (!world.draft.onScreen || O.isNone(world.draft.held)) return
      if (Eq.equals(over(shown(world.draft), changes), shown(world.draft))) return
      world.dirty[command.row] = command.to
      delete world.confirmed[command.row]
      return dispatch(world, DraftEvent.Decided({ changes }))
    }
    case "SomeoneElse":
      if (serverTakes(world, change(command.row, command.to))) {
        delete world.confirmed[command.row]
        // Decided after the server took the person's save of the same row: theirs is the later word.
        if (O.exists(world.save, (save) => O.isSome(save.answer) && A.contains(sentRows(save.delta), command.row))) {
          world.overtaken[command.row] = true
        }
      }
      return
    case "ServerTakesSave":
      return O.match(world.save, {
        onNone: () => {},
        onSome: (save) => {
          if (O.isSome(save.answer)) return
          const changed = serverTakes(world, {
            ...R.map(save.delta.set, (decision) => O.some(decision)),
            ...R.fromEntries(A.map(save.delta.clear, (row) => [row, O.none()] as const))
          })
          if (!changed) world.mayLack = true
          world.save = O.some({ delta: save.delta, answer: O.some(world.server.revision) })
        }
      })
    case "SaveAnswers":
      return O.match(world.save, {
        onNone: () => {},
        onSome: (save) => {
          if (O.isNone(save.answer)) return
          world.save = O.none()
          // Confirmed, unless the person changed the row again since it was sent.
          for (const row of sentRows(save.delta)) {
            const chose = world.dirty[row]
            if (!R.has(world.draft.unsent, row) && chose !== undefined) {
              if (!R.has(world.overtaken, row)) world.confirmed[row] = chose
              delete world.dirty[row]
            }
          }
          world.overtaken = {}
          dispatch(world, DraftEvent.SaveAnswered({ revision: save.answer.value }))
        }
      })
    case "SaveFails":
      if (O.isNone(world.save)) return
      world.save = O.none()
      return dispatch(world, DraftEvent.SaveFailed())
    case "SaveRefused":
      if (!O.exists(world.save, (save) => O.isNone(save.answer))) return
      world.save = O.none()
      world.dirty = {}
      return dispatch(world, DraftEvent.SaveRefused())
    case "SaveAgain":
      if (world.draft.stalled) dispatch(world, DraftEvent.SaveAgain())
      return
    case "ReturnToTab":
      if (world.draft.onScreen) world.read = O.some(O.none())
      return
    case "ServerTakesRead":
      if (O.exists(world.read, O.isNone)) world.read = O.some(O.some(world.server))
      return
    case "ReadArrives":
      return O.match(O.flatten(world.read), {
        onNone: () => {},
        onSome: (picture) => {
          world.read = O.none()
          world.mayLack = false
          put(world, picture)
        }
      })
    case "OtherAnswerSent":
      world.late.push(world.server)
      return
    case "OtherAnswerArrives": {
      const picture = world.late.shift()
      if (picture !== undefined) put(world, picture)
      return
    }
    case "Leave":
      if (world.draft.onScreen) dispatch(world, DraftEvent.Left())
      return
    case "ComeBack":
      if (world.draft.onScreen) return
      dispatch(world, DraftEvent.Opened())
      // The step reads the view it finds, and asks again behind it.
      O.map(world.view, (view) => dispatch(world, DraftEvent.ViewArrived(view)))
      world.read = O.some(O.none())
      return
  }
}

/** Holds after every step, whatever happened before it. */
const holds = (world: World): void => {
  // The screen never claims a revision the server has not reached.
  O.map(world.draft.held, (held) => expect(held.revision).toBeLessThanOrEqual(world.server.revision))
  // While the step is drawn, what it holds of the server is the view the tab holds: never ahead of it, never behind.
  if (world.draft.onScreen) {
    expect(O.map(world.draft.held, (held) => held.revision)).toEqual(O.map(world.view, (view) => view.revision))
  }
  // What it holds is what the server held at that revision: a revision is never claimed for another picture.
  O.map(world.draft.held, (held) => {
    if (!world.mayLack) expect(held.decisions).toEqual(world.history[held.revision])
  })
  // The person's own decision stays on screen: while it waits to be saved, and once the server has it, until
  // somebody else decides that row.
  if (O.isSome(world.draft.held)) {
    const onScreen = shown(world.draft)
    for (const [row, chose] of R.toEntries({ ...world.confirmed, ...world.dirty })) {
      expect(R.get(onScreen, row)).toEqual(valueOf(chose))
    }
  }
}

/** Everything on its way lands, and the person presses "Save again" where it is offered. */
const quiet = (world: World): void => {
  run(world, { _tag: "ComeBack" })
  for (let turn = 0; turn < 12; turn += 1) {
    run(world, { _tag: "SaveAgain" })
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    while (world.late.length > 0) run(world, { _tag: "OtherAnswerArrives" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    holds(world)
  }
  // One more look at the server, as any return to the tab gives.
  run(world, { _tag: "ReturnToTab" })
  run(world, { _tag: "ServerTakesRead" })
  run(world, { _tag: "ReadArrives" })
}

const opened = (decisions: SavedDecisions = {}): World => {
  const world = start()
  world.server = { revision: 1, decisions }
  run(world, { _tag: "ComeBack" })
  run(world, { _tag: "ServerTakesRead" })
  run(world, { _tag: "ReadArrives" })
  return world
}

describe("the review's draft, whatever order things happen in", () => {
  it.prop(
    "sends only the person's own rows, never runs ahead of the server, and ends showing what the server holds",
    { commands: S.Array(Command).check(S.isMaxLength(40)) },
    ({ commands }) => {
      const world = opened()
      for (const command of commands) {
        run(world, command)
        holds(world)
      }
      quiet(world)
      expect(O.isNone(world.save)).toBe(true)
      expect(settled(world.draft)).toBe(true)
      expect(shown(world.draft)).toEqual(world.server.decisions)
    },
    { arbitrary: { runs: 5000 } }
  )
})

describe("the orderings that lost or hid a decision", () => {
  it("back on Review with a decision unsaved, another person's rows are still followed and never sent over", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SaveFails" })
    run(world, { _tag: "Leave" })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "ComeBack" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    // Both are on screen: theirs from the server, the person's own still waiting.
    expect(shown(world.draft)).toEqual({ a: out, b: kept })
    run(world, { _tag: "SaveAgain" })
    expect(O.map(world.save, (save) => save.delta)).toEqual(O.some({ set: { a: out }, clear: [] }))
    quiet(world)
    expect(world.server.decisions).toEqual({ a: out, b: kept })
  })

  it("a quick return after the region was started again starts from what is shown, and the next decision clears nothing", () => {
    const world = opened({ a: out })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "ReturnToTab" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect(world.restarts).toBe(1)
    run(world, { _tag: "Decide", row: "c", to: "out" })
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    run(world, { _tag: "Leave" })
    run(world, { _tag: "ComeBack" })
    expect(shown(world.draft)).toEqual({ a: out, b: kept, c: out })
    run(world, { _tag: "Decide", row: "a", to: "nothing" })
    expect(O.map(world.save, (save) => save.delta)).toEqual(O.some({ set: {}, clear: ["a"] }))
    quiet(world)
    expect(world.server.decisions).toEqual({ b: kept, c: out })
  })

  it("an answer from another request that lands after a later save keeps the decision just saved on screen", () => {
    const world = opened()
    // A match is taken by the server; its answer is slow.
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "OtherAnswerSent" })
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "ServerTakesSave" })
    // The save's answer is two revisions on: the import is asked again.
    run(world, { _tag: "SaveAnswers" })
    expect(O.isSome(world.read)).toBe(true)
    // The match's answer lands now, without the person's row in it.
    run(world, { _tag: "OtherAnswerArrives" })
    expect(shown(world.draft)).toEqual({ a: out, b: kept })
    // The ask is still out, and its answer is the newer picture.
    expect(O.isSome(world.read)).toBe(true)
    quiet(world)
    expect(shown(world.draft)).toEqual({ a: out, b: kept })
  })

  it("a decision the server refused is not shown again on the next visit, and is not sent with the next one", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SaveRefused" })
    run(world, { _tag: "Leave" })
    run(world, { _tag: "ComeBack" })
    expect(shown(world.draft)).toEqual({})
    run(world, { _tag: "Decide", row: "b", to: "kept" })
    expect(O.map(world.save, (save) => save.delta)).toEqual(O.some({ set: { b: kept }, clear: [] }))
  })

  it("a save waiting for Save again does not stop a newer draft from being followed", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SaveFails" })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "ReturnToTab" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect(shown(world.draft)).toEqual({ a: out, b: kept })
    expect(world.restarts).toBe(1)
  })

  it("a save answered after the person left is the person's own: the view moves on, and the return starts nothing again", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "Leave" })
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    expect(O.map(world.view, (view) => view.revision)).toEqual(O.some(2))
    run(world, { _tag: "ComeBack" })
    expect(shown(world.draft)).toEqual({ a: out })
    expect(world.restarts).toBe(0)
  })

  it("a save the server counts as no change does not hide what the other person saved beside it", () => {
    const world = opened()
    run(world, { _tag: "SomeoneElse", row: "a", to: "out" })
    run(world, { _tag: "SomeoneElse", row: "a", to: "nothing" })
    // Revision 3 on the server, 1 on screen. The person's save is a new decision: revision 4.
    run(world, { _tag: "Decide", row: "b", to: "kept" })
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    // Not the next revision after the one held: the import is asked again, the row stays on screen meanwhile.
    expect(shown(world.draft)).toEqual({ b: kept })
    expect(O.isSome(world.read)).toBe(true)
  })
})
