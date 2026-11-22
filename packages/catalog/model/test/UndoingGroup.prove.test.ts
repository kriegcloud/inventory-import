// Proves `UndoingGroup`, the decision behind the undo of one act on a group, for every state of the import and the
// group and every input: its own 13 rules, and every rule of the two aggregates it records on. A rule that is no
// longer proved fails here by name. Its counterexamples need a group that was decided, and the prover does not tie an
// instance's id to a key built from two fields of the command (`importId/step`), so a broken rule here comes back
// "not proved", with the sentence "the real code rejects it", and not "violated". It still fails by name.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { UndoingGroup } from "../src/Review/UndoingGroup.decision.ts"
import { allProved, notProved, standingOf, standings, whatBroke } from "./proving.ts"
import { undoingGroupRules } from "./rules.ts"

layer(NodeServices.layer)("UndoingGroup", (it) => {
  it.effect(
    "keeps every rule of the import, of the group and its own, for every state and every input",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.decisionReport(UndoingGroup, {
        source: new URL("../src/Review/UndoingGroup.decision.ts", import.meta.url)
      })
      const said = whatBroke(Prove.renderDecision(report))
      // What is not proved, by name, with what the solver found; then that every rule is there, by name.
      expect(notProved(standings(report)), said).toEqual([])
      expect(standings(report)).toEqual(allProved({ recordsOn: "Group", own: undoingGroupRules }))
      // Every state it leaves is one its aggregate's schema allows.
      expect(standingOf(report.schema), said).toBe("proved")
      // Some state lets it record: it is not proved only because it never does anything.
      expect(report.accepted, said).toBe(true)
      // Past 4,096 paths the prover proves nothing: a rule or a check that adds paths shows here first.
      expect(report.paths, said).toBe(84)
      // Every check of every schema is one the prover reads, so a broken rule comes back with its counterexample.
      expect(report.unread).toEqual([])
      expect(report.unkept).toEqual([])
    }),
    1_500_000
  )
})
