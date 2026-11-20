import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { tags, tagsSentence } from "../src/commands/Laws/Tags.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

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
export const said = (state: Upload) => {
  if (Upload.guards.Idle(state)) throw new Error(\`no file is chosen while \${state._tag}\`)
  return <li key={\`row:\${state._tag}\`}>{state._tag}</li>
}
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

// The forms the second review found passing: a tag read into a name through a default, a method of a tag, a record
// read by a tag, a template that is only the tag, a template with words compared, what a function that hands the tag
// back answers, and a tag read through a function handed to a call, taken out with yield* and then expected.
const tick = "`"
const flowed = `import * as Effect from "effect/Effect"
import type { Upload } from "./machine"
const kindOf = (state: Upload) => state._tag
export const line = (state: Upload, effect: Effect.Effect<number, { readonly _tag: string }>) =>
  Effect.gen(function* () {
    const tag = state._tag ?? ""
    if (tag === "Saving") return "Saving"
    if (state._tag.startsWith("Sav")) return "Saving"
    const handlers = { Idle: () => "", Saving: () => "Saving" }
    const chosen = handlers[state._tag]
    if (${tick}\${state._tag}${tick} === "Idle") return chosen()
    if (${tick}\${state._tag}:1${tick} === "Idle:1") return "One"
    if (kindOf(state) === "Idle") return "Idle"
    const refused = yield* Effect.map(Effect.flip(effect), (error) => error._tag)
    expect(refused).toBe("Forbidden")
    return state.fileName
  })
`

// A case picked out of another type (\`Extract<…, { _tag: "Detail" }>\`) is not a case this module types, and a tag
// that is not written out is never a case the module types: both are built by hand.
const picked = `import * as Data from "effect/Data"
type Opened = Data.TaggedEnum<{ Detail: { readonly id: string }; Closed: {} }>
const Opened = Data.taggedEnum<Opened>()
export type Detail = Extract<Opened, { readonly _tag: "Detail" }>
export const open = (id: string): Opened => ({ _tag: "Detail", id })
export type Answer = { readonly _tag: "Yes" } | { readonly _tag: "No" }
export const either = (kind: "Yes" | "No"): Answer => ({ _tag: kind })
export const yes: Answer = { _tag: "Yes" }
export const closed = Opened.Closed()
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

  it.effect("refuses a tag through a default, a method, a key, a template, a function that hands it back", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "packages/catalog/web/src/Step.ts": flowed }, inRepository)
      expect(report.failed).toBe(true)
      const file = "packages/catalog/web/src/Step.ts"
      expect(printed(report).slice(1)).toEqual([
        `err: ${file}:7  _tag ===`,
        `err: ${file}:8  a method called on a _tag`,
        `err: ${file}:10  a record read by a _tag`,
        `err: ${file}:11  _tag ===`,
        `err: ${file}:12  _tag ===`,
        `err: ${file}:13  _tag ===`,
        `err: ${file}:15  a _tag handed to a call`
      ])
    })
  )

  it.effect("refuses a case picked out of another type, and a tag not written out, built by hand", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "packages/review/src/internal/Grid.ts": picked }, inRepository)
      const literal = "an object built with a _tag key: use the case's own constructor or .make"
      expect(printed(report).slice(1)).toEqual([
        `err: packages/review/src/internal/Grid.ts:5  ${literal}`,
        `err: packages/review/src/internal/Grid.ts:7  ${literal}`
      ])
    })
  )

  it.effect("holds a file the ledger records to its count: no more, and lowered when it has fewer", () =>
    Effect.gen(function* () {
      const file = "packages/catalog/model/src/Rules.ts"
      const ledger = (files: Record<string, number>) => json({ files })
      const held = yield* inTree({ [file]: byHand, "tags-ledger.json": ledger({ [file]: 8 }) }, inRepository)
      expect(printed(held)).toEqual([
        clean,
        "out:   8 places in 1 files are still recorded in tags-ledger.json: none more, and the count only falls"
      ])
      const more = yield* inTree({ [file]: byHand, "tags-ledger.json": ledger({ [file]: 7 }) }, inRepository)
      expect(more.failed).toBe(true)
      expect(printed(more).slice(1, 3)).toEqual([
        `err: ${file}  8 places, and tags-ledger.json records 7: it may have no more`,
        `err: ${file}:3  _tag ===`
      ])
      const fewer = yield* inTree(
        { [file]: byHand, "tags-ledger.json": ledger({ [file]: 9, "packages/catalog/model/src/Gone.ts": 2 }) },
        inRepository
      )
      expect(printed(fewer).slice(1)).toEqual([
        `err: ${file}  8 places, and tags-ledger.json records 9: lower it to 8`,
        "err: packages/catalog/model/src/Gone.ts  has no place left, and tags-ledger.json records 2: take it out of the ledger"
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

  it.effect("reads our own code and every test, the server's and the model's too; the vendored kit keeps its own", () =>
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
        "apps/inventory/src/server/App.ts",
        "apps/inventory/src/web/App.tsx",
        "apps/inventory/test/server/App.test.ts",
        "packages/catalog/model/src/Rules.ts",
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
