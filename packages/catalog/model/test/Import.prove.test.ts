// Proves the import's 37 rules for each of its seven commands, for every state and every input. The import also folds
// `ActCounted` and `GroupCounted`, which only the four decisions record: what they do to these rules is proved in
// their own tests, and this test says that those two are the only events left to them. Seconds, in `prove`.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { Import } from "../src/Import/Import.aggregate.ts"
import { notProved, standingOf, whatBroke } from "./proving.ts"

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
      // One line a rule and a command: how it stands, the rule, the command.
      const lines = A.flatMap([...report.invariants, ...report.transitions], (rule) =>
        A.map(rule.commands, (proof) => `${standingOf(proof.verdict)}  ${rule.name}  ${proof.command}`)
      )
      // What is not proved, by name, with what the solver found; and every rule is proved for every command. Which
      // rules there are is the lock's, in the search of the whole model.
      expect(notProved(lines), said).toEqual([])
      expect(
        A.map([...report.invariants, ...report.transitions], (rule) => rule.commands.length),
        said
      ).toEqual(A.map([...report.invariants, ...report.transitions], () => report.commands.length))
      expect(report.initial, said).toBe(true)
      expect(
        A.map(report.invariants, (rule) => rule.initial),
        said
      ).toEqual(A.map(report.invariants, () => true))
      expect(
        notProved(A.map(report.commands, (command) => `${standingOf(command.schema)}  ${command.command}`)),
        said
      ).toEqual([])
      // The two events no command of the import records: the four decisions do, and their tests prove it.
      expect(report.outside).toEqual(["ActCounted", "GroupCounted"])
      // Every check of every schema is one the prover reads, so a broken rule comes back with its counterexample.
      expect(report.unread).toEqual([])
      expect(report.unkept).toEqual([])
    }),
    600_000
  )
})
