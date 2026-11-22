// The scratchpad and the laws (decision "the scratchpad", 2026-11-22). The laws on how code is written leave an
// experiment alone: each fixture below is refused in a package and passes, unread, in the scratchpad. The law on
// secrets reads it like everything else. The first two hold because the law names the scratchpad; the tags and
// imports laws list only `apps`, `packages`, `scripts` and `test`, so they never reach it, and name it all the same.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { effectImports } from "../src/commands/Laws/EffectImports.rules.ts"
import { effectImportsSentence } from "../src/commands/Laws/EffectImports.schema.ts"
import { keys, keysSentence } from "../src/commands/Laws/Keys.rules.ts"
import { refCallbacks, refCallbacksSentence } from "../src/commands/Laws/RefCallbacks.rules.ts"
import { tags, tagsSentence } from "../src/commands/Laws/Tags.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { type Line, render } from "../src/Report.schema.ts"
import { inTree, printed, type Tree } from "./support/tree.ts"

// git answers "every file git would commit", so the folder is made a repository first.
const law =
  <Finding, E>(rule: Effect.Effect<ReadonlyArray<Finding>, E, Repo>, sentence: (finding: Finding) => Line) =>
  (tree: Tree) =>
    inTree(
      tree,
      Effect.gen(function* () {
        const repo = yield* Repo
        yield* repo.run("git", ["init", "-q"])
        const found = yield* rule
        return render(sentence)(found)
      })
    )

const perDraw = "export const List = () => <div ref={(node) => node?.focus()} />\n"
const byHand = 'export const isA = (x: { _tag: "A" } | { _tag: "B" }) => x._tag === "A"\n'
// Put together here, so the imports law does not read this file's fixture as its own import.
const fromBarrel = `import { Option } from ${'"effect"'}\nexport const none = Option.none()\n`
// Put together at run time, so this file holds no key-shaped string itself.
// The installed package the imports law judges an import against.
const installed: Tree = {
  "node_modules/effect/package.json": "{}",
  "node_modules/effect/dist/index.js": "",
  "node_modules/effect/dist/Option.js": "",
  "node_modules/effect/dist/Function.d.ts": ""
}
const keyShaped = `export const key = "sk-or-${Str.repeat(24)("a")}"\n`

describe("the scratchpad and the laws", () => {
  it.effect("a ref made on each draw is refused in a package and left alone in an experiment", () =>
    Effect.gen(function* () {
      const run = law(refCallbacks(), refCallbacksSentence)
      const inPackage = yield* run({ "packages/web/src/List.tsx": perDraw })
      const inExperiment = yield* run({ "scratchpad/experiments/idea/List.tsx": perDraw })
      expect(inPackage.failed).toBe(true)
      expect(inExperiment.failed).toBe(false)
      expect(printed(inExperiment)).toEqual([
        "out: refs:check OK  every ref is a DOM ref or a callback that stays the same across draws"
      ])
    })
  )

  it.effect("a tag told apart by hand is refused in a package and left alone in an experiment", () =>
    Effect.gen(function* () {
      const run = law(tags(), tagsSentence)
      const inPackage = yield* run({ "packages/web/src/Step.ts": byHand })
      const inExperiment = yield* run({
        "scratchpad/experiments/idea/Step.ts": byHand,
        "scratchpad/experiments/idea/Step.test.ts": byHand
      })
      expect(inPackage.failed).toBe(true)
      expect(printed(inExperiment)).toEqual(["out: tags:check OK  no _tag is told apart or built by hand"])
    })
  )

  it.effect("an import from the barrel is refused in a package and left alone in an experiment, even when named", () =>
    Effect.gen(function* () {
      const inPackage = yield* law(
        effectImports(false, []),
        effectImportsSentence
      )({
        ...installed,
        "packages/web/src/a.ts": fromBarrel
      })
      const inExperiment = yield* law(
        effectImports(false, []),
        effectImportsSentence
      )({
        "scratchpad/experiments/idea/a.ts": fromBarrel
      })
      const named = yield* law(
        effectImports(true, ["scratchpad/experiments/idea/a.ts"]),
        effectImportsSentence
      )({ ...installed, "scratchpad/experiments/idea/a.ts": fromBarrel })
      expect(inPackage.failed).toBe(true)
      expect(inExperiment.failed).toBe(false)
      expect(named.failed).toBe(false)
      expect(A.some(printed(named), Str.includes("scratchpad"))).toBe(false)
    })
  )

  it.effect("a key in an experiment is refused like any other", () =>
    Effect.gen(function* () {
      const report = yield* law(keys(), keysSentence)({ "scratchpad/experiments/idea/Client.ts": keyShaped })
      expect(printed(report)).toEqual([
        "err: keys:check FAIL  a key-shaped string is in:",
        "err: scratchpad/experiments/idea/Client.ts:1"
      ])
    })
  )
})
