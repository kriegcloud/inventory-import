// `handlersOf` is the check that keeps the catalog's handlers on its ports: a handler that yields anything else does
// not compile where it is registered.
import { describe, expect, it } from "@effect/vitest"
import { expectTypeOf } from "vitest"
import { handlersOf } from "@inventory/catalog-model/Ports"
import { ImportStore } from "@inventory/catalog-model/ImportStore"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"

class Elsewhere extends Context.Service<Elsewhere, { readonly n: number }>()(
  "@inventory/catalog-model/test/Ports.test/Elsewhere"
) {}

describe("handlersOf", () => {
  it("takes a handler on the ports and refuses one that reaches past them", () => {
    const onPorts = Effect.fnUntraced(function* () {
      const store = yield* ImportStore
      return store
    })
    const past = Effect.fnUntraced(function* () {
      const elsewhere = yield* Elsewhere
      return elsewhere.n
    })
    expect(handlersOf({ onPorts }).onPorts).toBe(onPorts)
    // What `handlersOf` takes is the check, so it is asked of the types: nothing that reaches past the ports is
    // ever handed to it, here or anywhere.
    expectTypeOf({ onPorts }).toExtend<Parameters<typeof handlersOf>[0]>()
    expectTypeOf({ past }).not.toExtend<Parameters<typeof handlersOf>[0]>()
  })
})
