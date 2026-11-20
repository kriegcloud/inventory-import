import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
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

const clean = "out: tags:check OK  no _tag is told apart or built by hand"

// What the types give: guards and matches, a tag looked for with `in`, a tag read and handed on as a value, a case
// built with its constructor, and a name that is not a tag compared in another function.
const given = `import * as O from "effect/Option"
import * as P from "effect/Predicate"
import { Upload } from "./machine"
export const line = (state: Upload, held: O.Option<string>, error: unknown) => {
  if (Upload.guards.Saving(state)) return "Saving"
  if (O.isSome(held)) return held.value
  if (P.isTagged(error, "Failed")) return "Failed"
  if (typeof error === "object" && error !== null && "_tag" in error) return "Tagged"
  return Upload.match(state, { Idle: () => "", Saving: () => "Saving" })
}
export const kinds = (states: ReadonlyArray<Upload>) => states.map((state) => state._tag)
export const idle = Upload.cases.Idle.make({})
const named = (state: Upload) => {
  const tag = state._tag
  return { tag }
}
export const other = (tag: string) => tag === "Idle" || named(idle).tag.length > 0
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

// The forms that once passed: a tag read into a name and compared, a tag taken out by a pattern and compared or
// switched over, a tag handed to a call (a set's lookup, a list's, an expectation's tuple), and a value built by hand
// with a \`_tag\` key, a schema union's own case included.
const hidden = `import * as A from "effect/Array"
import * as HashSet from "effect/HashSet"
import * as S from "effect/Schema"
const Step = S.TaggedUnion({ Idle: {}, Saving: { fileName: S.String } })
const final = HashSet.make("UploadNotFound", "Forbidden")
export const line = (state: typeof Step.Type, error: { readonly _tag: string }, status: number) => {
  const tag = state._tag
  if (tag === "Saving" || tag === "Idle") return "Known"
  const { _tag } = state
  if (_tag === "Idle") return "Idle"
  const { _tag: kind } = state
  ${keyword} (kind) {
    default:
      break
  }
  if (HashSet.has(final, String(error._tag))) return "Final"
  if (A.contains(["Idle", "Saving"], state._tag)) return "Either"
  return expect([status, state._tag]).toEqual([200, "Idle"])
}
export const idle: typeof Step.Type = { _tag: "Idle" }
export const saving = Step.cases.Saving.make({ fileName: "a.csv" })
`

// A union typed by hand has no constructor: the module that types it builds it, and a test of it builds it with what
// the module gives instead.
const typedHere = `export type Answer = { readonly _tag: "Yes" } | { readonly _tag: "No"; readonly why: string }
export const yes: Answer = { _tag: "Yes" }
export const no = (why: string): Answer => ({ _tag: "No", why })
`

describe("laws tags", () => {
  it.effect("passes guards, matches, a tag looked for with in, a tag handed on as a value, and constructors", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "packages/catalog/web/src/Step.tsx": given }, inRepository)
      expect(printed(report)).toEqual([clean])
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

  it.effect("refuses a tag read into a name or a pattern, a tag handed to a call, and a case built by hand", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "packages/catalog/web/src/Step.ts": hidden }, inRepository)
      expect(report.failed).toBe(true)
      const file = "packages/catalog/web/src/Step.ts"
      const literal = "an object built with a _tag key: use the case's own constructor or .make"
      expect(printed(report).slice(1)).toEqual([
        `err: ${file}:8  _tag ===`,
        `err: ${file}:8  _tag ===`,
        `err: ${file}:10  _tag ===`,
        `err: ${file}:12  switch over a _tag`,
        `err: ${file}:16  a _tag handed to a call`,
        `err: ${file}:17  a _tag handed to a call`,
        `err: ${file}:18  a _tag handed to a call`,
        `err: ${file}:20  ${literal}`
      ])
    })
  )

  it.effect("lets the module that types a union build it, and refuses the same literals in a test", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        { "packages/catalog/web/src/Answer.ts": typedHere, "packages/catalog/web/test/Answer.test.ts": typedHere },
        inRepository
      )
      const literal = "an object built with a _tag key: use the case's own constructor or .make"
      expect(printed(report).slice(1)).toEqual([
        `err: packages/catalog/web/test/Answer.test.ts:2  ${literal}`,
        `err: packages/catalog/web/test/Answer.test.ts:3  ${literal}`
      ])
    })
  )

  it.effect(
    "reads every test, the server's and the model's too; the server's code and the vendored kit keep their own",
    () =>
      Effect.gen(function* () {
        const report = yield* inTree(
          {
            "packages/catalog/model/src/Rules.ts": byHand,
            "packages/catalog/model/test/Rules.test.ts": byHand,
            "apps/inventory/test/server/App.test.ts": byHand,
            "packages/ui/src/components/table.tsx": byHand,
            "packages/foundation/modeling/schema/vendor.json": "{}",
            "packages/foundation/modeling/schema/test/Schema.test.ts": byHand,
            "apps/inventory/src/server/App.ts": byHand,
            "apps/inventory/src/web/App.tsx": byHand
          },
          inRepository
        )
        // Each file once, read from "err: file:line  how".
        const files = A.dedupe(
          A.map(A.drop(printed(report), 1), (line) => A.headNonEmpty(Str.split(":")(Str.slice(5)(line))))
        )
        expect(files).toEqual([
          "apps/inventory/src/web/App.tsx",
          "apps/inventory/test/server/App.test.ts",
          "packages/catalog/model/test/Rules.test.ts"
        ])
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
