// The ban on `@effect-diagnostics` directives: each is refused where it stands, the list only shrinks. A directive is
// put together here, never written out, since the checker reads one in a string too.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import {
  diagnostics,
  diagnosticsHeld,
  diagnosticsListed,
  diagnosticsSentence,
  directiveLines
} from "../src/commands/Laws/Diagnostics.rules.ts"
import { heldAs } from "../src/commands/Laws/internal/held.ts"
import { diagnosticDirective } from "../src/commands/Scratch/Scratch.templates.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, printed } from "./support/tree.ts"

const inRepository = Effect.gen(function* () {
  const repo = yield* Repo
  yield* repo.run("git", ["init", "-q"])
  const found = yield* diagnostics()
  return printed(render(diagnosticsSentence)(found))
})

const off = `// ${diagnosticDirective} strictEffectProvide:off\nconst a = 1\n// ${diagnosticDirective}-next-line floatingEffect:off\nconst b = 2\nconst said = "${diagnosticDirective} schemaSync:off"\n`

describe("laws diagnostics", () => {
  it("finds each directive, in a comment or a string, and not the word alone", () => {
    expect(directiveLines(off)).toEqual([1, 3, 5])
    expect(directiveLines(`// the ${diagnosticDirective} comment is banned\n`)).toEqual([])
  })

  it.effect("refuses each directive in a file the list does not name, and a listed file with none left", () =>
    Effect.gen(function* () {
      const said = yield* inTree({ "packages/x/src/a.ts": off }, inRepository)
      expect(said).toContain(
        "err: packages/x/src/a.ts:3  an @effect-diagnostics directive: remove it and write the code the rule asks for"
      )
      expect(said.length).toBe(4)
      const listed = O.getOrElse(A.head(diagnosticsListed), () => "")
      const said1 = yield* inTree({ [listed]: off }, inRepository)

      expect(said1).toEqual([expect.stringContaining("out: diagnostics:check OK")])
      const said2 = yield* inTree({ [listed]: "const a = 1\n" }, inRepository)

      expect(said2).toContain(
        `err: ${listed}  is listed in diagnosticsListed but holds no directive any more: take its line off the list`
      )
      const said3 = yield* inTree({ "docs/a.ts": off, "scratchpad/experiments/x/a.ts": off }, inRepository)

      expect(said3).toEqual([expect.stringContaining("out: diagnostics:check OK")])
    })
  )

  it("the list only shrinks: its length is held here, and lowered with it", () => {
    expect(diagnosticsListed.length).toBe(22)
    expect(A.dedupe(diagnosticsListed).length).toBe(diagnosticsListed.length)
    expect(heldAs(diagnosticsListed)).toBe(diagnosticsHeld)
  })
})
