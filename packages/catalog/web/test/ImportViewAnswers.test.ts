import * as A from "effect/Array"
import { assertTrue } from "@effect/vitest/utils"
// An answer put into the import's view (suggestions, a match) must change only its own part of what the view holds
// when the answer arrives. Built from the view as it was at the press, it took back the decisions saved, or the match
// made, while the request was out: the screen then showed less than the server holds.
import { describe, expect, it } from "@effect/vitest"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { decisionFromFlags } from "@inventory/catalog-contract/Decision"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { importView, matchColumn, suggestFixes } from "../src/Imports.atoms.ts"
import { importId, registryWith, viewAt } from "./support/catalog.ts"

const settle = Effect.sleep("10 millis")
const suggestion = { rowId: "row-3" }

describe("an answer put into the import's view", () => {
  it.live("suggestions change only the suggestions of the view held when they arrive", () =>
    Effect.gen(function* () {
      const answer = Deferred.makeUnsafe<{ readonly suggestions: ReadonlyArray<unknown> }>()
      const registry = registryWith({ imports: { suggest: () => Deferred.await(answer) } })
      const read = importView(importId)
      registry.mount(read)
      registry.mount(suggestFixes)
      const pressed = viewAt({ revision: 10 })
      registry.set(read, pressed)
      registry.set(suggestFixes, importId)
      yield* settle
      // Three decisions are saved while the model works: the view moves to revision 13.
      const decisions = { "row-1": decisionFromFlags({ out: true }) }
      registry.set(read, viewAt({ revision: 13, decisions }))
      yield* Deferred.succeed(answer, { suggestions: [suggestion] })
      yield* settle
      const expectedSome1 = registry.get(read).pipe(AsyncResult.value)
      assertTrue(O.isSome(expectedSome1), "expected registry.get(read).pipe(AsyncResult.value)")
      const held = expectedSome1.value
      expect([held.revision, held.decisions, held.suggestions]).toEqual([13, decisions, [suggestion]])
    })
  )

  it.live("an earlier match that answers last does not replace the newer view", () =>
    Effect.gen(function* () {
      const answers: Array<Deferred.Deferred<ImportView>> = []
      const registry = registryWith({
        imports: {
          match: () => {
            const answer = Deferred.makeUnsafe<ImportView>()
            answers.push(answer)
            return Deferred.await(answer)
          }
        }
      })
      const read = importView(importId)
      registry.mount(read)
      registry.mount(matchColumn)
      registry.set(read, viewAt({ revision: 10 }))
      registry.set(matchColumn, { id: importId, field: "name", column: O.some(1) })
      registry.set(matchColumn, { id: importId, field: "sku", column: O.some(2) })
      yield* settle
      // The second match answers first, with the later revision; the first lands after it.
      const requiredEntry1 = A.get(answers, 1)
      assertTrue(O.isSome(requiredEntry1), "expected answers[1]")
      yield* Deferred.succeed(requiredEntry1.value, viewAt({ revision: 12 }))
      yield* settle
      const requiredEntry2 = A.get(answers, 0)
      assertTrue(O.isSome(requiredEntry2), "expected answers[0]")
      yield* Deferred.succeed(requiredEntry2.value, viewAt({ revision: 11 }))
      yield* settle
      const expectedSome2 = registry.get(read).pipe(AsyncResult.value)
      assertTrue(O.isSome(expectedSome2), "expected registry.get(read).pipe(AsyncResult.value)")
      expect(expectedSome2.value.revision).toBe(12)
    })
  )
})
