// Coming back to a screen shows what was there at once, marked waiting, and swaps in the fresh answer: no skeleton on
// a return (Benjamin: "Old rows at once, refreshed behind").
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
class RowServer extends Context.Service<RowServer, Rows>()("@inventory/client/test/Freshness.atoms.test/RowServer") {}

describe("a return to a screen", () => {
  it.live("shows the rows it had at once, marked waiting, then the fresh ones", () =>
    Effect.gen(function* () {
      let reads = 0
      const layer = Layer.succeed(RowServer, {
        // Answers after a moment, as a server does.
        rows: Effect.sleep("20 millis").pipe(Effect.andThen(Effect.sync(() => `rows of read ${++reads}`)))
      })
      const rows = makeApiAtoms(RowServer).query((server) => server.rows)
      // The app's registry lets an unread screen's atoms go 400 ms later; shorter here.
      const registry = AtomRegistry.make({ initialValues: [provideApi(layer)], defaultIdleTTL: 50 })
      const seen = () => {
        const result = registry.get(rows)
        return { rows: result.pipe(AsyncResult.value, O.getOrUndefined), waiting: result.waiting }
      }
      const leave = registry.mount(rows)
      yield* Effect.sleep("100 millis")
      expect(seen()).toEqual({ rows: "rows of read 1", waiting: false })

      // The person leaves the screen, and comes back later.
      leave()
      yield* Effect.sleep("1200 millis")
      registry.mount(rows)
      // At once: the rows it had, never a skeleton.
      expect(seen().rows).toBe("rows of read 1")
      // A moment later (the next tick asks again): the same rows, marked waiting.
      yield* Effect.sleep("5 millis")
      expect(seen()).toEqual({ rows: "rows of read 1", waiting: true })
      yield* Effect.sleep("100 millis")
      expect(seen()).toEqual({ rows: "rows of read 2", waiting: false })
    })
  )
})
