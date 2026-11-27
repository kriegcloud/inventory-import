import * as P from "effect/Predicate"
import { dual } from "effect/Function"
import { describe, it } from "@effect/vitest"
import { assertNone, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"
import {
  baselineFile,
  defaults,
  type DefaultsExemption,
  defaultsSentence,
  exemptions
} from "../src/commands/Laws/Defaults.rules.ts"
import { readDefaults, whatIsCounted } from "../src/commands/Laws/internal/defaultsCode.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, onMain, printed, type Tree } from "./support/tree.ts"
import * as R from "effect/Record"

const places = (source: string, file = "a.tsx") =>
  A.map(readDefaults({ file, source }).found, (place) => `${place.line} ${place.kind} ${place.code}`)

// git answers "every file git would commit", "what the file held when it was committed" and "what main's baseline
// says", so the folder is made a repository whose main holds what the test wrote, and `after` is written on a branch.
const run = Effect.fn("run")(function* (
  write: boolean,
  only: ReadonlyArray<string> = [],
  after: Tree = {},
  exempt: ReadonlyArray<DefaultsExemption> = []
) {
  const repo = yield* Repo
  yield* onMain()
  yield* Effect.forEach(R.toEntries(after), ([file, text]) => repo.write(repo.join(repo.root, file), text), {
    concurrency: 1,
    discard: true
  })
  const found = yield* defaults(write, only, exempt)
  return printed(render(defaultsSentence)(found))
})

const baseline = (
  files: Readonly<Record<string, ReadonlyArray<number>>>,
  reads: ReadonlyArray<string> = whatIsCounted
) => json({ counts: ["fallback", "absence", "unwrap", "normalise"], reads, files })

const held = "packages/a/src/held.ts"
const twoFallbacks = `export const a = (x?: number, y?: number) => (x ?? 0) + (y ?? 0)\n`

describe("what the reader takes for a place", () => {
  it("leaves strict undefined comparisons on a component's own props out, retaining other absence", () => {
    deepStrictEqual(
      places(`function Card(props: { title?: string }) {
  return <b>{props.title === undefined ? "" : props.title}</b>
}
const Line = ({ title: caption, size = "sm" }: Props) =>
  <b>{undefined !== caption ? caption : size}</b>
const Other = (props: Props) => <b>{props.title ?? ""}{props.title === null}{other === undefined}</b>
const helper = (props: Props) => props.title === undefined
const Nested = (props: Props) => <b>{[1].map(() => props.title === undefined)}</b>
const Shadowed = (props: Props) => <b>{[1].map((props) => props.title === undefined)}</b>
const UppercaseHelper = (props: Props) => props.title === undefined`),
      [
        '6 fallback props.title ?? ""',
        "6 absence props.title === null",
        "6 absence other === undefined",
        "7 absence props.title === undefined",
        "9 absence props.title === undefined",
        "10 absence props.title === undefined"
      ]
    )
    // A static computed key reads a prop as a dotted one does; a key held in a name does not.
    deepStrictEqual(
      places(`const Card = (props: Props) =>
  <b>{props["aria-label"] === undefined ? "" : props[key] === undefined}</b>`),
      ["2 absence props[key] === undefined"]
    )
    // A factory that returns a renderer draws nothing itself.
    deepStrictEqual(
      places(`function MakeRenderer(options: Options) {
  const missing = options.title === undefined
  return () => <b>{missing}</b>
}`),
      ["2 absence options.title === undefined"]
    )
    // A catch clause or a loop that binds the name again reads its own value, not the prop.
    deepStrictEqual(
      places(`const Card = (props: Props) => {
  try { run() } catch (props) { inspect(props.title === undefined) }
  for (const props of list) inspect(props.title === undefined)
  for (let props = first; props.title === undefined; ) inspect(props)
  return <b>{props.title === undefined}</b>
}`),
      [
        "2 absence props.title === undefined",
        "3 absence props.title === undefined",
        "4 absence props.title === undefined"
      ]
    )
    deepStrictEqual(places(`const Card = (props: Props) => props.title === undefined`, "a.ts"), [
      "1 absence props.title === undefined"
    ])
  })

  it("counts an Option's valueOrUndefined as the unwrap it is", () => {
    deepStrictEqual(places(`export const f = (o: O.Option<string>) => Result.getSuccess(o).valueOrUndefined`), [
      "1 unwrap Result.getSuccess(o).valueOrUndefined"
    ])
  })

  it("finds each kind by how it is written", () => {
    deepStrictEqual(
      places(`export const f = (o: unknown, x?: string | null) => {
  let y = x ?? "d"
  y ??= "e"
  if (x === undefined || null != x || (x as string)! == null) return 1
  if (typeof x === "undefined") return 2
  const z = x.trim().toLowerCase() + Str.toUpperCase(x) + pipe(x, Str.trim)
  return [O.getOrUndefined(o), O.getOrNull(o), <b title={x ?? "t"}>{y}</b>]
}
export const g = (o: O.Option<string>, s: string, t: Array<string>) => {
  let u = s || "none"
  u ||= \`n\${s}\`
  return [O.getOrElse(o, () => ""), pipe(o, O.getOrElse(() => u)), t || [], (s || ({}))]
}`),
      [
        '2 fallback x ?? "d"',
        '3 fallback y ??= "e"',
        "4 absence x === undefined",
        "4 absence null != x",
        "4 absence (x as string)! == null",
        '5 absence typeof x === "undefined"',
        "6 normalise x.trim().toLowerCase",
        "6 normalise x.trim",
        "6 normalise Str.toUpperCase",
        "6 normalise Str.trim",
        "7 unwrap O.getOrUndefined",
        "7 unwrap O.getOrNull",
        '7 fallback x ?? "t"',
        '10 fallback s || "none"',
        "11 fallback u ||= `n${s}`",
        "12 fallback O.getOrElse",
        "12 fallback O.getOrElse",
        "12 fallback t || []",
        "12 fallback s || ({})"
      ]
    )
  })

  it("takes nothing from a comment, a string, a pattern, a type or a schema's own clean-up", () => {
    deepStrictEqual(
      places(`// a ?? b, and c === undefined
const s = "x ?? y === null"
const re = /null ?? undefined/
export const Sku = S.String.pipe(S.decodeTo(S.Trimmed, SchemaTransformation.trim()))
export const upper = SchemaGetter.toUpperCase()
export const f = (x: string | undefined, n: number | null): x is string => n !== 0 && x !== ""
export const either = (a: boolean, b: boolean, n = 0, { m = 1 } = {}) => (a || b || n > m ? a : b)
`),
      []
    )
  })

  it("takes a default given to a parameter or a destructured name, but not in a .tsx file", () => {
    const source = `export const f = (n = 0, { m = 1 } = {}) => {
  const { k = "a" } = { k: undefined }
  return [n, m, k]
}`
    deepStrictEqual(places(source, "a.ts"), [
      "1 fallback n = 0",
      "1 fallback { m = 1 } = {}",
      "1 fallback m = 1",
      '2 fallback k = "a"'
    ])
    deepStrictEqual(places(source, "a.tsx"), [])
  })

  it("counts Option, Result and Exit guards only in a test's if or ternary condition", () => {
    const source = `if (O.isSome(x)) expect(x.value).toBe(1)
if (!O.isNone(x) && ready) expect(x.value).toBe(1)
const a = Result.isSuccess(x) ? x.success : 0
if (Result.isFailure(x)) expect(x.failure).toBe(1)
if (Exit.isSuccess(x)) expect(x.value).toBe(1)
const b = Exit.isFailure(x) ? 0 : 1
const c = O.isSome(x)
expect(O.isNone(x)).toBe(true)
if (other.isSuccess(x)) expect(x).toBe(1)
if (ready) O.isSome(x)
const callback = () => O.isSome(x)
while (O.isSome(x)) break`
    const expected = [
      "1 absence O.isSome(x)",
      "2 absence O.isNone(x)",
      "3 absence Result.isSuccess(x)",
      "4 absence Result.isFailure(x)",
      "5 absence Exit.isSuccess(x)",
      "6 absence Exit.isFailure(x)"
    ]
    deepStrictEqual(places(source, "packages/a/model/test/A.test.ts"), expected)
    deepStrictEqual(places(source, "apps/a/test/helper.tsx"), expected)
    deepStrictEqual(places(source, "packages/a/src/A.spec.ts"), expected)
    deepStrictEqual(places(source, "packages/a/model/src/a.ts"), [])
  })

  it("counts only literal expression arrows named onNone in contract, model or host", () => {
    const source = `const a = { onNone: () => 0 }
const b = { onNone: () => "" }
const c = { "onNone": () => [] }
const d = { onNone: () => ({}) }
const e = { onNone: () => true }
const f = { onNone: () => false }
const g = { onNone: () => null }
const h = { onNone: () => undefined }
const i = { onNone: () => -1 }
const j = { onNone: () => value, onSome: () => 0 }
const k = { onNone: () => makeValue() }
const l = { onNone: () => { return 0 } }
const m = { onNone: function() { return 0 } }
const n = { onNone: () => /pattern/ }
const o = { onNone: () => \`text\` }
const p = { onNone: async () => 0 }
const q = { onNone: () => [compute()] }
const r = { onNone: () => ({ value: compute() }) }
const s = { onNone: (value) => 0 }
const t = { onNone: () => [1] }
const u = { onNone: () => "the file" }
const v = { onNone: () => +2 }
const w = { onNone: () => 1.5 }
const x = { onNone: () => 1n }
const y = { onNone: () => \`\` }
const z = { onNone: () => ({ value: 1 }) }`
    for (const layer of ["contract", "model", "host"])
      deepStrictEqual(places(source, `packages/a/${layer}/src/a.ts`), [
        "1 fallback onNone: () => 0",
        '2 fallback onNone: () => ""',
        '3 fallback "onNone": () => []',
        "4 fallback onNone: () => ({})",
        "7 fallback onNone: () => null",
        "8 fallback onNone: () => undefined",
        "9 fallback onNone: () => -1",
        "22 fallback onNone: () => +2",
        "23 fallback onNone: () => 1.5"
      ])
    for (const file of [
      "packages/a/web/src/a.ts",
      "packages/a/src/model/a.ts",
      "apps/a/model/a.ts",
      "packages/a/modelish/src/a.ts"
    ])
      deepStrictEqual(places(source, file), [])
  })

  it("counts exact Result.getOrThrow and Effect.runSync member calls only in src outside tests", () => {
    const source = `const a = Result.getOrThrow(result)
const b = Effect.runSync(effect)
const c = result.pipe(Result.getOrThrow)
const d = effect.pipe(Effect.runSync)
const e = pipe(result, Result.getOrThrow)
const f = pipe(effect, Effect.runSync)
const g = Result.getOrThrow
const h = Effect.runSync
Other.getOrThrow(result)
Other.runSync(effect)
R.getOrThrow(result)
E.runSync(effect)
Result["getOrThrow"](result)
Effect["runSync"](effect)
getOrThrow(result)
runSync(effect)
// Result.getOrThrow(result), Effect.runSync(effect)
const text = "Result.getOrThrow(result), Effect.runSync(effect)"
const i = O.getOrThrow(option)
const j = option.pipe(O.getOrThrow)`
    const counted = [
      "1 fallback Result.getOrThrow(result)",
      "2 fallback Effect.runSync(effect)",
      "3 fallback Result.getOrThrow",
      "4 fallback Effect.runSync",
      "5 fallback Result.getOrThrow",
      "6 fallback Effect.runSync",
      "19 fallback O.getOrThrow(option)",
      "20 fallback O.getOrThrow"
    ]
    for (const file of [
      "src/a.ts",
      "apps/a/src/a.tsx",
      "packages/a/src/a.ts",
      "packages/a/web/src/a.tsx",
      "packages/a/contract/src/a.ts",
      "packages/a/model/src/a.ts",
      "packages/a/host/src/a.ts"
    ])
      deepStrictEqual(places(source, file), counted)
    for (const file of [
      "a.ts",
      "packages/a/test/a.ts",
      "packages/a/tests/a.ts",
      "packages/a/src/a.test.ts",
      "packages/a/src/a.spec.tsx",
      "packages/a/src/test/helper.ts",
      "packages/a/src/tests/helper.ts"
    ])
      deepStrictEqual(places(source, file), [])
  })

  it("follows only the optionalKey's own schema chain when looking for an absence wrapper", () => {
    const source = `const a = S.optionalKey(S.String)
const b = S.String.pipe(S.optionalKey).annotateKey({ description: "b" })
const c = S.optionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeed("")))
const d = S.Struct({ x: S.optionalKey(S.String), y: S.String.pipe(S.withDecodingDefaultKey(Effect.succeed(""))) })
const e = S.Struct({ x: S.optionalKey(S.String) }).pipe(S.withDecodingDefaultKey(Effect.succeed({})))
const f = S.optionalKey(S.String).pipe(S.withDecodingDefaultTypeKey(Effect.succeed("")))
const g = S.String.pipe(S.optionalKey, S.withDecodingDefaultKey(Effect.succeed("")))
const h = S.OptionFromOptionalKey(S.String)
const i = S.OptionFromNullOr(S.optionalKey(S.String))
const j = absentAsNone(S.optionalKey(S.String))
const k = S.optionalKey(S.String).pipe(absentAsNone({ description: "k" }))
const l = emptyWhenLeftOut(S.optionalKey(S.String), noValue)
const m = pipe(S.optionalKey(S.String), S.withDecodingDefaultKey(Effect.succeed("")))
const n = S.optionalKey(S.String).annotateKey({ description: "n" }).pipe(S.OptionFromOptionalKey)
const storedFlag = S.optionalKey(StoredFlag).pipe(
  S.decodeTo(StoredFlagRead, {
    decode: SchemaGetter.withDefault(Effect.succeed("undecided")),
    encode: SchemaGetter.transformOptional(O.filter(isStoredFlag))
  }),
  S.withConstructorDefault(Effect.succeed("undecided"))
)
const o = S.optionalKey(S.String).pipe(S.decodeTo(Read, { encode: SchemaGetter.withDefault(Effect.succeed("")) }))
const p = S.optionalKey(S.String).pipe(S.decodeTo(Read, { decode: SchemaGetter.transform(read) }))
const q = S.optionalKey(S.String).pipe(S.check(() => S.withDecodingDefaultKey(Effect.succeed(""))))`
    deepStrictEqual(places(source, "packages/catalog/contract/src/a.ts"), [
      "1 absence S.optionalKey",
      "2 absence S.optionalKey",
      "3 absence S.optionalKey",
      "4 absence S.optionalKey",
      "5 absence S.optionalKey",
      "22 absence S.optionalKey",
      "23 absence S.optionalKey",
      "24 absence S.optionalKey"
    ])
    deepStrictEqual(places(source, "packages/catalog/web/src/a.ts"), [])
  })

  it("says why a file was not read", () => {
    assertNone(readDefaults({ file: "a.ts", source: "export const a = 1" }).unread)
    const broken = readDefaults({ file: "a.ts", source: "export const = (x ?? 1" })
    strictEqual(broken.found.length, 0)
    strictEqual(O.isSome(broken.unread), true)
  })
})

describe("the baseline", () => {
  it.effect("a file may hold what its baseline names, and a file with fewer is said without failing", () =>
    Effect.gen(function* () {
      const said = yield* inTree(
        { [held]: `export const a = (x?: number) => x ?? 0\n`, [baselineFile]: baseline({ [held]: [2, 0, 0, 0] }) },
        run(false)
      )
      deepStrictEqual(said, [
        "out: defaults:check OK  1 files hold to the baseline (still held: 1 fallback, 0 absence, 0 unwrap, 0 normalise)",
        "out: 1 files hold fewer places than their baseline: bun run beep laws defaults --write lowers it"
      ])
    })
  )

  it.effect("a file the baseline does not name may hold none, and the place is said with what to write", () =>
    Effect.gen(function* () {
      const said = yield* inTree(
        {
          "packages/a/src/new.ts": `export const a = (x: string) =>\n  x.trim()\n`,
          [baselineFile]: baseline({})
        },
        run(false)
      )
      strictEqual(said.length, 3)
      strictEqual(
        A.some(said, (line) => line === "err:   packages/a/src/new.ts:2  x.trim"),
        true
      )
      strictEqual(
        A.some(said, (line) => Str.startsWith("err: packages/a/src/new.ts  holds 1 normalise, and may hold 0")(line)),
        true
      )
    })
  )

  it.effect("over its baseline, a file is told the place its committed version does not have", () =>
    Effect.gen(function* () {
      const said = yield* inTree(
        { [held]: twoFallbacks, [baselineFile]: baseline({ [held]: [2, 0, 0, 0] }) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* repo.run("git", ["init", "-q"])
          yield* repo.run("git", ["add", "."])
          yield* repo.run("git", [
            "-c",
            "user.name=t",
            "-c",
            "user.email=t@t",
            "-c",
            "commit.gpgsign=false",
            "commit",
            "-qm",
            "first"
          ])
          // A line is put above, so both old places move, and a third place is written.
          yield* repo.write(
            repo.join(repo.root, held),
            `export const b = 1\n${twoFallbacks}export const c = (z?: string) => z ?? ""\n`
          )
          const found = yield* defaults(false, [held], [])
          return printed(render(defaultsSentence)(found))
        })
      )
      strictEqual(said.length, 3)
      strictEqual(
        A.some(said, (line) => line === `err:   ${held}:3  z ?? ""`),
        true
      )
      strictEqual(
        A.some(said, (line) => Str.startsWith(`err: ${held}  holds 3 fallback, and may hold 2`)(line)),
        true
      )
    })
  )

  it.effect("a test is told the asserts that narrow", () =>
    Effect.gen(function* () {
      const said = yield* inTree(
        {
          "packages/a/test/A.test.ts": `export const a = (x?: number) => x === undefined\n`,
          [baselineFile]: baseline({})
        },
        run(false)
      )
      strictEqual(
        A.some(said, (line) => Str.includes("assertSome, assertNone or assertDefined from @effect/vitest/utils")(line)),
        true
      )
    })
  )

  it.effect("the vendored kit, the tooling and files that are not named are left alone", () =>
    Effect.gen(function* () {
      const said = yield* inTree(
        {
          "packages/kit/vendor.json": "{}",
          "packages/kit/src/k.ts": twoFallbacks,
          "packages/tooling/cli/src/t.ts": twoFallbacks,
          "packages/ui/src/components/c.tsx": twoFallbacks,
          "packages/a/src/other.ts": twoFallbacks,
          "packages/a/src/clean.ts": `export const a = 1\n`,
          [baselineFile]: baseline({})
        },
        run(false, ["packages/a/src/clean.ts", "packages/kit/src/k.ts"])
      )
      deepStrictEqual(said, [
        "out: defaults:check OK  1 files hold to the baseline (still held: 0 fallback, 0 absence, 0 unwrap, 0 normalise)"
      ])
    })
  )
})

describe("new places still only fall", () => {
  it.effect("records the fuller reader once, refuses growth for every addition, and permits reductions", () =>
    Effect.gen(function* () {
      const optional = "packages/a/contract/src/Optional.ts"
      const fallback = "packages/a/model/src/Fallback.ts"
      const guard = "packages/a/host/test/Guard.test.ts"
      const calls = "packages/a/src/Calls.ts"
      const sources = {
        [optional]: "const a = S.optionalKey(S.String)\n",
        [fallback]: "const a = { onNone: () => 0 }\n",
        [guard]: "if (Exit.isFailure(x)) expect(x).toBe(1)\n",
        [calls]: "const a = [Result.getOrThrow(result), effect.pipe(Effect.runSync)]\n"
      }
      const said = yield* inTree(
        { ...sources, [baselineFile]: baseline({}, ["??"]) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          const wrote = yield* defaults(true, [], [])
          const initial = yield* defaults(false, [], [])
          const grew = yield* Effect.forEach(
            R.toEntries(sources),
            ([file, source]) =>
              Effect.gen(function* () {
                yield* repo.write(repo.join(repo.root, file), source + Str.replace("const a", "const b")(source))
                const refused = yield* defaults(true, [], [])
                yield* repo.write(repo.join(repo.root, file), source)
                return printed(render(defaultsSentence)(refused))
              }),
            { concurrency: 1 }
          )
          yield* Effect.forEach(R.keys(sources), (file) => repo.write(repo.join(repo.root, file), "const a = 1\n"), {
            concurrency: 1
          })
          const lowered = yield* defaults(true, [], [])
          const final = yield* defaults(false, [], [])
          return { wrote, initial, grew, lowered, final }
        })
      )
      deepStrictEqual(printed(render(defaultsSentence)(said.wrote)), [
        "out: defaults:check OK  defaults-baseline.json lowered: it names 4 files"
      ])
      deepStrictEqual(printed(render(defaultsSentence)(said.initial)), [
        "out: defaults:check OK  4 files hold to the baseline (still held: 3 fallback, 2 absence, 0 unwrap, 0 normalise)"
      ])
      for (const refused of said.grew)
        strictEqual(
          A.some(refused, (line) => Str.startsWith("err: defaults:check FAIL")(line)),
          true
        )
      deepStrictEqual(printed(render(defaultsSentence)(said.lowered)), [
        "out: defaults:check OK  defaults-baseline.json lowered: it names 0 files"
      ])
      deepStrictEqual(printed(render(defaultsSentence)(said.final)), [
        "out: defaults:check OK  4 files hold to the baseline (still held: 0 fallback, 0 absence, 0 unwrap, 0 normalise)"
      ])
    })
  )
})

describe("the exemptions", () => {
  it.effect("exempts only Spreadsheet absence, keeping its other kinds and other files counted", () =>
    Effect.gen(function* () {
      const spreadsheet = "packages/catalog/model/src/Reading/Spreadsheet.rules.ts"
      const sibling = "packages/catalog/model/src/Reading/Other.rules.ts"
      const absence = `export const Cell = S.Struct({ shown: S.optionalKey(S.String), formula: S.optionalKey(S.String) })\n`
      const exempt = A.filter(exemptions, (one) => one.file === spreadsheet)
      strictEqual(exempt.length, 1)
      deepStrictEqual(
        A.flatMap(exempt, (one) => one.kinds),
        ["absence"]
      )
      const clean = yield* inTree({ [spreadsheet]: absence, [baselineFile]: baseline({}) }, run(false, [], {}, exempt))
      deepStrictEqual(clean, [
        "out: defaults:check OK  1 files hold to the baseline (still held: 0 fallback, 0 absence, 0 unwrap, 0 normalise)"
      ])
      const said = yield* inTree(
        { [spreadsheet]: absence, [baselineFile]: baseline({}) },
        run(
          false,
          [],
          {
            [spreadsheet]: absence + `export const read = (x) => [x ?? "", O.getOrNull(x), x.trim()]\n`,
            [sibling]: absence
          },
          exempt
        )
      )
      for (const kind of ["fallback", "unwrap", "normalise"])
        strictEqual(
          A.some(said, (line) => Str.startsWith(`err: ${spreadsheet}  holds 1 ${kind}, and may hold 0`)(line)),
          true
        )
      strictEqual(
        A.some(said, (line) => Str.startsWith(`err: ${sibling}  holds 2 absence, and may hold 0`)(line)),
        true
      )
    })
  )

  const reader = "packages/a/src/CellReading.rules.ts"
  const tree = {
    [reader]: `export const read = (cell: string) => cell.trim() ?? ""\n`,
    "packages/a/src/other.ts": `export const a = 1\n`,
    [baselineFile]: baseline({ [reader]: [1, 0, 0, 0] })
  }
  const exempt = [{ file: reader, kinds: ["normalise" as const], why: "a cell's reader" }]

  it.effect("a file named keeps the kinds named and no other, and the same code elsewhere is refused", () =>
    Effect.gen(function* () {
      const named = yield* inTree(tree, run(false, [], {}, exempt))
      deepStrictEqual(named, [
        "out: defaults:check OK  2 files hold to the baseline (still held: 1 fallback, 0 absence, 0 unwrap, 0 normalise)"
      ])
      const elsewhere = yield* inTree(
        tree,
        run(false, [], { "packages/a/src/other.ts": `export const a = (x: string) => x.trim()\n` }, exempt)
      )
      strictEqual(
        A.some(elsewhere, (line) =>
          Str.startsWith("err: packages/a/src/other.ts  holds 1 normalise, and may hold 0")(line)
        ),
        true
      )
      const unnamed = yield* inTree(tree, run(false))
      strictEqual(
        A.some(unnamed, (line) => Str.startsWith(`err: ${reader}  holds 1 normalise, and may hold 0`)(line)),
        true
      )
    })
  )

  it.effect(
    "an exemption for a file that is not there fails the run over the tree, and not one over a named file",
    () =>
      Effect.gen(function* () {
        const gone = [{ file: "packages/a/src/gone.ts", kinds: ["normalise" as const], why: "was a reader" }]
        const said = yield* inTree(tree, run(false, [], {}, [...exempt, ...gone]))
        deepStrictEqual(said, [
          `err: defaults:check FAIL  ${baselineFile}, or what the law reads, does not hold:`,
          "err: packages/a/src/gone.ts  is named in the law's exemptions but is not a file the law reads: take it off the list (Defaults.rules.ts)"
        ])
        // Deleted and not staged: git's index still lists the file, and the exemption is an orphan all the same.
        const deleted = yield* inTree(
          tree,
          Effect.gen(function* () {
            const repo = yield* Repo
            yield* onMain()
            yield* repo.run("rm", [reader], { cwd: repo.root })
            const found = yield* defaults(true, [], exempt)
            return printed(render(defaultsSentence)(found))
          })
        )
        strictEqual(
          A.some(deleted, (line) => Str.startsWith(`err: ${reader}  is named in the law's exemptions`)(line)),
          true
        )
        const oneFile = yield* inTree(tree, run(false, ["packages/a/src/other.ts"], {}, gone))
        deepStrictEqual(oneFile, [
          "out: defaults:check OK  1 files hold to the baseline (still held: 0 fallback, 0 absence, 0 unwrap, 0 normalise)"
        ])
      })
  )
})

describe("against main", () => {
  it.effect("refuses a count raised above main's, and a file main's baseline does not name; follows a rename", () =>
    Effect.gen(function* () {
      const start = { [held]: twoFallbacks, [baselineFile]: baseline({ [held]: [2, 0, 0, 0] }) }
      const three = `${twoFallbacks}export const c = (z?: string) => z ?? ""\n`
      // The same commit raises the file's places and its count: main still holds it at 2.
      const raised = yield* inTree(
        start,
        run(false, [], { [held]: three, [baselineFile]: baseline({ [held]: [3, 0, 0, 0] }) })
      )
      deepStrictEqual(raised, [
        // A count raised beside the code is code that breaks the rule: the code's heading, not the baseline's alone.
        "err: defaults:check FAIL  code that settles absence, a starting value or a clean-up by itself. A schema settles it, where the value enters (docs/standards/schema-first.md):",
        `err: ${held}  is held at [3, 0, 0, 0] in ${baselineFile}, above the [2, 0, 0, 0] main holds it to: a number only falls`
      ])
      const added = "packages/a/src/added.ts"
      const grew = yield* inTree(
        start,
        run(false, [], {
          [added]: twoFallbacks,
          [baselineFile]: baseline({ [held]: [2, 0, 0, 0], [added]: [2, 0, 0, 0] })
        })
      )
      strictEqual(
        A.some(
          grew,
          (line) =>
            line ===
            `err: ${added}  is in ${baselineFile} but not on main: a baseline only loses files. Fix the file instead`
        ),
        true
      )
      const moved = "packages/a/src/moved.ts"
      const renamed = yield* inTree(
        start,
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["mv", held, moved])
          yield* repo.write(repo.join(repo.root, baselineFile), baseline({ [moved]: [2, 0, 0, 0] }))
          const found = yield* defaults(false, [], [])
          return printed(render(defaultsSentence)(found))
        })
      )
      // A line for a file that is gone would hand its allowance to the next file at that path.
      const gone = "packages/a/src/gone.ts"
      const left = yield* inTree(
        start,
        run(false, [], { [baselineFile]: baseline({ [held]: [2, 0, 0, 0], [gone]: [1, 0, 0, 0] }) })
      )
      strictEqual(
        A.some(
          left,
          (line) =>
            line ===
            `err: ${gone}  is in ${baselineFile} but the law reads no file at that path (deleted, ignored or out of its reach): take its line off (bun run beep laws defaults --write), so a new file at its path inherits nothing`
        ),
        true
      )
      // A file moved with `git mv` and its line not yet moved: the check names the fix, and `--write` makes it.
      const before = yield* inTree(
        start,
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["mv", held, moved])
          const checkFound = yield* defaults(false, [], [])
          const check = printed(render(defaultsSentence)(checkFound))
          const wroteFound = yield* defaults(true, [], [])
          const wrote = printed(render(defaultsSentence)(wroteFound))
          const afterFound = yield* defaults(false, [], [])
          const after = printed(render(defaultsSentence)(afterFound))
          const stored = yield* repo.text(repo.join(repo.root, baselineFile))
          return { check, wrote, after, stored }
        })
      )
      deepStrictEqual(before.check, [
        `err: defaults:check FAIL  ${baselineFile}, or what the law reads, does not hold:`,
        `err: ${held}  is in ${baselineFile} but was renamed to ${moved}: bun run beep laws defaults --write moves its line`
      ])
      deepStrictEqual(before.wrote, ["out: defaults:check OK  defaults-baseline.json lowered: it names 1 files"])
      strictEqual(Str.includes(`"${moved}": [2, 0, 0, 0]`)(before.stored), true)
      deepStrictEqual(before.after, [
        "out: defaults:check OK  1 files hold to the baseline (still held: 2 fallback, 0 absence, 0 unwrap, 0 normalise)"
      ])
      // Moved out of what the law reads (a declaration file), its line is only taken off: `--write` moves nothing.
      const declared = yield* inTree(
        start,
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["mv", held, "packages/a/src/held.d.ts"])
          const found = yield* defaults(false, [], [])
          return printed(render(defaultsSentence)(found))
        })
      )
      strictEqual(
        A.contains(
          declared,
          `err: ${held}  is in ${baselineFile} but the law reads no file at that path (deleted, ignored or out of its reach): take its line off (bun run beep laws defaults --write), so a new file at its path inherits nothing`
        ),
        true
      )
      // A new file at the old name keeps the line, so the moved file does not borrow it too.
      const both = yield* inTree(
        start,
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["mv", held, moved])
          yield* repo.write(repo.join(repo.root, held), twoFallbacks)
          const found = yield* defaults(false, [], [])
          return printed(render(defaultsSentence)(found))
        })
      )
      strictEqual(
        A.some(both, (line) => Str.startsWith(`err: ${moved}  holds 2 fallback, and may hold 0`)(line)),
        true
      )
      // Nor does the baseline lend it twice: a line for the moved file beside the old name's is new to main, whether the
      // move and the new file are still in the tree (git sees a rename, and the law names the move) or committed (git
      // sees a change of the old file and a new one).
      const twice = (committed: boolean) =>
        inTree(
          start,
          Effect.gen(function* () {
            const repo = yield* Repo
            yield* onMain()
            yield* repo.run("git", ["mv", held, moved])
            yield* repo.write(repo.join(repo.root, held), twoFallbacks)
            yield* repo.write(
              repo.join(repo.root, baselineFile),
              baseline({ [held]: [2, 0, 0, 0], [moved]: [2, 0, 0, 0] })
            )
            if (committed) {
              yield* repo.run("git", ["add", "--all"])
              yield* repo.run("git", [
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.test",
                "-c",
                "commit.gpgsign=false",
                "commit",
                "-q",
                "-m",
                "moves it, and writes a new file at its name"
              ])
            }
            const found = yield* defaults(false, [], [])
            return printed(render(defaultsSentence)(found))
          })
        )
      const notTwice = `err: ${moved}  is in ${baselineFile} but not on main:`
      const inTheTree = yield* twice(false)
      const committedBoth = yield* twice(true)
      strictEqual(
        A.contains(
          inTheTree,
          `${notTwice} it was moved from ${held}, and a file is at ${held} again, which keeps what main held there, so this one starts from nothing. Fix the file instead`
        ),
        true
      )
      strictEqual(A.contains(committedBoth, `${notTwice} a baseline only loses files. Fix the file instead`), true)
      deepStrictEqual(renamed, [
        "out: defaults:check OK  1 files hold to the baseline (still held: 2 fallback, 0 absence, 0 unwrap, 0 normalise)"
      ])
    })
  )
})

describe("--write", () => {
  it.effect("records the tree when there is no baseline yet, then only lowers", () =>
    Effect.gen(function* () {
      const said = yield* inTree(
        { [held]: twoFallbacks, "packages/a/src/clean.ts": `export const a = 1\n` },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          const firstFound = yield* defaults(true, [], [])
          const first = printed(render(defaultsSentence)(firstFound))
          const stored = yield* repo.text(repo.join(repo.root, baselineFile))
          yield* repo.write(repo.join(repo.root, held), `export const a = (x?: number) => x ?? 0\n`)
          const loweredFound = yield* defaults(true, [], [])
          const lowered = printed(render(defaultsSentence)(loweredFound))
          const after = yield* repo.text(repo.join(repo.root, baselineFile))
          yield* repo.write(repo.join(repo.root, held), `${twoFallbacks}export const c = (z?: string) => z ?? ""\n`)
          const raisedFound = yield* defaults(true, [], [])
          const raised = printed(render(defaultsSentence)(raisedFound))
          const kept = yield* repo.text(repo.join(repo.root, baselineFile))
          return { first, stored, lowered, after, raised, kept }
        })
      )
      deepStrictEqual(said.first, ["out: defaults:check OK  defaults-baseline.json lowered: it names 1 files"])
      strictEqual(
        said.stored,
        `{\n  "counts": ["fallback", "absence", "unwrap", "normalise"],\n  "reads": [\n    ${A.join(
          A.map(whatIsCounted, (one) => `"${one}"`),
          ",\n    "
        )}\n  ],\n  "files": {\n    "${held}": [2, 0, 0, 0]\n  }\n}\n`
      )
      strictEqual(Str.includes(`"${held}": [1, 0, 0, 0]`)(said.after), true)
      strictEqual(
        A.some(said.raised, (line) => Str.startsWith("err: defaults:check FAIL")(line)),
        true
      )
      strictEqual(said.kept, said.after)
    })
  )

  it.effect(
    "a baseline written before the reader counted more is said, written anew, and not held to the old one",
    () =>
      Effect.gen(function* () {
        // Main's baseline was written when only \`??\` was counted: one place. The reader counts two here.
        const older = ["??"]
        const source = `export const a = (x?: number, y?: string) => [x ?? 0, y || ""]\n`
        const said = yield* inTree(
          { [held]: source, [baselineFile]: baseline({ [held]: [1, 0, 0, 0] }, older) },
          Effect.gen(function* () {
            const repo = yield* Repo
            yield* onMain()
            const beforeFound = yield* defaults(false, [], [])
            const before = printed(render(defaultsSentence)(beforeFound))
            const wroteFound = yield* defaults(true, [], [])
            const wrote = printed(render(defaultsSentence)(wroteFound))
            const stored = yield* repo.text(repo.join(repo.root, baselineFile))
            const afterFound = yield* defaults(false, [], [])
            const after = printed(render(defaultsSentence)(afterFound))
            return { before, wrote, stored, after }
          })
        )
        strictEqual(
          A.some(said.before, (line) =>
            Str.startsWith(`err: ${baselineFile} was written before the law counted what it counts now`)(line)
          ),
          true
        )
        deepStrictEqual(said.wrote, ["out: defaults:check OK  defaults-baseline.json lowered: it names 1 files"])
        strictEqual(Str.includes(`"${held}": [2, 0, 0, 0]`)(said.stored), true)
        // Main still holds the file at 1, of fewer things: the count of 2 is not refused as raised.
        deepStrictEqual(said.after, [
          "out: defaults:check OK  1 files hold to the baseline (still held: 2 fallback, 0 absence, 0 unwrap, 0 normalise)"
        ])
      })
  )

  it.effect("takes no file", () =>
    Effect.gen(function* () {
      const said = yield* inTree({ [held]: twoFallbacks }, run(true, [held]))
      strictEqual(said.length, 1)
      strictEqual(
        A.some(said, (line) => Str.startsWith("err: --write lowers the baseline for the whole tree")(line)),
        true
      )
    })
  )
})

describe("main's baseline written for a reader that counted less", () => {
  // Main's baseline was written when only `??` was counted. Its numbers are of fewer things, so each line is held to
  // what this reader finds in the file as it stood on main.
  const older = ["??"]

  it.effect("passes code nobody changed, and refuses a place written since", () =>
    Effect.gen(function* () {
      const widened = yield* inTree(
        { [held]: twoFallbacks, [baselineFile]: baseline({}, older) },
        run(false, [], { [baselineFile]: baseline({ [held]: [2, 0, 0, 0] }) })
      )
      deepStrictEqual(widened, [
        "out: defaults:check OK  1 files hold to the baseline (still held: 2 fallback, 0 absence, 0 unwrap, 0 normalise)"
      ])
      const three = `${twoFallbacks}export const c = (z?: string) => z ?? ""
`
      const written = yield* inTree(
        { [held]: twoFallbacks, [baselineFile]: baseline({}, older) },
        run(false, [], { [held]: three, [baselineFile]: baseline({ [held]: [3, 0, 0, 0] }) })
      )
      strictEqual(
        A.contains(
          written,
          `err: ${held}  is held at [3, 0, 0, 0] in ${baselineFile}, above the [2, 0, 0, 0] this reader finds in it on main (main's baseline counts less, so the file is held to its code there): a number only falls`
        ),
        true
      )
    })
  )

  it.effect("holds each kind to its own count there, not to the larger of main's line and the code", () =>
    Effect.gen(function* () {
      // Main's line allows 2 fallbacks; the code there holds 1 fallback and 1 absence. The file now holds 2 and 1: each
      // kind is above one of the two, so a larger-of-both per kind would let a place written since through.
      const there = `export const a = (x?: number, y?: number) => [x ?? 0, y === undefined]
`
      const now = `export const a = (x?: number, y?: number) => [x ?? 0, y === undefined, x ?? 1]
`
      const said = yield* inTree(
        { [held]: there, [baselineFile]: baseline({ [held]: [2, 0, 0, 0] }, older) },
        run(false, [], { [held]: now, [baselineFile]: baseline({ [held]: [2, 1, 0, 0] }) })
      )
      strictEqual(
        A.some(said, (line) =>
          Str.startsWith(`err: ${held}  is held at [2, 1, 0, 0] in ${baselineFile}, above the [1, 1, 0, 0]`)(line)
        ),
        true
      )
    })
  )

  it.effect("credits a moved file from its old name's code", () =>
    Effect.gen(function* () {
      const moved = "packages/a/src/moved.ts"
      const said = yield* inTree(
        { [held]: twoFallbacks, [baselineFile]: baseline({ [held]: [1, 0, 0, 0] }, older) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["mv", held, moved])
          yield* repo.write(repo.join(repo.root, baselineFile), baseline({ [moved]: [2, 0, 0, 0] }))
          const found = yield* defaults(false, [], [])
          return printed(render(defaultsSentence)(found))
        })
      )
      deepStrictEqual(said, [
        "out: defaults:check OK  1 files hold to the baseline (still held: 2 fallback, 0 absence, 0 unwrap, 0 normalise)"
      ])
    })
  )

  it.effect("gives no credit to a file the law did not read there (a registry component moved into its reach)", () =>
    Effect.gen(function* () {
      const registry = "packages/ui/src/components/tour.tsx"
      const moved = "packages/ui/src/tour-moved.tsx"
      const said = yield* inTree(
        { [registry]: twoFallbacks, [baselineFile]: baseline({}, older) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["mv", registry, moved])
          yield* repo.write(repo.join(repo.root, baselineFile), baseline({ [moved]: [2, 0, 0, 0] }))
          const found = yield* defaults(false, [], [])
          return printed(render(defaultsSentence)(found))
        })
      )
      strictEqual(
        A.contains(
          said,
          `err: ${moved}  is in ${baselineFile} but not on main: a baseline only loses files. Fix the file instead`
        ),
        true
      )
    })
  )

  it.effect("refuses to compare when git cannot list the files there, rather than reading an empty list", () =>
    Effect.gen(function* () {
      const said = yield* inTree(
        { [held]: twoFallbacks, [baselineFile]: baseline({}, older) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.write(repo.join(repo.root, baselineFile), baseline({ [held]: [2, 0, 0, 0] }))
          // git answers a code other than 0 when it could not list them: a list it could not give, never an empty one.
          const failing = Repo.of({
            ...repo,
            run: dual(
              (args) => P.isString(args[0]),
              (
                self: Parameters<Repo["Service"]["run"]>[0],
                args: Parameters<Repo["Service"]["run"]>[1],
                options?: Parameters<Repo["Service"]["run"]>[2]
              ) => {
                const perform = Effect.fn("failingGrep")(function* (
                  command: Parameters<Repo["Service"]["run"]>[0],
                  args: Parameters<Repo["Service"]["run"]>[1],
                  options: Parameters<Repo["Service"]["run"]>[2]
                ) {
                  if (A.contains(args, "--no-renames"))
                    return { bytes: new Uint8Array(), stdout: "", stderr: "diff broke\n", code: 2 }
                  return yield* repo.run(command, args, options)
                })
                return perform(self, args, options)
              }
            )
          })
          const found = yield* Effect.provideService(defaults(false, [], []), Repo, failing)
          return printed(render(defaultsSentence)(found))
        })
      )
      strictEqual(
        A.contains(
          said,
          `err: ${baselineFile} could not be compared with main: git could not list the files at the base (diff broke)`
        ),
        true
      )
    })
  )
})

describe("what git lists", () => {
  // A path git would quote (a letter outside ASCII) is read only when git is asked for its lists split by NUL.
  const quoted = "packages/a/src/café.ts"

  it.effect("reads a file whose name git quotes", () =>
    Effect.gen(function* () {
      const said = yield* inTree({ [baselineFile]: baseline({}) }, run(false, [], { [quoted]: twoFallbacks }))
      strictEqual(
        A.some(said, (line) => Str.startsWith(`err: ${quoted}  holds 2 fallback, and may hold 0`)(line)),
        true
      )
    })
  )

  it.effect("credits a file whose name git quotes from main's code, whatever colour git is told to print in", () =>
    Effect.gen(function* () {
      const said = yield* inTree(
        { [quoted]: twoFallbacks, [baselineFile]: baseline({}, ["??"]) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["config", "color.ui", "always"])
          yield* repo.write(repo.join(repo.root, baselineFile), baseline({ [quoted]: [2, 0, 0, 0] }))
          const found = yield* defaults(false, [], [])
          return printed(render(defaultsSentence)(found))
        })
      )
      deepStrictEqual(said, [
        "out: defaults:check OK  1 files hold to the baseline (still held: 2 fallback, 0 absence, 0 unwrap, 0 normalise)"
      ])
    })
  )

  it.effect("takes an empty vendor.json at the base as a kit the law did not read", () =>
    Effect.gen(function* () {
      const kept = "packages/k/src/kept.ts"
      const said = yield* inTree(
        { "packages/k/vendor.json": "", [kept]: twoFallbacks, [baselineFile]: baseline({}, ["??"]) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          // The folder stops being a kit: its code comes into the law's reach, and owes what it holds.
          yield* repo.run("git", ["rm", "-q", "packages/k/vendor.json"])
          yield* repo.write(repo.join(repo.root, baselineFile), baseline({ [kept]: [2, 0, 0, 0] }))
          const found = yield* defaults(false, [], [])
          return printed(render(defaultsSentence)(found))
        })
      )
      strictEqual(
        A.contains(
          said,
          `err: ${kept}  is in ${baselineFile} but not on main: a baseline only loses files. Fix the file instead`
        ),
        true
      )
    })
  )

  it.effect("takes a line off for a file git ignores, as CI would, though one is on the disk", () =>
    Effect.gen(function* () {
      const stray = "packages/a/src/stray.ts"
      const said = yield* inTree(
        { [held]: twoFallbacks, [baselineFile]: baseline({ [held]: [2, 0, 0, 0], [stray]: [1, 0, 0, 0] }) },
        run(false, [], { ".gitignore": `${stray}\n`, [stray]: `export const a = (x?: number) => x ?? 0\n` })
      )
      strictEqual(
        A.contains(
          said,
          `err: ${stray}  is in ${baselineFile} but the law reads no file at that path (deleted, ignored or out of its reach): take its line off (bun run beep laws defaults --write), so a new file at its path inherits nothing`
        ),
        true
      )
    })
  )

  it.effect("names the move when a moved file is over because a file is at its old name again", () =>
    Effect.gen(function* () {
      const moved = "packages/a/src/moved.ts"
      const said = yield* inTree(
        { [held]: twoFallbacks, [baselineFile]: baseline({ [held]: [2, 0, 0, 0] }) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["mv", held, moved])
          yield* repo.write(repo.join(repo.root, held), twoFallbacks)
          const found = yield* defaults(false, [], [])
          return printed(render(defaultsSentence)(found))
        })
      )
      strictEqual(
        A.contains(
          said,
          `err: ${moved}  was moved from ${held}, and a file is at ${held} again, which keeps that name's line, so this one may hold none`
        ),
        true
      )
      strictEqual(
        A.some(said, (line) => Str.startsWith(`err: ${moved}  holds 2 fallback, and may hold 0`)(line)),
        true
      )
    })
  )
})

describe("what git says of a move, and when it cannot say", () => {
  const moved = "packages/a/src/moved.ts"

  it.effect("follows a rename from a name git quotes", () =>
    Effect.gen(function* () {
      const quoted = "packages/a/src/café.ts"
      const said = yield* inTree(
        { [quoted]: twoFallbacks, [baselineFile]: baseline({ [quoted]: [2, 0, 0, 0] }) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["mv", quoted, moved])
          yield* repo.write(repo.join(repo.root, baselineFile), baseline({ [moved]: [2, 0, 0, 0] }))
          const found = yield* defaults(false, [], [])
          return printed(render(defaultsSentence)(found))
        })
      )
      deepStrictEqual(said, [
        "out: defaults:check OK  1 files hold to the baseline (still held: 2 fallback, 0 absence, 0 unwrap, 0 normalise)"
      ])
    })
  )

  it.effect("does not blame the move for a moved file over a line of its own", () =>
    Effect.gen(function* () {
      const three = `${twoFallbacks}export const c = (z?: string) => z ?? ""\n`
      const said = yield* inTree(
        { [held]: twoFallbacks, [baselineFile]: baseline({ [held]: [2, 0, 0, 0] }) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["mv", held, moved])
          yield* repo.write(repo.join(repo.root, held), twoFallbacks)
          yield* repo.write(repo.join(repo.root, moved), three)
          yield* repo.write(
            repo.join(repo.root, baselineFile),
            baseline({ [held]: [2, 0, 0, 0], [moved]: [2, 0, 0, 0] })
          )
          const found = yield* defaults(false, [], [])
          return printed(render(defaultsSentence)(found))
        })
      )
      strictEqual(
        A.some(said, (line) => Str.startsWith(`err: ${moved}  holds 3 fallback, and may hold 2`)(line)),
        true
      )
      strictEqual(
        A.some(said, (line) => Str.startsWith(`err: ${moved}  was moved from`)(line)),
        false
      )
    })
  )

  it.effect("refuses to compare when git cannot make the empty tree the base's files are listed from", () =>
    Effect.gen(function* () {
      const said = yield* inTree(
        { [held]: twoFallbacks, [baselineFile]: baseline({}, ["??"]) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.write(repo.join(repo.root, baselineFile), baseline({ [held]: [2, 0, 0, 0] }))
          const failing = Repo.of({
            ...repo,
            run: dual(
              (args) => P.isString(args[0]),
              (
                self: Parameters<Repo["Service"]["run"]>[0],
                args: Parameters<Repo["Service"]["run"]>[1],
                options?: Parameters<Repo["Service"]["run"]>[2]
              ) => {
                const perform = Effect.fn("failingHash")(function* (
                  command: Parameters<Repo["Service"]["run"]>[0],
                  args: Parameters<Repo["Service"]["run"]>[1],
                  options: Parameters<Repo["Service"]["run"]>[2]
                ) {
                  if (A.contains(args, "hash-object"))
                    return { bytes: new Uint8Array(), stdout: "", stderr: "hash broke\n", code: 128 }
                  return yield* repo.run(command, args, options)
                })
                return perform(self, args, options)
              }
            )
          })
          const found = yield* Effect.provideService(defaults(false, [], []), Repo, failing)
          return printed(render(defaultsSentence)(found))
        })
      )
      strictEqual(
        A.contains(
          said,
          `err: ${baselineFile} could not be compared with main: git could not list the files at the base (hash broke)`
        ),
        true
      )
    })
  )
})

describe("when git cannot list today's files", () => {
  it.effect("says what git said, trimmed, and checks nothing", () =>
    Effect.gen(function* () {
      const said = yield* inTree(
        { [held]: twoFallbacks, [baselineFile]: baseline({ [held]: [2, 0, 0, 0] }) },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          const failing = Repo.of({
            ...repo,
            run: dual(
              (args) => P.isString(args[0]),
              (
                self: Parameters<Repo["Service"]["run"]>[0],
                args: Parameters<Repo["Service"]["run"]>[1],
                options?: Parameters<Repo["Service"]["run"]>[2]
              ) => {
                const perform = Effect.fn("failingList")(function* (
                  command: Parameters<Repo["Service"]["run"]>[0],
                  args: Parameters<Repo["Service"]["run"]>[1],
                  options: Parameters<Repo["Service"]["run"]>[2]
                ) {
                  if (A.contains(args, "ls-files"))
                    return { bytes: new Uint8Array(), stdout: "", stderr: "ls broke\n", code: 128 }
                  return yield* repo.run(command, args, options)
                })
                return perform(self, args, options)
              }
            )
          })
          const found = yield* Effect.provideService(defaults(false, [], []), Repo, failing)
          return printed(render(defaultsSentence)(found))
        })
      )
      deepStrictEqual(said, [
        `err: defaults:check FAIL  ${baselineFile}, or what the law reads, does not hold:`,
        "err: git could not list the files, so none was checked: ls broke"
      ])
    })
  )
})
