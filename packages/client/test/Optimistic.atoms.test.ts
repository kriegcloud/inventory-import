// Two edits of one item in flight, the second answered first: the screen shows both at once, ends with both after the
// server has answered, and reads the item again once, not twice (goals/atoms/PLAN.md, "two writes in flight"). A
// refused edit is taken back the moment it is refused while the other keeps showing (Benjamin: "Take it back at
// once"), and the screen ends at the server's word; two refused edits end where the screen started, unread.
import { describe, expect, it } from "@effect/vitest"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { makeApiAtoms, provideApi } from "@inventory/client/Api"
import { optimisticChange, optimisticWrite, shown } from "@inventory/client/OptimisticAtoms"

type Item = { readonly name: string; readonly unit: string }
type Edit = Partial<Item>

class Refused extends S.TaggedError<Refused, { readonly brand: unique symbol }>()("Refused", {}) {}

/** A server that holds one item and answers each edit only when the test says so. */
interface FakeServer {
  readonly read: Effect.Effect<Item>
  readonly edit: (edit: Edit) => Effect.Effect<Item, Refused>
}
class Server extends Context.Service<Server, FakeServer>()("@inventory/client/test/Optimistic.atoms.test/Server") {}

/** Long enough for the registry to run what a write started. */
const settle = Effect.sleep("10 millis")

const world = (options: { readonly idleTTL?: number } = {}) => {
  let item: Item = { name: "Bolt", unit: "each" }
  let reads = 0
  const answers: Array<Deferred.Deferred<void, Refused>> = []
  const layer = Layer.succeed(Server, {
    read: Effect.sync(() => {
      reads++
      return item
    }),
    edit: Effect.fnUntraced(function* (edit: Edit) {
      const answer = Deferred.makeUnsafe<void, Refused>()
      answers.push(answer)
      yield* Deferred.await(answer)
      item = { ...item, ...edit }
      return item
    })
  })
  const api = makeApiAtoms(Server)
  const itemShown = shown(api.query((server) => server.read))
  const edit = optimisticWrite({
    send: (input: Edit) => api.send((server) => server.edit(input)),
    changes: [optimisticChange(itemShown, (now: Item, input: Edit) => ({ ...now, ...input }))],
    failed: () => "The item was not saved.",
    onRefused: () => true
  })
  const registry = AtomRegistry.make({
    initialValues: [provideApi(layer)],
    ...(options.idleTTL === undefined ? {} : { defaultIdleTTL: options.idleTTL })
  })
  registry.mount(itemShown)
  // The row that holds the write: let go when the row leaves the screen.
  const leave = registry.mount(edit)
  const seen = () => {
    const result = registry.get(itemShown)
    return { item: result.pipe(AsyncResult.value, O.getOrUndefined), waiting: result.waiting }
  }
  const press = (input: Edit) => registry.set(edit, input)
  const answer = (n: number) => Deferred.succeed(answers[n]!, undefined)
  const refuse = (n: number) => Deferred.fail(answers[n]!, Refused.make({}))
  return { seen, press, answer, refuse, leave, reads: () => reads, stored: () => item }
}

describe("two optimistic edits in flight", () => {
  it.live("shows both at once and ends with both, read again once", () =>
    Effect.gen(function* () {
      const t = world()
      yield* settle
      t.press({ name: "Hex bolt" })
      t.press({ unit: "box" })
      yield* settle
      expect(t.seen()).toEqual({ item: { name: "Hex bolt", unit: "box" }, waiting: true })
      yield* t.answer(1)
      yield* settle
      expect(t.seen()).toEqual({ item: { name: "Hex bolt", unit: "box" }, waiting: true })
      yield* t.answer(0)
      yield* settle
      expect(t.seen()).toEqual({ item: { name: "Hex bolt", unit: "box" }, waiting: false })
      expect(t.stored()).toEqual({ name: "Hex bolt", unit: "box" })
      // The first read, and one read after the last answer.
      expect(t.reads()).toBe(2)
    })
  )

  it.live("takes a refused edit back at once, keeps the other, and ends at the server's word", () =>
    Effect.gen(function* () {
      const t = world()
      yield* settle
      t.press({ name: "Hex bolt" })
      t.press({ unit: "box" })
      yield* settle
      yield* t.refuse(0)
      yield* settle
      // Before the other edit has answered: the refused name is back, the other edit still shows, and waits.
      expect(t.seen()).toEqual({ item: { name: "Bolt", unit: "box" }, waiting: true })
      expect(t.reads()).toBe(1)
      yield* t.answer(1)
      yield* settle
      expect(t.seen()).toEqual({ item: { name: "Bolt", unit: "box" }, waiting: false })
      expect(t.reads()).toBe(2)
    })
  )

  it.live("ends where it started, without reading again, when both are refused", () =>
    Effect.gen(function* () {
      const t = world()
      yield* settle
      t.press({ name: "Hex bolt" })
      t.press({ unit: "box" })
      yield* settle
      yield* t.refuse(1)
      yield* settle
      expect(t.seen()).toEqual({ item: { name: "Hex bolt", unit: "each" }, waiting: true })
      yield* t.refuse(0)
      yield* settle
      expect(t.seen()).toEqual({ item: { name: "Bolt", unit: "each" }, waiting: false })
      expect(t.reads()).toBe(1)
    })
  )
})

describe("an optimistic edit whose row leaves the screen", () => {
  it.live("runs to its end: saved, nothing left on its way, read again once", () =>
    Effect.gen(function* () {
      // The registry lets an atom nobody reads go after 20 ms, as the app's does after 400.
      const t = world({ idleTTL: 20 })
      yield* settle
      t.press({ name: "Hex bolt" })
      yield* settle
      expect(t.seen()).toEqual({ item: { name: "Hex bolt", unit: "each" }, waiting: true })
      // The row unmounts (another page, another screen) while the save is still out, and its atom is let go.
      t.leave()
      yield* Effect.sleep("80 millis")
      yield* t.answer(0)
      yield* Effect.sleep("40 millis")
      expect(t.stored()).toEqual({ name: "Hex bolt", unit: "each" })
      expect(t.seen()).toEqual({ item: { name: "Hex bolt", unit: "each" }, waiting: false })
      expect(t.reads()).toBe(2)
      // A later edit of the same item still settles: the first left nothing counted in flight.
      t.press({ unit: "box" })
      yield* settle
      yield* t.answer(1)
      yield* Effect.sleep("40 millis")
      expect(t.seen()).toEqual({ item: { name: "Hex bolt", unit: "box" }, waiting: false })
      expect(t.reads()).toBe(3)
    })
  )
})
