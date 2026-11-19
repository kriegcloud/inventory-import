// The day's model calls over the in-memory store: forty are taken, the next is refused in a sentence, another
// organization has its own forty, and a call comes back a day after it was taken.
import { expect, layer } from "@effect/vitest"
import { AllowanceAnswer, dailyModelCalls, ModelAllowanceGateway } from "@inventory/access-contract/ModelAllowance"
import { ModelAllowanceGatewayLive } from "@inventory/access-model/AllowanceHandler"
import { windowStart } from "@inventory/access-model/AllowanceRules"
import { accessMemory } from "@inventory/access-model/Memory"
import { DateTime, Effect, Layer } from "effect"
import { SecureRandom } from "effect/crypto"
import * as A from "effect/Array"
import { TestClock } from "effect/testing"
import { as, dana, elena, marcus, seed } from "./support.ts"

const App = ModelAllowanceGatewayLive.pipe(
  Layer.provideMerge(accessMemory(seed)),
  Layer.provide(SecureRandom.layerWebCrypto)
)
const take = Effect.flatMap(ModelAllowanceGateway, (gateway) => gateway.take("view"))
const kind = (answer: AllowanceAnswer) => answer.kind

layer(App)("the model allowance", (it) => {
  it.effect("an organization takes forty calls a day, whoever asks; the next is refused, and they come back", () =>
    Effect.gen(function* () {
      const first = yield* Effect.forEach(A.range(1, dailyModelCalls - 1), () => take.pipe(as(dana)), {
        concurrency: 1
      })
      expect(A.dedupe(A.map(first, kind))).toEqual(["taken"])
      yield* TestClock.adjust("1 hour")
      const last = yield* take.pipe(as(marcus))
      expect(last.kind).toBe("taken")
      const refused = yield* take.pipe(as(dana))
      expect(AllowanceAnswer.match(refused, { taken: () => "taken", usedUp: (answer) => answer.reason })).toBe(
        "The day's 40 AI calls are used. They come back over the next day."
      )
      // Another organization has its own allowance.
      const other = yield* take.pipe(as(elena))
      expect(other.kind).toBe("taken")
      // A day after the first thirty-nine were taken they no longer count; the one taken an hour later still does.
      yield* TestClock.adjust("1381 minutes")
      const back = yield* Effect.forEach(A.range(1, dailyModelCalls), () => take.pipe(as(dana)), { concurrency: 1 })
      expect(A.map(back, kind)).toEqual([...A.replicate("taken", dailyModelCalls - 1), "usedUp"])
    })
  )

  it("the window is the 24 hours before now", () => {
    const now = DateTime.makeUnsafe("2026-03-02T09:30:00.000Z")
    expect(DateTime.formatIso(windowStart(now))).toBe("2026-03-01T09:30:00.000Z")
  })
})
