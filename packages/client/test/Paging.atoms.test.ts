// The Items table keeps its rows while the next page loads: one read whose page comes from another atom answers the
// previous page, marked waiting, until the next one arrives (BRIEF-atoms.md, "keep-previous-data paging").
import { describe, expect, it } from "@effect/vitest"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { makeApiAtoms, provideApi } from "@inventory/client/Api"

interface Pages {
  readonly page: (n: number) => Effect.Effect<ReadonlyArray<string>>
}
class PageServer extends Context.Service<PageServer, Pages>()("@inventory/client/test/Paging.atoms.test/PageServer") {}

/** Long enough for the registry to run what a write started. */
const settle = Effect.sleep("10 millis")

describe("paging", () => {
  it.live("keeps the previous page's rows, waiting, until the next page has come", () =>
    Effect.gen(function* () {
      const answers: Array<Deferred.Deferred<void>> = []
      const layer = Layer.succeed(PageServer, {
        page: Effect.fnUntraced(function* (n: number) {
          const answer = Deferred.makeUnsafe<void>()
          answers.push(answer)
          yield* Deferred.await(answer)
          return [`row ${n * 2 + 1}`, `row ${n * 2 + 2}`]
        })
      })
      const api = makeApiAtoms(PageServer)
      const page = Atom.make(0)
      const rows = api.query((server, get) => server.page(get(page)))
      const registry = AtomRegistry.make({ initialValues: [provideApi(layer)] })
      registry.mount(rows)
      yield* settle
      yield* Deferred.succeed(answers[0]!, undefined)
      yield* settle
      expect(registry.get(rows).pipe(AsyncResult.value, O.getOrUndefined)).toEqual(["row 1", "row 2"])

      registry.set(page, 1)
      yield* settle
      const loading = registry.get(rows)
      expect(loading.waiting).toBe(true)
      expect(loading.pipe(AsyncResult.value, O.getOrUndefined)).toEqual(["row 1", "row 2"])

      yield* Deferred.succeed(answers[1]!, undefined)
      yield* settle
      const next = registry.get(rows)
      expect(next.waiting).toBe(false)
      expect(next.pipe(AsyncResult.value, O.getOrUndefined)).toEqual(["row 3", "row 4"])
    })
  )
})
