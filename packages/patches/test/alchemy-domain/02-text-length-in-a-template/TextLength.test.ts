// The test of `alchemy-domain/02-text-length-in-a-template.patch`. Without the patch the proof ends before any rule
// is tried: "ProveError: z3 cannot read back (str.len |command.text|): nothing declares it".
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Label } from "./Label.aggregate.ts"

layer(NodeServices.layer)("a text's length written into a template", (it) => {
  it.effect(
    "is read: the rule that holds is proved, and the broken one comes back with the text that breaks it",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(Label, { source: new URL("./Label.aggregate.ts", import.meta.url) })
      const said = Prove.render(report)
      expect(said).toMatch(/✓ ALabelIsNeverEmpty\n\s+✓ holds on the initial state\n\s+✓ proved for Seal/)
      expect(said).toMatch(/✗ ALabelIsNeverOneX[\s\S]*command\s+Seal \{ labelId: "[^"]*", text: "x" \}/)
    }),
    120_000
  )
})
