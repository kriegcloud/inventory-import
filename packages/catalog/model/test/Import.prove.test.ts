// Proves the import's 27 rules for each of its seven commands, for every state and every input. The import also folds
// `ActCounted` and `GroupCounted`, which only the four decisions record: what they do to these rules is proved in
// their own tests, and this test says that those two are the only events left to them. It also says that some state
// lets each command record, and that the code did what the prover read. Seconds, in `prove`.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { Import } from "../src/Import/Import.aggregate.ts"
import { aggregateFailures, whatBroke } from "./proving.ts"

layer(NodeServices.layer)("Import", (it) => {
  it.effect(
    "each of its commands keeps every rule, for every state and every input",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(Import, {
        source: new URL("../src/Import/Import.aggregate.ts", import.meta.url)
      })
      // The report always ends on the event the import leaves to the decisions: that is said below, not a failure.
      const said = whatBroke(
        Str.replace(/✗ Import folds ActCounted, GroupCounted[^\n]*\n[^\n]*\n/, "")(Prove.render(report))
      )
      expect(aggregateFailures(report), said).toEqual([])
      // The two events no command of the import records: the four decisions do, and their tests prove it.
      expect(report.outside).toEqual(["ActCounted", "GroupCounted"])
      // Every check of every schema is one the prover reads, so a broken rule comes back with its counterexample.
      expect(report.unread).toEqual([])
      expect(report.unkept).toEqual([])
    }),
    600_000
  )
})
