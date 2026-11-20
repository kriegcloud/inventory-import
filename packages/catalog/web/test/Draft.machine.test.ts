// The review's draft against a server and a network that answer in any order: the person decides, somebody else
// saves, a save is taken by the server and answered late, fails or is refused, reads and other answers arrive out of
// turn, the person leaves the Review step and comes back. Each rule here is one where a wrong result loses a decision
// without a word: the person's own, or one somebody else made on the same import. And the person confirms: a confirm
// the server makes writes exactly the decisions the screen showed when it was sent, never one it had not shown.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Eq from "effect/Equal"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { type DecisionDelta, decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import {
  type Draft,
  DraftEffect,
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
/** Everything that can happen, in any order. */
const Command = S.TaggedUnion({
  Decide: { row: Row, to: To },
  SomeoneElse: { row: Row, to: To },
  ServerTakesSave: {},
  SaveAnswers: {},
  SaveFails: {},
  SaveRefused: {},
  SaveAgain: {},
  ReturnToTab: {},
  ServerTakesRead: {},
  ReadArrives: {},
  OtherAnswerSent: {},
  OtherAnswerArrives: {},
  Leave: {},
  ComeBack: {},
  PressConfirm: {},
  ServerTakesConfirm: {},
  ConfirmAnswers: {},
  ConfirmFails: {}
})
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
  /** The save that is out: on its way, or taken by the server with what it will answer. */
  save: O.Option<{
    readonly delta: DecisionDelta
    readonly answer: O.Option<{ readonly revision: number; readonly changed: boolean }>
  }>
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
  restarts: number
  /**
   * The confirm that is out: the revision it names, the rows it carries, what the screen showed when it was sent,
   * and what the server did with it once it has taken it.
   */
  confirm: O.Option<{
    readonly revision: number
    readonly delta: DecisionDelta
    readonly shown: SavedDecisions
    readonly answer: O.Option<"made" | "moved">
  }>
  /** The server made a confirm: the import is closed, and these are the decisions it was written with. */
  closed: O.Option<SavedDecisions>
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
  restarts: 0,
  confirm: O.none(),
  closed: O.none()
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

/** Only rows the person changed here and the server has not confirmed, each as the person last chose it. */
const ownRows = (world: World, delta: DecisionDelta): void => {
  for (const row of [...R.keys(delta.set), ...delta.clear]) {
    expect(R.has(world.dirty, row)).toBe(true)
    expect(R.get(delta.set, row)).toEqual(valueOf(world.dirty[row] ?? "nothing"))
  }
}

const perform = (world: World, effect: DraftEffect): void =>
  DraftEffect.$match(effect, {
    Send: ({ delta }) => {
      // One save at a time, never beside a confirm, and only of the person's own rows.
      expect([O.isNone(world.save), O.isNone(world.confirm)]).toEqual([true, true])
      ownRows(world, delta)
      world.save = O.some({ delta, answer: O.none() })
    },
    Ask: () => {
      world.read = O.some(O.none())
    },
    Put: ({ decisions, revision }) => {
      // The person's own save moves the view on, never back.
      expect(O.exists(world.view, (view) => view.revision > revision)).toBe(false)
      put(world, { revision, decisions })
    },
    Restart: () => {
      world.restarts += 1
    },
    Confirm: ({ delta, revision }) => {
      // One confirm at a time, never beside a save, carrying only the person's own rows: never the picture.
      expect([O.isNone(world.save), O.isNone(world.confirm)]).toEqual([true, true])
      ownRows(world, delta)
      world.confirm = O.some({ revision, delta, shown: shown(world.draft), answer: O.none() })
    }
  })

const dispatch = (world: World, event: DraftEvent): void => {
  const stepped = step(world.draft, event)
  world.draft = stepped.draft
  for (const effect of stepped.effects) perform(world, effect)
}

const sentRows = (delta: DecisionDelta): ReadonlyArray<string> => [...R.keys(delta.set), ...delta.clear]

const run = (world: World, command: Command): void => {
  // A confirmed import is closed: all that is left to happen is the confirm's own answer.
  if (O.isSome(world.closed) && !Command.guards.ConfirmAnswers(command)) return
  Command.match(command, {
    PressConfirm: () => {
      if (world.draft.onScreen && O.isSome(world.draft.held)) dispatch(world, DraftEvent.ConfirmPressed())
      return
    },
    ServerTakesConfirm: () =>
      O.match(world.confirm, {
        onNone: () => {},
        onSome: (confirm) => {
          if (O.isSome(confirm.answer)) return
          // Made on another revision than the draft is at: the server writes nothing.
          if (confirm.revision !== world.server.revision) {
            world.confirm = O.some({ ...confirm, answer: O.some("moved") })
            return
          }
          const written = over(world.server.decisions, {
            ...R.map(confirm.delta.set, (decision) => O.some(decision)),
            ...R.fromEntries(A.map(confirm.delta.clear, (row) => [row, O.none()] as const))
          })
          // The rule: what a confirm writes is what its screen showed. No decision it had not shown, none missing.
          expect(written).toEqual(confirm.shown)
          world.server = { revision: world.server.revision + 1, decisions: written }
          world.history[world.server.revision] = written
          world.closed = O.some(written)
          world.confirm = O.some({ ...confirm, answer: O.some("made") })
        }
      }),
    ConfirmAnswers: () =>
      O.match(world.confirm, {
        onNone: () => {},
        onSome: (confirm) => {
          if (O.isNone(confirm.answer)) return
          world.confirm = O.none()
          if (confirm.answer.value === "moved") return dispatch(world, DraftEvent.ConfirmMoved())
          world.dirty = {}
          world.confirmed = {}
          dispatch(world, DraftEvent.ConfirmDone())
        }
      }),
    ConfirmFails: () => {
      // Lost on its way to the server: nothing was written.
      if (!O.exists(world.confirm, (confirm) => O.isNone(confirm.answer))) return
      world.confirm = O.none()
      return dispatch(world, DraftEvent.ConfirmFailed())
    },
    Decide: (command) => {
      const changes = change(command.row, command.to)
      if (!world.draft.onScreen || O.isNone(world.draft.held)) return
      if (Eq.equals(over(shown(world.draft), changes), shown(world.draft))) return
      world.dirty[command.row] = command.to
      delete world.confirmed[command.row]
      return dispatch(world, DraftEvent.Decided({ changes }))
    },
    SomeoneElse: (command) => {
      if (serverTakes(world, change(command.row, command.to))) {
        delete world.confirmed[command.row]
        // Decided after the server took the person's save of the same row: theirs is the later word.
        if (O.exists(world.save, (save) => O.isSome(save.answer) && A.contains(sentRows(save.delta), command.row))) {
          world.overtaken[command.row] = true
        }
      }
      return
    },
    ServerTakesSave: () =>
      O.match(world.save, {
        onNone: () => {},
        onSome: (save) => {
          if (O.isSome(save.answer)) return
          const changed = serverTakes(world, {
            ...R.map(save.delta.set, (decision) => O.some(decision)),
            ...R.fromEntries(A.map(save.delta.clear, (row) => [row, O.none()] as const))
          })
          world.save = O.some({ delta: save.delta, answer: O.some({ revision: world.server.revision, changed }) })
        }
      }),
    SaveAnswers: () =>
      O.match(world.save, {
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
          dispatch(world, DraftEvent.SaveAnswered(save.answer.value))
        }
      }),
    SaveFails: () => {
      if (O.isNone(world.save)) return
      world.save = O.none()
      return dispatch(world, DraftEvent.SaveFailed())
    },
    SaveRefused: () => {
      if (!O.exists(world.save, (save) => O.isNone(save.answer))) return
      world.save = O.none()
      world.dirty = {}
      return dispatch(world, DraftEvent.SaveRefused())
    },
    SaveAgain: () => {
      if (world.draft.stalled) dispatch(world, DraftEvent.SaveAgain())
      return
    },
    ReturnToTab: () => {
      if (world.draft.onScreen) world.read = O.some(O.none())
      return
    },
    ServerTakesRead: () => {
      if (O.exists(world.read, O.isNone)) world.read = O.some(O.some(world.server))
      return
    },
    ReadArrives: () =>
      O.match(O.flatten(world.read), {
        onNone: () => {},
        onSome: (picture) => {
          world.read = O.none()
          put(world, picture)
        }
      }),
    OtherAnswerSent: () => {
      world.late.push(world.server)
      return
    },
    OtherAnswerArrives: () => {
      const picture = world.late.shift()
      if (picture !== undefined) put(world, picture)
      return
    },
    Leave: () => {
      if (world.draft.onScreen) dispatch(world, DraftEvent.Left())
      return
    },
    ComeBack: () => {
      if (world.draft.onScreen) return
      dispatch(world, DraftEvent.Opened())
      // The step reads the view it finds, and asks again behind it.
      O.map(world.view, (view) => dispatch(world, DraftEvent.ViewArrived(view)))
      world.read = O.some(O.none())
      return
    }
  })
}

/** Holds after every step, whatever happened before it. */
const holds = (world: World): void => {
  // The screen never claims a revision the server has not reached.
  O.map(world.draft.held, (held) => expect(held.revision).toBeLessThanOrEqual(world.server.revision))
  // While the step is drawn, what it holds of the server is the view the tab holds: never ahead of it, never behind.
  // (A confirmed import keeps no draft: its screen is the result.)
  if (world.draft.onScreen && O.isNone(world.closed)) {
    expect(O.map(world.draft.held, (held) => held.revision)).toEqual(O.map(world.view, (view) => view.revision))
  }
  // What it holds is what the server held at that revision: a revision is never claimed for another picture.
  O.map(world.draft.held, (held) => expect(held.decisions).toEqual(world.history[held.revision]))
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
    run(world, { _tag: "ServerTakesConfirm" })
    run(world, { _tag: "ConfirmAnswers" })
    for (let left = world.late.length; left > 0; left -= 1) run(world, { _tag: "OtherAnswerArrives" })
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
    "sends only the person's own rows, never runs ahead of the server, confirms only what it showed, and ends showing what the server holds",
    { commands: S.Array(Command).check(S.isMaxLength(40)) },
    ({ commands }) => {
      const world = opened()
      for (const command of commands) {
        run(world, command)
        holds(world)
      }
      quiet(world)
      expect([O.isNone(world.save), O.isNone(world.confirm), world.draft.confirm]).toEqual([true, true, "idle"])
      expect(settled(world.draft)).toBe(true)
      // A confirmed import keeps no draft; an open one ends showing what the server holds.
      if (O.isNone(world.closed)) expect(shown(world.draft)).toEqual(world.server.decisions)
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

  it("a save the server counts as no change is not taken for the person's own next revision", () => {
    const world = opened()
    // The person leaves a row out and takes that back while the save is out; the save fails and waits.
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "Decide", row: "a", to: "nothing" })
    run(world, { _tag: "SaveFails" })
    // A read is on its way, taken by the server before somebody else decides another row.
    run(world, { _tag: "ReturnToTab" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    // "Save again" sends a clear of a row the server never had decided: no change, at the other person's revision.
    run(world, { _tag: "SaveAgain" })
    run(world, { _tag: "ServerTakesSave" })
    expect(O.flatMap(world.save, (save) => save.answer)).toEqual(O.some({ revision: 2, changed: false }))
    run(world, { _tag: "ReadArrives" })
    run(world, { _tag: "SaveAnswers" })
    // The screen does not claim revision 2 for a picture without the other person's row: it holds what it read,
    // and has asked for the import again, at once.
    holds(world)
    expect(O.map(world.draft.held, (held) => held.revision)).toEqual(O.some(1))
    expect(O.isSome(world.read)).toBe(true)
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect(shown(world.draft)).toEqual({ b: kept })
  })
})

describe("a confirm", () => {
  const sent = (world: World) => O.map(world.confirm, (confirm) => [confirm.revision, confirm.delta] as const)

  it("made on a picture somebody has changed since is refused, writes nothing, and the next one is on their row too", () => {
    const world = opened({ a: out })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "PressConfirm" })
    expect(sent(world)).toEqual(O.some([1, { set: {}, clear: [] }]))
    run(world, { _tag: "ServerTakesConfirm" })
    expect([O.isNone(world.closed), world.server.decisions]).toEqual([true, { a: out, b: kept }])
    run(world, { _tag: "ConfirmAnswers" })
    // Not made, and said so; the newer picture is asked for.
    expect([world.draft.confirm, world.draft.heldBack, O.isSome(world.read)]).toEqual(["idle", O.some(0), true])
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    // Their row is on screen now, counted, and the region was started again from it.
    expect([shown(world.draft), world.draft.heldBack, world.restarts]).toEqual([{ a: out, b: kept }, O.some(1), 1])
    run(world, { _tag: "PressConfirm" })
    expect([sent(world), world.draft.heldBack]).toEqual([O.some([2, { set: {}, clear: [] }]), O.none()])
    run(world, { _tag: "ServerTakesConfirm" })
    expect(world.closed).toEqual(O.some({ a: out, b: kept }))
  })

  it("waits for the save that is out, then carries only the rows not sent yet, with no save beside it", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "Decide", row: "b", to: "kept" })
    run(world, { _tag: "PressConfirm" })
    expect([world.draft.confirm, O.isNone(world.confirm)]).toEqual(["waiting", true])
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    // Row a is saved at revision 2; the confirm names that revision and carries row b alone.
    expect([sent(world), O.isNone(world.save)]).toEqual([O.some([2, { set: { b: kept }, clear: [] }]), true])
    run(world, { _tag: "ServerTakesConfirm" })
    expect(world.closed).toEqual(O.some({ a: out, b: kept }))
    run(world, { _tag: "ConfirmAnswers" })
    expect(world.draft).toEqual({ ...emptyDraft, onScreen: true })
  })

  it("that waits is held back when its save's answer says somebody else saved in between", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "PressConfirm" })
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    // Two revisions on from the picture held: no confirm goes, the newer picture is asked for.
    expect([world.draft.confirm, world.draft.heldBack, O.isNone(world.confirm), O.isSome(world.read)]).toEqual([
      "idle",
      O.some(0),
      true,
      true
    ])
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect([shown(world.draft), world.draft.heldBack]).toEqual([{ a: out, b: kept }, O.some(1)])
  })

  it("that waits is held back by a newer picture that arrives before its save is answered", () => {
    const world = opened()
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "ReturnToTab" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "PressConfirm" })
    run(world, { _tag: "ReadArrives" })
    expect([world.draft.confirm, world.draft.heldBack]).toEqual(["idle", O.some(1)])
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    expect(O.isNone(world.confirm)).toBe(true)
  })

  it("carries the clear of a decision the person took back and the server never heard of", () => {
    const world = opened({ a: out })
    run(world, { _tag: "Decide", row: "a", to: "nothing" })
    run(world, { _tag: "SaveFails" })
    run(world, { _tag: "PressConfirm" })
    expect(sent(world)).toEqual(O.some([1, { set: {}, clear: ["a"] }]))
    run(world, { _tag: "ServerTakesConfirm" })
    // Without the clear the import would be confirmed with row a left out, as nobody on this screen saw it.
    expect(world.closed).toEqual(O.some({}))
  })

  it("that did not get through leaves the rows it carried to be saved as any decision", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SaveFails" })
    run(world, { _tag: "PressConfirm" })
    run(world, { _tag: "ConfirmFails" })
    expect([world.draft.confirm, O.map(world.save, (save) => save.delta)]).toEqual([
      "idle",
      O.some({ set: { a: out }, clear: [] })
    ])
    quiet(world)
    expect(world.server.decisions).toEqual({ a: out })
  })
})
