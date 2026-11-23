// The type-assertion ban's lists: a listed file still holds an assertion, no list grows past its ceiling, a ceiling
// falls with its list, and no comment turns the rule off.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import * as Str from "effect/String"
import {
  assertionCeilings,
  assertions,
  assertionsConfig,
  assertionsSentence,
  holdsAssertion
} from "../src/commands/Laws/Assertions.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

const inRepository = Effect.gen(function* () {
  const repo = yield* Repo
  yield* repo.run("git", ["init", "-q"])
  const found = yield* assertions()
  return printed(render(assertionsSentence)(found))
})

/** A configuration whose lists name `files`, each list as long as its ceiling unless given. */
const config = (lists: ReadonlyArray<ReadonlyArray<string>>) =>
  `// the ban\n${json({ overrides: A.map(lists, (files) => ({ files, rules: {} })) })}`

/** `count` file names under `folder`. */
const named = (folder: string, count: number) => A.makeBy(count, (i) => `${folder}/f${i}.ts`)

const asserting = "export const a = ({} as { n: number })\n"

/** A tree whose three lists are full to their ceilings, each file holding an assertion. */
const full = () => {
  const lists = A.map(assertionCeilings, (ceiling, list) => named(`l${list}`, ceiling))
  return { lists, files: R.fromEntries(A.map(A.flatten(lists), (file) => [file, asserting] as const)) }
}

describe("laws assertions", () => {
  it("reads an assertion, and not `as const`", () => {
    expect(holdsAssertion({ file: "a.ts", source: asserting })).toBe(true)
    expect(holdsAssertion({ file: "a.ts", source: "export const a = <number>(1)\n" })).toBe(true)
    expect(
      holdsAssertion({ file: "a.ts", source: "export const a = [1] as const\nexport const b = 1 satisfies number\n" })
    ).toBe(false)
  })

  it.effect("passes lists full to their ceilings whose files each hold an assertion", () =>
    Effect.gen(function* () {
      const { files, lists } = full()
      const said1 = yield* inTree({ [assertionsConfig]: config(lists), ...files }, inRepository)

      expect(said1).toEqual([
        `out: assertions:check OK  the type-assertion ban's lists name ${A.flatten(lists).length} files, each still holding one`
      ])
    })
  )

  it.effect(
    "refuses a list past its ceiling, a ceiling above its list, a settled file and a comment that turns it off",
    () =>
      Effect.gen(function* () {
        const { files, lists } = full()
        const grown = [...(lists[0] ?? []), "l0/extra.ts"]
        const shrunk = A.drop(lists[1] ?? [], 1)
        const settled = lists[2]?.[0] ?? ""
        const disable = Str.trim(`oxlint-disable-next-line typescript/consistent-type-assertions`)
        const said = yield* inTree(
          {
            [assertionsConfig]: config([grown, shrunk, lists[2] ?? []]),
            ...files,
            "l0/extra.ts": asserting,
            [settled]: "export const a = 1\n",
            "packages/x/src/b.ts": `// ${disable}\nexport const b = 1\n`
          },
          inRepository
        )
        expect(said).toEqual([
          `err: assertions:check FAIL  the type-assertion ban's lists (${assertionsConfig}) do not hold:`,
          `err:   list 1 names ${grown.length} files, past its ceiling of ${assertionCeilings[0]}: a list only shrinks. Fix the code instead`,
          `err:   list 2 names ${shrunk.length} files: lower its ceiling from ${assertionCeilings[1]} to ${shrunk.length} in assertionCeilings`,
          `err:   ${settled}  is listed but holds no type assertion: take its line off the list in ${assertionsConfig}`,
          "err:   packages/x/src/b.ts:1  a comment that turns the type-assertion rule off (oxlint-disable-next-line): no comment does. Remove it"
        ])
      })
  )
})
