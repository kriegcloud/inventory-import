// The type-assertion ban's lists: the configuration is the one profile, each listed file is held at its number of
// assertions in a ledger that only falls against main's, the lists and the ledger name the same files, and no comment
// turns the rule off.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import * as Str from "effect/String"
import {
  assertions,
  assertionsConfig,
  assertionsSentence,
  countAssertions,
  holdsAssertion
} from "../src/commands/Laws/Assertions.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, onMain, printed, type Tree } from "./support/tree.ts"

/** The test's own ledger, from the root. */
const ledgerPath = "packages/x/ledger.json"

/** A ledger holding each of `files` at one assertion. */
const ledgerOf = (files: ReadonlyArray<string>) => json(R.fromEntries(A.map(files, (file) => [file, 1] as const)))

/** The law, in a repository whose main holds what `inTree` wrote, with `after` written on the branch. */
const inRepository = Effect.fn("inRepository")(function* (after: Tree = {}) {
  const repo = yield* Repo
  yield* onMain()
  yield* Effect.forEach(R.toEntries(after), ([file, text]) => repo.write(repo.join(repo.root, file), text), {
    concurrency: 1,
    discard: true
  })
  const found = yield* assertions(ledgerPath)
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
    rules: {
      "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "typescript/no-non-null-assertion": "error"
    },
    ignorePatterns: ignored,
    overrides: A.map(lists, (files, at) => ({
      files,
      rules:
        at === 0
          ? { "typescript/consistent-type-assertions": "off", "typescript/no-non-null-assertion": "off" }
          : { "typescript/consistent-type-assertions": "off" }
    })),
    ...change
  })}`

const asserting = "export const a = ({} as { n: number })\n"

/** Three lists of three files each, every file holding an assertion. */
const listOf = (list: number) => A.makeBy(3, (i) => `l${list}/f${i}.ts`)
const [first, second, third] = [listOf(0), listOf(1), listOf(2)]
const lists = [first, second, third]
const files: Tree = {
  ...R.fromEntries(A.map(A.flatten(lists), (file) => [file, asserting] as const)),
  [ledgerPath]: ledgerOf(A.flatten(lists)),
  [assertionsConfig]: config(lists)
}

describe("laws assertions", () => {
  it("reads an assertion, and not `as const`", () => {
    expect(holdsAssertion({ file: "a.ts", source: asserting })).toBe(true)
    expect(holdsAssertion({ file: "a.ts", source: "export const a = <number>(1)\n" })).toBe(true)
    expect(
      holdsAssertion({ file: "a.ts", source: "export const a = [1] as const\nexport const b = 1 satisfies number\n" })
    ).toBe(false)
    expect(countAssertions({ file: "a.ts", source: "export const a = ({} as { n: number }).n as number\n" })).toBe(2)
  })

  it.effect("passes the profile whose lists are the ones held, each file holding an assertion", () =>
    Effect.gen(function* () {
      const said = yield* inTree({ [assertionsConfig]: config(lists), ...files }, inRepository())
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
        const said = yield* inTree({ ...files, [assertionsConfig]: config(lists, change) }, inRepository())
        expect(said[1]).toContain(`${assertionsConfig} is not the profile this law holds`)
      }
    })
  )

  it.effect("holds each listed file at its number, and the lists and the ledger at the same files", () =>
    Effect.gen(function* () {
      const disable = Str.trim(`oxlint-disable-next-line typescript/consistent-type-assertions`)
      // A file put in a list with no number held, a clean one, and a number held for a file no list names.
      const moved = yield* inTree(
        files,
        inRepository({
          [assertionsConfig]: config([[...first, "l0/extra.ts"], A.drop(second, 1), third]),
          "l0/extra.ts": asserting,
          "l2/f0.ts": "export const a = 1\n",
          "packages/x/src/b.ts": `// ${disable}\nexport const b = 1\n`
        })
      )
      expect(moved).toEqual([
        `err: assertions:check FAIL  the type-assertion ban's lists (${assertionsConfig}) do not hold:`,
        `err:   l0/extra.ts  is in one of the lists of ${assertionsConfig} or in its ledger but not both: the two name the same files`,
        `err:   l2/f0.ts  is listed in ${ledgerPath} but breaks the rule no more: take its line off`,
        `err:   l1/f0.ts  is in one of the lists of ${assertionsConfig} or in its ledger but not both: the two name the same files`,
        "err:   packages/x/src/b.ts:1  a comment that turns the type-assertion rule off (oxlint-disable-next-line): no comment does. Remove it"
      ])
      // One more assertion in a listed file, then its number raised with it in the same commit.
      const twice = `${asserting}export const b = ({} as { m: number })\n`
      const more = yield* inTree(files, inRepository({ "l0/f0.ts": twice }))
      expect(more).toContain(
        `err:   l0/f0.ts  breaks the rule in 2 places, more than the 1 ${ledgerPath} holds it to: a listed file may only lose places. Fix the new ones`
      )
      const raised = yield* inTree(
        files,
        inRepository({
          "l0/f0.ts": twice,
          [ledgerPath]: json({ ...R.fromEntries(A.map(A.flatten(lists), (file) => [file, 1] as const)), "l0/f0.ts": 2 })
        })
      )
      expect(raised).toContain(
        `err:   l0/f0.ts  is held at 2 in ${ledgerPath}, above the 1 main holds it to: a number only falls`
      )
    })
  )
})
