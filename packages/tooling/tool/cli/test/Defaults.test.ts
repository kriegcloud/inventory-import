import { describe, it } from "@effect/vitest"
import { assertNone, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"
import { baselineFile, defaults, defaultsSentence } from "../src/commands/Laws/Defaults.rules.ts"
import { readDefaults } from "../src/commands/Laws/internal/defaultsCode.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, onMain, printed, type Tree } from "./support/tree.ts"
import * as R from "effect/Record"

const places = (source: string, file = "a.tsx") =>
  A.map(readDefaults({ file, source }).found, (place) => `${place.line} ${place.kind} ${place.code}`)

// git answers "every file git would commit", "what the file held when it was committed" and "what main's baseline
// says", so the folder is made a repository whose main holds what the test wrote, and `after` is written on a branch.
const run = Effect.fn("run")(function* (write: boolean, only: ReadonlyArray<string> = [], after: Tree = {}) {
  const repo = yield* Repo
  yield* onMain()
  yield* Effect.forEach(R.toEntries(after), ([file, text]) => repo.write(repo.join(repo.root, file), text), {
    concurrency: 1,
    discard: true
  })
  const found = yield* defaults(write, only)
  return printed(render(defaultsSentence)(found))
})

const baseline = (files: Readonly<Record<string, ReadonlyArray<number>>>) =>
  json({ counts: ["fallback", "absence", "unwrap", "normalise"], files })

const held = "packages/a/src/held.ts"
const twoFallbacks = `export const a = (x?: number, y?: number) => (x ?? 0) + (y ?? 0)\n`

describe("what the reader takes for a place", () => {
  it("finds each kind by how it is written", () => {
    deepStrictEqual(
      places(`export const f = (o: unknown, x?: string | null) => {
  let y = x ?? "d"
  y ??= "e"
  if (x === undefined || null != x || (x as string)! == null) return 1
  if (typeof x === "undefined") return 2
  const z = x.trim().toLowerCase() + Str.toUpperCase(x) + pipe(x, Str.trim)
  return [O.getOrUndefined(o), O.getOrNull(o), <b title={x ?? "t"}>{y}</b>]
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
        '7 fallback x ?? "t"'
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
`),
      []
    )
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
          yield* repo.run("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "first"])
          // A line is put above, so both old places move, and a third place is written.
          yield* repo.write(
            repo.join(repo.root, held),
            `export const b = 1\n${twoFallbacks}export const c = (z?: string) => z ?? ""\n`
          )
          const found = yield* defaults(false, [held])
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
        `err: defaults:check FAIL  ${baselineFile}, or what the law reads, does not hold:`,
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
          const found = yield* defaults(false, [])
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
            `err: ${gone}  is in ${baselineFile} but is not there: take its line off (bun run beep laws defaults --write), so a new file at its path inherits nothing`
        ),
        true
      )
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
          const firstFound = yield* defaults(true, [])
          const first = printed(render(defaultsSentence)(firstFound))
          const stored = yield* repo.text(repo.join(repo.root, baselineFile))
          yield* repo.write(repo.join(repo.root, held), `export const a = (x?: number) => x ?? 0\n`)
          const loweredFound = yield* defaults(true, [])
          const lowered = printed(render(defaultsSentence)(loweredFound))
          const after = yield* repo.text(repo.join(repo.root, baselineFile))
          yield* repo.write(repo.join(repo.root, held), `${twoFallbacks}export const c = (z?: string) => z ?? ""\n`)
          const raisedFound = yield* defaults(true, [])
          const raised = printed(render(defaultsSentence)(raisedFound))
          const kept = yield* repo.text(repo.join(repo.root, baselineFile))
          return { first, stored, lowered, after, raised, kept }
        })
      )
      deepStrictEqual(said.first, ["out: defaults:check OK  defaults-baseline.json lowered: it names 1 files"])
      strictEqual(
        said.stored,
        `{\n  "counts": ["fallback", "absence", "unwrap", "normalise"],\n  "files": {\n    "${held}": [2, 0, 0, 0]\n  }\n}\n`
      )
      strictEqual(Str.includes(`"${held}": [1, 0, 0, 0]`)(said.after), true)
      strictEqual(
        A.some(said.raised, (line) => Str.startsWith("err: defaults:check FAIL")(line)),
        true
      )
      strictEqual(said.kept, said.after)
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
