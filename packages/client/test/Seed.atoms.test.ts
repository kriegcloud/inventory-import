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
})
