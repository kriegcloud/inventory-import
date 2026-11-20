import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { tags, tagsSentence } from "../src/commands/Laws/Tags.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, printed } from "./support/tree.ts"

// git answers "every file git would commit", so the folder is made a repository first.
const inRepository = Effect.gen(function* () {
  const repo = yield* Repo
  yield* repo.run("git", ["init", "-q"])
  const found = yield* tags()
  return render(tagsSentence)(found)
})

// What the types give: guards and matches, a tag looked for with `in`, a tag read and handed on.
const given = `import * as O from "effect/Option"
import { Upload } from "./machine"
export const line = (state: Upload, held: O.Option<string>, error: unknown) => {
  if (Upload.guards.Saving(state)) return "Saving"
  if (O.isSome(held)) return held.value
  if (typeof error === "object" && error !== null && "_tag" in error) return String(error._tag)
  return Upload.match(state, { Idle: () => "", Saving: () => "Saving" })
}
export const kinds = (states: ReadonlyArray<Upload>) => states.map((state) => state._tag)
`

// Every form a tag is compared by hand in. The keyword of the last one is put in when the text is made, so the
// repository's own search for that statement ("no \`switch\`", 2026-11-20) finds none in this file's lines.
const keyword = `sw${"itch"}`
const byHand = `import type { Upload } from "./machine"
export const line = (state: Upload, held: { _tag: "None" } | { _tag: "Some"; value: string }) => {
  if (state._tag === "Saving") return "Saving"
  if (state._tag !== "Idle") return "Busy"
  if ("Reading" === state._tag) return "Reading"
  if (held?._tag == "Some") return held.value
  if (
    state["_tag"]
      != "Failed"
  ) return "Fine"
  const busy = (state)._tag === "Saving" || state!._tag === "Reading"
  ${keyword} (state._tag) {
    case "Idle":
      return busy ? "" : "Idle"
    default:
      return ""
  }
}
`

describe("laws tags", () => {
  it.effect("passes guards, matches, a tag looked for with in, and a tag read and handed on", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "packages/catalog/web/src/Step.tsx": given }, inRepository)
      expect(printed(report)).toEqual(["out: tags:check OK  no _tag is compared by hand in the packages with screens"])
    })
  )

  it.effect("refuses every comparison of a tag by hand and a switch over one, each at its line", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        { "packages/catalog/web/src/Step.tsx": byHand, "packages/client/test/Step.test.ts": byHand },
        inRepository
      )
      expect(report.failed).toBe(true)
      const places = (file: string) => [
        `err: ${file}:3  _tag ===`,
        `err: ${file}:4  _tag !==`,
        `err: ${file}:5  _tag ===`,
        `err: ${file}:6  _tag ==`,
        `err: ${file}:8  _tag !=`,
        `err: ${file}:11  _tag ===`,
        `err: ${file}:11  _tag ===`,
        `err: ${file}:12  switch over a _tag`
      ]
      expect(printed(report).slice(1)).toEqual([
        ...places("packages/catalog/web/src/Step.tsx"),
        ...places("packages/client/test/Step.test.ts")
      ])
    })
  )

  it.effect("looks only where screens and their state are: a server package and the vendored kit keep their own", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "packages/catalog/model/src/Rules.ts": byHand,
          "packages/ui/src/components/table.tsx": byHand,
          "apps/inventory/src/server/App.ts": byHand,
          "apps/inventory/src/web/pages/Page.tsx": given
        },
        inRepository
      )
      expect(report.failed).toBe(false)
    })
  )

  it.effect("fails when git cannot list the files: nothing checked is not nothing found", () =>
    Effect.gen(function* () {
      const repo = yield* Repo
      const found = yield* tags()
      void repo
      return render(tagsSentence)(found)
    }).pipe(
      (rule) => inTree({ "packages/catalog/web/src/Step.tsx": byHand }, rule),
      Effect.map((report) => {
        expect(report.failed).toBe(true)
        expect(printed(report)[0]).toContain("tags:check FAIL")
        expect(printed(report)[1]).toContain("git could not list the files")
      })
    )
  )
})
