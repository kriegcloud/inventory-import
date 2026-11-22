// Proves `Undoing`, the decision behind the undo of one row's act, for every state of the import and the row and
// every input: its own 21 rules, and every rule of the two aggregates it records on. A rule that is no longer proved
// fails here by name, with the state and the command the solver found. The longest proof of the model, about twenty
// seconds; it runs in `prove`, which turbo replays until the model's files or the pinned library change.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Undoing } from "../src/Review/Undoing.decision.ts"
import { missingRules, notProved, standingOf, standings, whatBroke } from "./proving.ts"

layer(NodeServices.layer)("Undoing", (it) => {
  it.effect(
    "keeps every rule of the import, of the row and its own, for every state and every input",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.decisionReport(Undoing, {
        source: new URL("../src/Review/Undoing.decision.ts", import.meta.url)
      })
      const said = whatBroke(Prove.renderDecision(report))
      // Ours, because `Prove` takes no lock and no `require`: what is not proved, by name, with what the solver found.
      // Which rules there are, and that each stays proved, is the library's, in the search of the whole model.
      expect(notProved(standings(report)), said).toEqual([])
      // Ours too, because the library does not ask whose act a decision records: the rules of every aggregate it reads
      // are there, and the ones about who may change a row or a group it states itself.
      expect(missingRules(report), said).toEqual([])
      // Every state it leaves is one its aggregate's schema allows.
      expect(standingOf(report.schema), said).toBe("proved")
      expect(report.accepted, said).toBe(true)
      // Past 4,096 paths the prover proves nothing: a rule or a check that adds paths shows here first.
      expect(report.paths, said).toBe(298)
      // Every check of every schema is one the prover reads, so a broken rule comes back with its counterexample.
      expect(report.unread).toEqual([])
      expect(report.unkept).toEqual([])
    }),
    3_000_000
  )
})
