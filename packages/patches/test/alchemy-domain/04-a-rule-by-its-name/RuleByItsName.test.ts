// The test of `alchemy-domain/04-a-rule-by-its-name.patch`. Without the patch the lock keeps, for a rule an aggregate
// lists by name, the name: the first tally fails with "ACountNeverFalls changed from the rule locked", though the rule
// is the one that was locked, and a lock written again would hold `ACountNeverFalls` and never notice its text change.
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import { Loosened } from "./Loosened.aggregate.ts"
import { Slipping } from "./Slipping.aggregate.ts"
import { Tally } from "./Tally.aggregate.ts"

const underCi = Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ CI: "true" })))

const refusal = (target: Parameters<typeof Verify.aggregate>[0], name: string) =>
  Verify.aggregate(target, {
    source: new URL(`./${name}.aggregate.ts`, import.meta.url),
    lock: new URL(`./${name}.lock.json`, import.meta.url)
  }).pipe(
    underCi,
    Effect.flip,
    Effect.map((error) => error.message)
  )

layer(NodeServices.layer)("a rule an aggregate lists by name, held to a lock", (it) => {
  it.effect(
    "is the rule that was locked, when its text where it is declared is the locked text",
    Effect.fnUntraced(function* () {
      const report = yield* Verify.aggregate(Tally, {
        source: new URL("./Tally.aggregate.ts", import.meta.url),
        lock: new URL("./Tally.lock.json", import.meta.url)
      }).pipe(underCi)
      expect(report.relocked).toEqual([])
    }),
    120_000
  )

  it.effect(
    "is refused when a transition's text changed where it is declared",
    Effect.fnUntraced(function* () {
      const said = yield* refusal(Slipping, "Slipping")
      expect(said).toContain("ACountNeverFalls changed from the rule locked")
    }),
    120_000
  )

  it.effect(
    "is refused when an invariant read through a namespace says less than the locked one",
    Effect.fnUntraced(function* () {
      const said = yield* refusal(Loosened, "Loosened")
      expect(said).toContain("ACountIsNeverNegative says less than the rule locked")
    }),
    120_000
  )
})
