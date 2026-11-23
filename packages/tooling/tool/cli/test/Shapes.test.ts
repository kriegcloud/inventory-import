// The two shape laws: a declared helper that takes the value it acts on last is refused, and so is a property that is
// not readonly, outside another library's augmented types; each list only shrinks.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { listedLaw, listedSentence, readListed } from "../src/commands/Laws/internal/listed.ts"
import { helpersNotDual, mutableProperties } from "../src/commands/Laws/internal/shapesCode.ts"
import {
  dualHelpers,
  dualSentence,
  dualSpec,
  readonlyProperties,
  readonlySentence,
  readonlySpec
} from "../src/commands/Laws/Shapes.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, onMain, printed } from "./support/tree.ts"

const lines = (source: string, offsets: typeof helpersNotDual) => readListed({ file: "a.tsx", source }, offsets).found

const helpers = `import { dual } from "effect/Function"
export const refusal = (method: string, key: string, cause: unknown) => [method, key, cause]
function problemOf(name: string, error: Error) { return [name, error] }
export const issue = (cause: unknown, method: string) => [cause, method]
export const one = (input: string) => input
export const both = dual(2, (self: string, that: string) => self + that)
export const handed = [1, 2].map((value, input) => value + input)
`

const wider = `export type I = { [key: string]: number }
export class C { count = 0; readonly fixed = 1 }
export type M = { [K in "a" | "b"]: number }
export type N = { readonly [K in "a"]: number }
export type R = { readonly rows: Row[]; readonly kept: ReadonlyArray<Row>; readonly lists: Array<number> }
export const local: Array<number> = []
declare namespace Ours { interface X { y: number } }
type Row = { readonly n: number }
`

const shapes = `export type A = { a: number; readonly b: string }
export interface B { c: boolean; readonly d: number; nested: { readonly e: 1; f: 2 } }
export const g = (props: { readonly h: string }) => props.h
declare global { interface Window { mutable: string } }
declare module "some-library" { interface Options { set: boolean } }
`

// The law, in a repository whose main holds what `inTree` wrote, with an empty ledger for each law unless the tree has
// its own.
const inRepository = Effect.fn("inRepository")(function* (law: typeof dualHelpers, sentence: typeof dualSentence) {
  const repo = yield* Repo
  for (const ledger of [dualSpec.ledger, readonlySpec.ledger]) {
    if (!(yield* repo.exists(repo.join(repo.root, ledger)))) yield* repo.write(repo.join(repo.root, ledger), json({}))
  }
  yield* onMain()
  const found = yield* law
  return printed(render(sentence)(found))
})

describe("laws dual and readonly", () => {
  it("reads a declared helper that takes its subject last, and nothing else", () => {
    expect(lines(helpers, helpersNotDual)).toEqual([2, 3, 4])
  })

  it("reads a property that is not readonly, and not one in another library's augmented types", () => {
    // Each place is said: line 2 holds three (c, nested and f).
    expect(lines(shapes, mutableProperties)).toEqual([1, 2, 2, 2])
    // An index signature, a class's field, a mapped type, a mutable array in a property, and a namespace of our own;
    // not a local list a function fills.
    expect(lines(wider, mutableProperties)).toEqual([1, 2, 3, 5, 5, 7])
    // A mutable array behind an alias, a mutable tuple, globalThis.Array, a parameter property and an abstract field;
    // a readonly tuple, a readonly parameter property, an accessor (which cannot be readonly) and a tuple in a
    // conditional type's test pass.
    const more = `export type Rows = number[]
export type Pair = { readonly p: [number, string]; readonly q: readonly [number, string] }
export type G = { readonly g: globalThis.Array<number> }
export class D { constructor(private n: number, private readonly m: number) {} }
export class E { accessor f = 1 }
export abstract class F { abstract h: number }
export type IsNever<T> = [T] extends [never] ? true : false
`
    expect(lines(more, mutableProperties)).toEqual([1, 2, 3, 4, 6])
  })

  it("reads Effect.fn helpers and dual's own order; not a library's methods, a typed const or a this parameter", () => {
    const more = `import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
export const told = Effect.fn("told")(function* (method: string, cause: unknown) { return [method, cause] })
export const object = { refusal(method: string, error: Error) { return [method, error] } }
export class G { refusal(method: string, cause: unknown) { return [method, cause] } }
export const wrong = dual(2, (that: string, self: string) => that + self)
export const right = dual(2, (self: string, that: string) => self + that)
export function bound(this: Window, input: string) { return input }
export const reducer: (state: number, input: number) => number = (state, input) => state + input
`
    // The object's and the class's methods, and the typed const, have an order a library's type sets.
    expect(lines(more, helpersNotDual)).toEqual([3, 6])
    // A dual typed as the house writes one is read for its order; so are an arrow under satisfies and an unnamed
    // Effect.fn.
    const typed = `import { dual } from "effect/Function"
import * as Effect from "effect/Effect"
export const a: { (x: number): (self: string) => string; (that: number, self: string): string } = dual(2, (that: number, self: string) => self + that)
export const b = ((n: number, cause: unknown) => [n, cause]) satisfies (n: number, c: unknown) => unknown
export const c = Effect.fn(function* (n: number, self: string) { return self })
export const d: { (that: number): (self: string) => string; (self: string, that: number): string } = dual(2, (self: string, that: number) => self + that)
`
    expect(lines(typed, helpersNotDual)).toEqual([3, 4, 5])
    // Another object's fn is a library's callback; a dual over Effect.fn is read for its order.
    const libraries = `import { dual } from "effect/Function"
import * as Effect from "effect/Effect"
export const a = Atom.fn((input: string, get: unknown) => input)
export const b = dual(2, Effect.fn("b")(function* (that: number, self: string) { return self }))
export const c = vi.fn((n: number, cause: unknown) => cause)
`
    expect(lines(libraries, helpersNotDual)).toEqual([4])
  })

  it.effect("refuses each place in a file no list names, and holds a listed file at its number of places", () =>
    Effect.gen(function* () {
      const said = yield* inTree({ "packages/x/src/a.ts": helpers }, inRepository(dualHelpers, dualSentence))
      expect(said).toContain(`err: packages/x/src/a.ts:2  ${dualSpec.instead}`)
      // A spec of the readonly law with a ledger of its own: one file held at two places.
      const listed = "packages/x/src/listed.ts"
      const spec = { ...readonlySpec, ledger: "packages/x/ledger.json" }
      const law = listedLaw(spec)
      const sentence = listedSentence(spec)
      const mutable = (count: number) =>
        A.join(
          A.makeBy(count, (i) => `export type A${i} = { a: number }\n`),
          ""
        )
      const got1 = yield* inTree(
        { "packages/x/ledger.json": json({ [listed]: 2 }), [listed]: mutable(2) },
        inRepository(law, sentence)
      )

      expect(got1).toEqual([expect.stringContaining("out: readonly:check OK")])
      const got2 = yield* inTree(
        { "packages/x/ledger.json": json({ [listed]: 2 }), [listed]: mutable(3) },
        inRepository(law, sentence)
      )

      expect(got2).toContain(
        `err: ${listed}  breaks the rule in 3 places, more than the 2 packages/x/ledger.json holds it to: a listed file may only lose places. Fix the new ones`
      )
      const got3 = yield* inTree(
        { "packages/x/ledger.json": json({ [listed]: 2 }), [listed]: mutable(1) },
        inRepository(law, sentence)
      )

      expect(got3).toContain(
        `err: ${listed}  breaks the rule in 1 places, fewer than the 2 packages/x/ledger.json holds it to: lower its number to 1`
      )
      const got4 = yield* inTree(
        { "packages/x/ledger.json": json({ [listed]: 2 }), [listed]: "export type A = { readonly a: 1 }\n" },
        inRepository(law, sentence)
      )

      expect(got4).toContain(
        `err: ${listed}  is listed in packages/x/ledger.json but breaks the rule no more: take its line off`
      )
      // The ui package's components are read; only code another check holds to its source is not: the files a kit
      // manifest hashes. Its local files are read.
      const read = yield* inTree(
        {
          "packages/ui/src/hooks/use-x.ts": shapes,
          "vendor/a.ts": shapes,
          "packages/foundation/modeling/utils/vendor.json": json({
            files: [{ path: "src/a.ts", sha256: "0" }],
            local: ["test/support/fc.ts"]
          }),
          "packages/foundation/modeling/utils/src/a.ts": shapes,
          "packages/foundation/modeling/utils/test/support/fc.ts": shapes
        },
        inRepository(readonlyProperties, readonlySentence)
      )
      expect(read).toContain("err: packages/ui/src/hooks/use-x.ts:1  " + readonlySpec.instead)
      expect(
        A.filter(
          read,
          (line) =>
            Str.startsWith("err: vendor/")(line) || Str.startsWith("err: packages/foundation/modeling/utils/src/")(line)
        )
      ).toEqual([])
      expect(read).toContain("err: packages/foundation/modeling/utils/test/support/fc.ts:1  " + readonlySpec.instead)
    })
  )
})
