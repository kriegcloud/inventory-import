// The test of `alchemy-domain/01-computed-instance-id.patch`. Without the patch the rule below is "not proved", with
// the sentence "the real code keeps Card.ACardKeepsItsAuthor on it" and no state: the prover replays the solver's
// answer on the stream `Card/`, and the real `keyOf` reads `Card//`.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { WritingCard } from "./WritingCard.decision.ts"

layer(NodeServices.layer)("a rule a decision breaks, where keyOf builds the id from two fields", (it) => {
  it.effect(
    "comes back violated, with the state and the command that break it",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.decisionReport(WritingCard, {
        source: new URL("./WritingCard.decision.ts", import.meta.url)
      })
      const said = Prove.renderDecision(report)
      expect(said).toContain("✗ Card.ACardKeepsItsAuthor: violated")
      expect(said).toMatch(/state\s+\{ card: \{ by: "[^"]+" \} \}/)
      expect(said).toMatch(/command\s+WriteCard \{/)
    }),
    120_000
  )
})
