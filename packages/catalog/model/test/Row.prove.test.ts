// The row's starting state fits its schema and every invariant of the row holds on it, half a minute after a change
// and not only in the search of the whole model. The row has no command of its own: what `Deciding` and `Undoing` do
// to its rules is proved in their own tests (`Deciding.prove.test.ts`, `Undoing.prove.test.ts`), which assert every
// rule of every aggregate a decision reads, and this test says those two decisions' events are the only ones it folds.
//
// Why the row is not proved here under the two decisions, as the group is: that report takes about three minutes,
// against a tenth of a second for this one, and proves no rule the decisions' tests do not (measured 2026-11-26,
// goals/alchemy-domain-uptake/INVENTORY.md, tests-03). The one thing not to break: an event added to the row is
// recorded by a decision whose proof asserts the row's rules, and is added to the list below.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Row } from "../src/Row/Row.aggregate.ts"
import { aggregateFailures, whatBroke } from "./proving.ts"

layer(NodeServices.layer)("Row", (it) => {
  it.effect(
    "starts in a state its schema and every invariant allow, and folds only what the two decisions record",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(Row, { source: new URL("../src/Row/Row.aggregate.ts", import.meta.url) })
      const said = whatBroke(Prove.render(report))
      expect(aggregateFailures(report), said).toEqual([])
      expect(report.invariants.length, said).toBeGreaterThan(0)
      // `Deciding` records `RowDecided` and `Undoing` records `StepUndone`; their proofs hold the row's rules.
      expect(report.outside).toEqual(["RowDecided", "StepUndone"])
      expect(report.unread).toEqual([])
      expect(report.unkept).toEqual([])
    }),
    600_000
  )
})
