// The data grid's callbacks (an upload, a delete, a new row, a copy, a paste) start inside the event that asked for
// them. The rule that would hurt if wrong: a clipboard call made a turn later is outside the person's gesture, and a
// browser that asks for one refuses the copy. `settle` only turns how the callback ends into a `Result`.
import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { settle } from "@inventory/ui/components/data-grid/data-grid-utils"
import * as Result from "effect/Result"
import { expect } from "vitest"

const why = (error: unknown) => (error instanceof Error ? error.message : "refused")

it.effect("calls the callback at once, before the code after it runs", () => {
  const order: Array<string> = []
  const settled = settle(() => {
    order.push("callback")
    return Promise.resolve(1)
  }, why)
  order.push("after")
  expect(order).toEqual(["callback", "after"])
  return Effect.map(
    Effect.promise(() => settled),
    (outcome) => expect(outcome).toEqual(Result.succeed(1))
  )
})

it.effect("fails the same way for a callback that throws at once and one whose promise is rejected", () => {
  const thrown = settle((): number => {
    throw new Error("no clipboard")
  }, why)
  const rejected = settle(() => Promise.reject(new Error("no clipboard")), why)
  return Effect.map(
    Effect.all([Effect.promise(() => thrown), Effect.promise(() => rejected)], { concurrency: "unbounded" }),
    (outcomes) => expect(outcomes).toEqual([Result.fail("no clipboard"), Result.fail("no clipboard")])
  )
})
