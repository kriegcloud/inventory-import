// The two shape laws: a declared helper that takes the value it acts on last is refused, and so is a property that is
// not readonly, outside another library's augmented types; each list only shrinks.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"
import { heldAs } from "../src/commands/Laws/internal/held.ts"
import { readListed } from "../src/commands/Laws/internal/listed.ts"
import { helpersSubjectLast, mutableProperties } from "../src/commands/Laws/internal/shapesCode.ts"
import {
  dualHelpers,
  dualListed,
  dualSentence,
  dualSpec,
  readonlyListed,
  readonlyProperties,
  readonlySentence,
  readonlySpec
} from "../src/commands/Laws/Shapes.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, printed } from "./support/tree.ts"

const lines = (source: string, offsets: typeof helpersSubjectLast) =>
  readListed({ file: "a.tsx", source }, offsets).found

const helpers = `import { dual } from "effect/Function"
export const refusal = (method: string, key: string, cause: unknown) => [method, key, cause]
function problemOf(name: string, error: Error) { return [name, error] }
export const issue = (cause: unknown, method: string) => [cause, method]
export const one = (input: string) => input
export const both = dual(2, (self: string, that: string) => self + that)
export const handed = [1, 2].map((value, input) => value + input)
`

const shapes = `export type A = { a: number; readonly b: string }
export interface B { c: boolean; readonly d: number; nested: { readonly e: 1; f: 2 } }
export const g = (props: { readonly h: string }) => props.h
declare global { interface Window { mutable: string } }
declare module "some-library" { interface Options { set: boolean } }
`

const inRepository = Effect.fn("inRepository")(function* (law: typeof dualHelpers, sentence: typeof dualSentence) {
  const repo = yield* Repo
  yield* repo.run("git", ["init", "-q"])
  const found = yield* law
  return printed(render(sentence)(found))
})

describe("laws dual and readonly", () => {
  it("reads a declared helper that takes its subject last, and nothing else", () => {
    expect(lines(helpers, helpersSubjectLast)).toEqual([2, 3])
  })

  it("reads a property that is not readonly, and not one in another library's augmented types", () => {
    expect(lines(shapes, mutableProperties)).toEqual([1, 2])
  })

  it.effect("refuses each place in a file no list names, and a listed file that breaks the rule no more", () =>
    Effect.gen(function* () {
      const said = yield* inTree({ "packages/x/src/a.ts": helpers }, inRepository(dualHelpers, dualSentence))
      expect(said).toContain(`err: packages/x/src/a.ts:2  ${dualSpec.instead}`)
      const listed = O.getOrElse(A.findFirst(readonlyListed, Str.endsWith(".ts")), () => "")
      const kept = yield* inTree({ [listed]: shapes }, inRepository(readonlyProperties, readonlySentence))
      expect(kept).toEqual([expect.stringContaining("out: readonly:check OK")])
      const clean = yield* inTree(
        { [listed]: "export type A = { readonly a: 1 }\n" },
        inRepository(readonlyProperties, readonlySentence)
      )
      expect(clean).toContain(
        `err: ${listed}  is listed in readonlyListed but breaks the rule no more: take its line off`
      )
      const vendored = yield* inTree(
        { "packages/ui/src/hooks/use-x.ts": shapes, "vendor/a.ts": shapes },
        inRepository(readonlyProperties, readonlySentence)
      )
      expect(vendored).toEqual([expect.stringContaining("out: readonly:check OK")])
    })
  )

  it("the lists only shrink: held by their contents and their lengths", () => {
    expect([dualListed.length, readonlyListed.length]).toEqual([4, 91])
    expect([heldAs(dualListed), heldAs(readonlyListed)]).toEqual([dualSpec.held, readonlySpec.held])
  })
})
