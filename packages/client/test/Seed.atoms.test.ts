// A read can be given its answer by the screen (a staged file's view, a draft's new revision): the answer shows with
// no request, and the next refresh asks the server. A read kept for the page (a staged file's rows, which never
// change) is not asked again when a screen comes back to it. An answer given while a request is out never ends that
// request: it lands, and the server is asked once more, because the given answer may be the newer of the two.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { makeApiAtoms, provideApi } from "@inventory/client/Api"

interface Rows {
  readonly rows: Effect.Effect<string>
}
class RowServer extends Context.Service<RowServer, Rows>()("@inventory/client/test/Seed.atoms.test/RowServer") {}

const world = (takes: Duration.Input = "10 millis") => {
  let reads = 0
  let starts = 0
  const layer = Layer.succeed(RowServer, {
    rows: Effect.sync(() => {
      starts += 1
    }).pipe(Effect.andThen(Effect.sleep(takes)), Effect.andThen(Effect.sync(() => `server's rows ${++reads}`)))
  })
  const api = makeApiAtoms(RowServer)
  const rows = api.query((server) => server.rows)
  const forever = api.query((server) => server.rows, { keep: "page" })
  const registry = AtomRegistry.make({ initialValues: [provideApi(layer)], defaultIdleTTL: 50 })
  const seen = (atom: typeof rows) => registry.get(atom).pipe(AsyncResult.value, O.getOrUndefined)
  return { registry, rows, forever, seen, reads: () => reads, starts: () => starts }
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
  it.live("shows at once, and the request that was out lands: it is not ended, and the server is asked once more", () =>
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
      expect([t.seen(t.rows), t.starts()]).toEqual(["a save's own answer", 2])
      // The request that was on its way answers, and because an answer was given while it was out, once more.
      yield* Effect.sleep("80 millis")
      expect([t.seen(t.rows), t.starts(), t.reads()]).toEqual(["server's rows 3", 3, 3])
      // The given answer is gone with the request's: a look without asking finds the server's word.
      expect(t.rows.peek(t.registry)).toEqual(O.some("server's rows 3"))
    })
  )

  it.live("three saves 2 ms apart behind a read of 30 ms: the read is asked once, lands, and is asked once more", () =>
    Effect.gen(function* () {
      const t = world("30 millis")
      t.registry.mount(t.rows)
      yield* Effect.sleep("60 millis")
      expect([t.seen(t.rows), t.starts()]).toEqual(["server's rows 1", 1])
      // The read is asked again, and while it is out three saves answer, each putting its own answer in place.
      t.registry.refresh(t.rows)
      const shown: Array<string | undefined> = []
      for (const save of ["save 1", "save 2", "save 3"]) {
        yield* Effect.sleep("2 millis")
        t.registry.set(t.rows, save)
        shown.push(t.seen(t.rows))
      }
      expect(shown).toEqual(["save 1", "save 2", "save 3"])
      yield* Effect.sleep("8 millis")
      // No save ended the request or started another: one is out, the one asked before the saves.
      expect([t.seen(t.rows), t.starts(), t.reads()]).toEqual(["save 3", 2, 1])
      // It lands, and the server is asked once more for what the saves left: once, not once per save. Until that
      // answer, the last save's answer stays on screen, not the older one the server gave when the request left.
      yield* Effect.sleep("25 millis")
      expect([t.seen(t.rows), t.starts(), t.reads()]).toEqual(["save 3", 3, 2])
      yield* Effect.sleep("60 millis")
      expect([t.seen(t.rows), t.starts(), t.reads()]).toEqual(["server's rows 3", 3, 3])
    })
  )

  it.live("an answer given after the request has landed stays, and nothing more is asked", () =>
    Effect.gen(function* () {
      const t = world()
      t.registry.mount(t.rows)
      yield* Effect.sleep("50 millis")
      t.registry.set(t.rows, "a save's own answer")
      yield* Effect.sleep("60 millis")
      expect([t.seen(t.rows), t.starts()]).toEqual(["a save's own answer", 1])
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

describe("a read let go after the screen left it", () => {
  it.live("is not kept again: nothing of it stays in this tab but what lives for the page", () =>
    Effect.gen(function* () {
      const t = world()
      const leave = t.registry.mount(t.rows)
      yield* Effect.sleep("40 millis")
      expect(t.seen(t.rows)).toBe("server's rows 1")
      // The screen leaves, and within the idle time the read is let go (the import was removed).
      leave()
      yield* Effect.sleep("10 millis")
      t.rows.letGo(t.registry)
      // Past the idle time: what it showed and what asked for it are gone. Kept again, they would stay for minutes.
      yield* Effect.sleep("300 millis")
      expect(
        A.filter(A.fromIterable(t.registry.getNodes().keys()), (key) => Atom.isAtom(key) && !key.keepAlive)
      ).toEqual([])
      expect(O.isNone(t.rows.peek(t.registry))).toBe(true)
      expect(t.reads()).toBe(1)
    })
  )
})

describe("asking again for an answer no older than a write", () => {
  it.live("with no request out, the server is asked now", () =>
    Effect.gen(function* () {
      const t = world("30 millis")
      t.registry.mount(t.rows)
      yield* Effect.sleep("60 millis")
      t.rows.askAgain(t.registry, DateTime.nowUnsafe())
      yield* Effect.sleep("5 millis")
      expect(t.starts()).toBe(2)
      yield* Effect.sleep("60 millis")
      expect([t.seen(t.rows), t.starts()]).toEqual(["server's rows 2", 2])
    })
  )

  it.live("a request that started after the write was sent is the answer wanted: nothing more is asked", () =>
    Effect.gen(function* () {
      const t = world("30 millis")
      t.registry.mount(t.rows)
      yield* Effect.sleep("60 millis")
      const sent = DateTime.nowUnsafe()
      yield* Effect.sleep("3 millis")
      t.registry.refresh(t.rows)
      yield* Effect.sleep("3 millis")
      t.rows.askAgain(t.registry, sent)
      yield* Effect.sleep("90 millis")
      expect([t.seen(t.rows), t.starts()]).toEqual(["server's rows 2", 2])
    })
  )

  it.live("a request that started before the write was sent is left to land, then asked once more", () =>
    Effect.gen(function* () {
      const t = world("30 millis")
      t.registry.mount(t.rows)
      yield* Effect.sleep("60 millis")
      t.registry.refresh(t.rows)
      yield* Effect.sleep("3 millis")
      const sent = DateTime.nowUnsafe()
      yield* Effect.sleep("3 millis")
      t.rows.askAgain(t.registry, sent)
      t.rows.askAgain(t.registry, sent)
      yield* Effect.sleep("10 millis")
      // Not ended and not started again: the one request is still out.
      expect([t.starts(), t.reads()]).toEqual([2, 1])
      yield* Effect.sleep("25 millis")
      expect([t.seen(t.rows), t.starts()]).toEqual(["server's rows 2", 3])
      yield* Effect.sleep("60 millis")
      expect([t.seen(t.rows), t.starts()]).toEqual(["server's rows 3", 3])
    })
  )
})
