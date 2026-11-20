// A read can be given its answer by the screen (a staged file's view, a draft's new revision): the answer shows with
// no request, and the next refresh asks the server. A read kept for the page (a staged file's rows, which never
// change) is not asked again when a screen comes back to it.
import { describe, expect, it } from "@effect/vitest"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { makeApiAtoms, provideApi } from "@inventory/client/Api"

interface Rows {
  readonly rows: Effect.Effect<string>
}
class RowServer extends Context.Service<RowServer, Rows>()("@inventory/client/test/Seed.atoms.test/RowServer") {}

const world = () => {
  let reads = 0
  const layer = Layer.succeed(RowServer, {
    rows: Effect.sleep("10 millis").pipe(Effect.andThen(Effect.sync(() => `server's rows ${++reads}`)))
  })
  const api = makeApiAtoms(RowServer)
  const rows = api.query((server) => server.rows)
  const forever = api.query((server) => server.rows, { keep: "page" })
  const registry = AtomRegistry.make({ initialValues: [provideApi(layer)], defaultIdleTTL: 50 })
  const seen = (atom: typeof rows) => registry.get(atom).pipe(AsyncResult.value, O.getOrUndefined)
  return { registry, rows, forever, seen, reads: () => reads }
}

describe("a read the screen gives its answer", () => {
  it.live("shows the given answer with no request, and asks the server on the next refresh", () =>
    Effect.gen(function* () {
      const t = world()
      t.registry.set(t.rows, "the staged view")
      t.registry.mount(t.rows)
      yield* Effect.sleep("50 millis")
      expect(t.seen(t.rows)).toBe("the staged view")
      expect(t.reads()).toBe(0)
      t.registry.refresh(t.rows)
      yield* Effect.sleep("50 millis")
      expect(t.seen(t.rows)).toBe("server's rows 1")
    })
  )

  it.live("kept for the page: a return shows it and does not ask again", () =>
    Effect.gen(function* () {
      const t = world()
      const leave = t.registry.mount(t.forever)
      yield* Effect.sleep("50 millis")
      expect(t.seen(t.forever)).toBe("server's rows 1")
      leave()
      yield* Effect.sleep("1200 millis")
      t.registry.mount(t.forever)
      yield* Effect.sleep("50 millis")
      expect(t.seen(t.forever)).toBe("server's rows 1")
      expect(t.reads()).toBe(1)
    })
  )

  it.live("given a while before it is first shown: shown at once, and asked again behind it", () =>
    Effect.gen(function* () {
      const t = world()
      // An upload lands while the person is on another page; they open it later.
      t.registry.set(t.rows, "the staged view")
      yield* Effect.sleep("1100 millis")
      t.registry.mount(t.rows)
      yield* Effect.sleep("5 millis")
      expect(t.seen(t.rows)).toBe("the staged view")
      yield* Effect.sleep("80 millis")
      expect(t.seen(t.rows)).toBe("server's rows 1")
      expect(t.reads()).toBe(1)
    })
  )

  it.live("let go: the answer it held and the answer it was given are gone, and the next look asks the server", () =>
    Effect.gen(function* () {
      const t = world()
      const leave = t.registry.mount(t.forever)
      yield* Effect.sleep("50 millis")
      expect(t.seen(t.forever)).toBe("server's rows 1")
      leave()
      // The import was removed: nothing of it stays in this tab, not even what a screen put in place for it.
      t.registry.set(t.forever, "rows given by a screen")
      t.forever.letGo(t.registry)
      yield* Effect.sleep("80 millis")
      t.registry.mount(t.forever)
      yield* Effect.sleep("50 millis")
      expect(t.seen(t.forever)).toBe("server's rows 2")
    })
  )
})

describe("an answer given while the read is being asked again", () => {
  it.live("shows at once, and the server is asked again behind it: the request that was out is not lost", () =>
    Effect.gen(function* () {
      const t = world()
      t.registry.mount(t.rows)
      yield* Effect.sleep("50 millis")
      expect(t.seen(t.rows)).toBe("server's rows 1")
      // Asked again (a save said somebody else changed it); before the answer, another answer is put in place.
      t.registry.refresh(t.rows)
      yield* Effect.sleep("2 millis")
      t.registry.set(t.rows, "a save's own answer")
      yield* Effect.sleep("3 millis")
      expect(t.seen(t.rows)).toBe("a save's own answer")
      // The answer that was on its way was cut off by the put; the server is asked again and its word arrives.
      yield* Effect.sleep("80 millis")
      expect(t.seen(t.rows)).toMatch(/^server's rows/)
      expect(t.seen(t.rows)).not.toBe("server's rows 1")
    })
  )

  it.live("a look without asking: what is held, an answer given and not yet taken, or nothing, and no request", () =>
    Effect.gen(function* () {
      const t = world()
      expect(O.isNone(t.rows.peek(t.registry))).toBe(true)
      t.registry.set(t.rows, "the staged view")
      expect(t.rows.peek(t.registry)).toEqual(O.some("the staged view"))
      yield* Effect.sleep("30 millis")
      expect(t.reads()).toBe(0)
      t.registry.mount(t.rows)
      yield* Effect.sleep("30 millis")
      expect(t.rows.peek(t.registry)).toEqual(O.some("the staged view"))
      expect(t.reads()).toBe(0)
    })
  )
})

describe("a read let go while a screen still shows it", () => {
  it.live("asks the server at once, and is asked again by a later refresh: it is not cut off", () =>
    Effect.gen(function* () {
      const t = world()
      t.registry.mount(t.rows)
      yield* Effect.sleep("50 millis")
      expect(t.seen(t.rows)).toBe("server's rows 1")
      t.rows.letGo(t.registry)
      yield* Effect.sleep("50 millis")
      expect([t.seen(t.rows), t.reads()]).toEqual(["server's rows 2", 2])
      t.registry.refresh(t.rows)
      yield* Effect.sleep("50 millis")
      expect([t.seen(t.rows), t.reads()]).toEqual(["server's rows 3", 3])
    })
  )
})
