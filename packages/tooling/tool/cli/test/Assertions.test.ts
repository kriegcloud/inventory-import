// The type-assertion ban's lists: the configuration is the one profile, a listed file still holds an assertion, no
// list grows past its ceiling or changes its files, a ceiling falls with its list, and no comment turns the rule off.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import * as Str from "effect/String"
import {
  type AssertionHolds,
  assertions,
  assertionsConfig,
  assertionsSentence,
  holdsAssertion,
  recordedHolds
} from "../src/commands/Laws/Assertions.rules.ts"
import { heldAs } from "../src/commands/Laws/internal/held.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

/** The holds of `lists` as they are given: each one's length and the number its files give. */
const holding = (lists: ReadonlyArray<ReadonlyArray<string>>): AssertionHolds => ({
  ceilings: A.map(lists, (files) => files.length),
  held: A.map(lists, heldAs),
  counts: R.fromEntries(A.map(A.flatten(lists), (file) => [file, 1] as const))
})

/** The law, in a fresh repository, holding the lists to `holds`. */
const inRepository = Effect.fn("inRepository")(function* (holds: AssertionHolds) {
  const repo = yield* Repo
  yield* repo.run("git", ["init", "-q"])
  const found = yield* assertions(holds)
  return printed(render(assertionsSentence)(found))
})

const ignored = [
  ".agents/**",
  ".codex/**",
  "scratchpad/**",
  "vendor/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/.wrangler/**",
  "**/.turbo/**",
  ".claude/**"
]

/** The profile, its three lists naming `lists`, with `change` made to it. */
const config = (lists: ReadonlyArray<ReadonlyArray<string>>, change: Readonly<Record<string, unknown>> = {}) =>
  `// the ban\n${json({
    plugins: ["typescript"],
    categories: { correctness: "off" },
    rules: { "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }] },
    ignorePatterns: ignored,
    overrides: A.map(lists, (files) => ({ files, rules: { "typescript/consistent-type-assertions": "off" } })),
    ...change
  })}`

const asserting = "export const a = ({} as { n: number })\n"

/** Three lists of three files each, every file holding an assertion. */
const listOf = (list: number) => A.makeBy(3, (i) => `l${list}/f${i}.ts`)
const [first, second, third] = [listOf(0), listOf(1), listOf(2)]
const lists = [first, second, third]
const files = R.fromEntries(A.map(A.flatten(lists), (file) => [file, asserting] as const))

describe("laws assertions", () => {
  it("reads an assertion, and not `as const`", () => {
    expect(holdsAssertion({ file: "a.ts", source: asserting })).toBe(true)
    expect(holdsAssertion({ file: "a.ts", source: "export const a = <number>(1)\n" })).toBe(true)
    expect(
      holdsAssertion({ file: "a.ts", source: "export const a = [1] as const\nexport const b = 1 satisfies number\n" })
    ).toBe(false)
  })

  it.effect("passes the profile whose lists are the ones held, each file holding an assertion", () =>
    Effect.gen(function* () {
      const said = yield* inTree({ [assertionsConfig]: config(lists), ...files }, inRepository(holding(lists)))
      expect(said).toEqual([
        "out: assertions:check OK  the type-assertion ban's lists name 9 files, each still holding one"
      ])
    })
  )

  it.effect("refuses a profile that leaves more out, turns the rule another way, or has a fourth list", () =>
    Effect.gen(function* () {
      for (const change of [
        { ignorePatterns: [...ignored, "packages/catalog/**"] },
        { rules: { "typescript/consistent-type-assertions": ["error", { assertionStyle: "as" }] } },
        { rules: { "typescript/consistent-type-assertions": "off" } },
        { extends: ["./other.json"] },
        {
          overrides: A.map([...lists, ["l3/f0.ts"]], (files) => ({
            files,
            rules: { "typescript/consistent-type-assertions": "off" }
          }))
        }
      ]) {
        const said = yield* inTree(
          { [assertionsConfig]: config(lists, change), ...files },
          inRepository(holding(lists))
        )
        expect(said[1]).toContain(`${assertionsConfig} is not the profile this law holds`)
      }
    })
  )

  it.effect(
    "refuses a list past its ceiling, one changed, a ceiling above its list, a settled file and a comment",
    () =>
      Effect.gen(function* () {
        const held = holding(lists)
        const grown = [...first, "l0/extra.ts"]
        // A clean file swapped for a new one keeps the length and changes the files.
        const swapped = [...A.drop(second, 1), "l1/new.ts"]
        const settled = A.drop(third, 1)
        const disable = Str.trim(`oxlint-disable-next-line typescript/consistent-type-assertions`)
        const said = yield* inTree(
          {
            [assertionsConfig]: config([grown, swapped, third]),
            ...files,
            "l0/extra.ts": asserting,
            "l1/new.ts": asserting,
            "l2/f0.ts": "export const a = 1\n",
            "packages/x/src/b.ts": `// ${disable}\nexport const b = 1\n`
          },
          inRepository(held)
        )
        expect(said).toEqual([
          `err: assertions:check FAIL  the type-assertion ban's lists (${assertionsConfig}) do not hold:`,
          "err:   list 1 names 4 files, past its ceiling of 3: a list only shrinks. Fix the code instead",
          `err:   list 1 names other files than the ones it is held by (${heldAs(first)}): it may only shrink. If files came off it because they are clean, record ${heldAs(grown)} in assertionsHeld; never add one`,
          `err:   list 2 names other files than the ones it is held by (${heldAs(second)}): it may only shrink. If files came off it because they are clean, record ${heldAs(swapped)} in assertionsHeld; never add one`,
          // A file put in a list with no number held, a clean one, and a number held for a file no list names.
          `err:   l0/extra.ts  is in one of the lists of ${assertionsConfig} or in assertionCounts but not both: the two name the same files`,
          `err:   l1/new.ts  is in one of the lists of ${assertionsConfig} or in assertionCounts but not both: the two name the same files`,
          "err:   l2/f0.ts  is listed in assertionCounts but breaks the rule no more: take its line off",
          `err:   l1/f0.ts  is in one of the lists of ${assertionsConfig} or in assertionCounts but not both: the two name the same files`,
          "err:   packages/x/src/b.ts:1  a comment that turns the type-assertion rule off (oxlint-disable-next-line): no comment does. Remove it"
        ])
        const fewer = yield* inTree(
          { [assertionsConfig]: config([first, second, settled]), ...files },
          inRepository(held)
        )
        expect(fewer).toContain("err:   list 3 names 2 files: lower its ceiling from 3 to 2 in assertionCeilings")
      })
  )

  it("the recorded holds are the ones the repository's lists give", () => {
    expect([recordedHolds.ceilings.length, recordedHolds.held.length]).toEqual([3, 3])
  })
})
