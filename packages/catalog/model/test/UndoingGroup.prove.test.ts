// Proves `UndoingGroup`, the decision behind the undo of one act on a group, for every state of the import and the
// group and every input: its own 14 rules, and every rule of the two aggregates it records on. A rule that is no
// longer proved fails here by name. Its counterexamples need a group that was decided, under a key built from two
// fields of the command (`importId/step`). The library as published does not tie an instance's id to such a key, and
// a broken rule here then comes back "not proved", with the sentence "the real code rejects it". The repository
// patches that (`packages/patches/alchemy-domain/01-computed-instance-id.patch`, docs/patches.md): with the patch a
// broken rule comes back "violated", with the state and the command that break it.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { UndoingGroup } from "../src/Review/UndoingGroup.decision.ts"
import { missingRules, notProved, standingOf, standings, whatBroke } from "./proving.ts"

layer(NodeServices.layer)("UndoingGroup", (it) => {
  it.effect(
    "keeps every rule of the import, of the group and its own, for every state and every input",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.decisionReport(UndoingGroup, {
        source: new URL("../src/Review/UndoingGroup.decision.ts", import.meta.url)
      })
      const said = whatBroke(Prove.renderDecision(report))
      // Ours, because `Prove` takes no lock and no `require`: what is not proved, by name, with what the solver found.
      // Which rules there are, and that each stays proved, is the library's, in the search of the whole model.
      expect(notProved(standings(report)), said).toEqual([])
      // Ours too, because the library does not ask whose act a decision records: the rules of every aggregate it reads
      // are there, and the ones about who may change a row or a group it states itself.
      expect(missingRules({ report, decision: UndoingGroup }), said).toEqual([])
      // Every state it leaves is one its aggregate's schema allows.
      expect(standingOf(report.schema), said).toBe("proved")
      // Some state lets it record: it is not proved only because it never does anything.
      expect(report.accepted, said).toBe(true)
      // Past 4,096 paths the prover proves nothing: a rule or a check that adds paths shows here first.
      expect(report.paths, said).toBe(86)
      // Every check of every schema is one the prover reads, so a broken rule comes back with its counterexample.
      expect(report.unread).toEqual([])
      expect(report.unkept).toEqual([])
    }),
    1_500_000
  )
})
