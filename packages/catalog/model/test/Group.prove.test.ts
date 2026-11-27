// Proves the group's rules under the two decisions that record on it, `DecidingGroup` and `UndoingGroup`, for every
// state and every input, and that the group's starting state fits its schema and its invariants. The group has no
// command of its own, so its report names every command it is proved for and leaves no event outside: an event the
// group comes to fold that neither decision records fails here by name. Seconds, in `prove`.
//
// The one thing not to break: the decisions are listed in the order their files import one another (`UndoingGroup`'s
// file imports `DecidingGroup`'s through `Deciding.decision.ts`), or the prover meets a decision before it is adopted
// and stops with a `ProveError`.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Group } from "../src/Group/Group.aggregate.ts"
import { DecidingGroup } from "../src/Review/DecidingGroup.decision.ts"
import { UndoingGroup } from "../src/Review/UndoingGroup.decision.ts"
import { aggregateFailures, whatBroke } from "./proving.ts"

layer(NodeServices.layer)("Group", (it) => {
  it.effect(
    "the two decisions that record on it keep every rule of the group, for every state and every input",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(Group, {
        source: new URL("../src/Group/Group.aggregate.ts", import.meta.url),
        decisions: [
          { decision: DecidingGroup, source: new URL("../src/Review/DecidingGroup.decision.ts", import.meta.url) },
          { decision: UndoingGroup, source: new URL("../src/Review/UndoingGroup.decision.ts", import.meta.url) }
        ]
      })
      const said = whatBroke(Prove.render(report))
      expect(aggregateFailures(report), said).toEqual([])
      expect(report.commands.length, said).toBe(2)
      // Nothing the group folds is left to a test elsewhere.
      expect(report.outside, said).toEqual([])
      expect(report.unread).toEqual([])
      expect(report.unkept).toEqual([])
    }),
    600_000
  )
})
