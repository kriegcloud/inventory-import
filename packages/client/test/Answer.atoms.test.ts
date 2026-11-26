// What a screen builds from a read's data must not be built again when the read is asked again and answers the same.
// The read itself changes twice per refresh (waiting, then answered); its answer, kept the same object while it is
// equal, does not. The Items table's columns were built from the read, so every refresh drew every cell again, and an
// open row editor with them.
import { describe, expect, it } from "@effect/vitest"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { answerOf, makeApiAtoms, provideApi } from "@inventory/client/Api"

type Facets = { readonly categories: ReadonlyArray<string> }

class Server extends Context.Service<Server, { readonly facets: Effect.Effect<Facets> }>()(
  "@inventory/client/test/Answer.atoms.test/Server"
) {}

const settle = Effect.sleep("15 millis")

describe("what is built from a read's answer", () => {
  it.live("is built once per answer, however often the read is asked again", () =>
    Effect.gen(function* () {
      let asked = 0
      let categories: ReadonlyArray<string> = ["packaging", "supplies"]
      const layer = Layer.succeed(Server, {
        facets: Effect.sync(() => {
          asked++
          return { categories: [...categories] }
        })
      })
      const read = makeApiAtoms(Server).query((server) => server.facets, { keep: "unwatched" })
      const answer = answerOf(read)
      let fromAnswer = 0
      let fromRead = 0
      const columns = Atom.readable((get) => {
        fromAnswer++
        return { of: get(answer) }
      })
      const columnsOnRead = Atom.readable((get) => {
        fromRead++
        return { of: get(read) }
      })
      const registry = AtomRegistry.make({ initialValues: [provideApi(layer)] })
      registry.mount(read)
      registry.mount(columns)
      registry.mount(columnsOnRead)
      yield* settle
      const first = registry.get(columns)
      const builtForFirst = { fromAnswer, fromRead }
      // A saved edit asks for the values again, twice; they are the same.
      registry.refresh(read)
      yield* settle
      registry.refresh(read)
      yield* settle
      expect(asked).toBe(3)
      expect(registry.get(columns)).toBe(first)
      expect(fromAnswer).toBe(builtForFirst.fromAnswer)
      // Built on the read itself, the same thing is built again for every refresh, more than once.
      expect(fromRead).toBeGreaterThan(builtForFirst.fromRead + 1)
      // A new value is another answer: built once more.
      categories = ["packaging", "supplies", "components"]
      registry.refresh(read)
      yield* settle
      expect(registry.get(columns)).not.toBe(first)
      expect(fromAnswer).toBe(builtForFirst.fromAnswer + 1)
    })
  )
})
