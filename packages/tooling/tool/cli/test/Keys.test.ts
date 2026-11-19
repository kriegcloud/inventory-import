import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { keys } from "../src/commands/Laws/Keys.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { inTree, printed } from "./support/tree.ts"

// git answers "every file git would commit", so the folder is made a repository first.
const inRepository = Effect.gen(function* () {
  const repo = yield* Repo
  yield* repo.run("git", ["init", "-q"])
  return yield* keys()
})

// Put together at run time, so this file holds no key-shaped string itself.
const keyShaped = `sk-or-${Str.repeat(24)("a")}`

describe("laws keys", () => {
  it.effect("passes when no file holds a key-shaped string", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/a.ts": 'export const k = "sk-or-short"\n' }, inRepository)
      expect(printed(report)).toEqual(["out: keys:check OK  no key-shaped string in any file git would commit"])
    })
  )

  it.effect("names the file and line of a new file that holds one, and never the string", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        { "src/a.ts": `export const one = 1\nexport const k = "${keyShaped}"\n` },
        inRepository
      )
      expect(report.failed).toBe(true)
      expect(printed(report)).toEqual(["err: keys:check FAIL  a key-shaped string is in:\nsrc/a.ts:2"])
    })
  )
})
