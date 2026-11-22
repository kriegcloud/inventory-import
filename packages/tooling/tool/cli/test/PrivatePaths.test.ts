import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { privatePaths, privatePathsSentence } from "../src/commands/Laws/PrivatePaths.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, printed } from "./support/tree.ts"

// git answers "every file git would commit", so the folder is made a repository first.
const inRepository = Effect.gen(function* () {
  const repo = yield* Repo
  yield* repo.run("git", ["init", "-q"])
  const found = yield* privatePaths()
  return render(privatePathsSentence)(found)
})

// Put together at run time, so this file names no such path itself.
const home = (rest: string) => A.join(["", "home", "dana", rest], "/")
const refused =
  "err: private-paths:check FAIL  a home path or a private folder is named in the scratchpad (the repository is public): write a path from the repository's root, or a placeholder, at:"

describe("laws private-paths", () => {
  it.effect("passes paths from the repository's root and folders of the repository named .claude", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "scratchpad/experiments/idea/NOTE.md":
            "Read apps/inventory/src and .claude/agents; see /homepage and ~/Downloads.\n",
          "scratchpad/experiments/idea/Idea.ts": 'export const path = "./fixtures/home/rows.csv"\n'
        },
        inRepository
      )
      expect(printed(report)).toEqual([
        "out: private-paths:check OK  no home path or private folder in any file of the scratchpad"
      ])
    })
  )

  it.effect("names the file and line of each home path and private folder, never the path", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "scratchpad/experiments/idea/Idea.ts": `export const one = 1\nexport const file = "${home("rows.csv")}"\n`,
          "scratchpad/experiments/idea/NOTE.md": A.join(
            [
              "# idea",
              `Copied from ${A.join(["", "Users", "dana", "Desktop"], "/")} and C:${A.join(["", "Users", "dana"], "\\\\")}.`,
              `Notes in ~/${".claude"}/projects and ${A.join([".config", "Claude"], "/")}.`,
              ""
            ],
            "\n"
          ),
          // Outside the scratchpad, this law reads nothing.
          "packages/ui/src/a.ts": `export const file = "${home("a")}"\n`
        },
        inRepository
      )
      expect(report.failed).toBe(true)
      expect(printed(report)).toEqual([
        refused,
        "err: scratchpad/experiments/idea/Idea.ts:2",
        "err: scratchpad/experiments/idea/NOTE.md:2",
        "err: scratchpad/experiments/idea/NOTE.md:3"
      ])
      expect(A.some(printed(report), Str.includes("dana"))).toBe(false)
    })
  )
})
