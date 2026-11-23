import { describe, it } from "@effect/vitest"
import { assertNone, deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"
import { baselineFile, defaults, defaultsSentence } from "../src/commands/Laws/Defaults.rules.ts"
import { readDefaults, whatIsCounted } from "../src/commands/Laws/internal/defaultsCode.ts"
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

const baseline = (
  files: Readonly<Record<string, ReadonlyArray<number>>>,
  reads: ReadonlyArray<string> = whatIsCounted
) => json({ counts: ["fallback", "absence", "unwrap", "normalise"], reads, files })

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
          const checkFound = yield* defaults(false, [])
          const check = printed(render(defaultsSentence)(checkFound))
          const wroteFound = yield* defaults(true, [])
          const wrote = printed(render(defaultsSentence)(wroteFound))
          const afterFound = yield* defaults(false, [])
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
          const found = yield* defaults(false, [])
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
          const found = yield* defaults(false, [])
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
            const found = yield* defaults(false, [])
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
            const beforeFound = yield* defaults(false, [])
            const before = printed(render(defaultsSentence)(beforeFound))
            const wroteFound = yield* defaults(true, [])
            const wrote = printed(render(defaultsSentence)(wroteFound))
            const stored = yield* repo.text(repo.join(repo.root, baselineFile))
            const afterFound = yield* defaults(false, [])
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
          const found = yield* defaults(false, [])
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
          const found = yield* defaults(false, [])
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
            run: Effect.fn("failingGrep")(function* (command, args, options) {
              if (A.contains(args, "--no-renames"))
                return { bytes: new Uint8Array(), stdout: "", stderr: "diff broke\n", code: 2 }
              return yield* repo.run(command, args, options)
            })
          })
          const found = yield* Effect.provideService(defaults(false, []), Repo, failing)
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
          const found = yield* defaults(false, [])
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
          const found = yield* defaults(false, [])
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
          const found = yield* defaults(false, [])
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
          const found = yield* defaults(false, [])
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
          const found = yield* defaults(false, [])
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
            run: Effect.fn("failingHash")(function* (command, args, options) {
              if (A.contains(args, "hash-object"))
                return { bytes: new Uint8Array(), stdout: "", stderr: "hash broke\n", code: 128 }
              return yield* repo.run(command, args, options)
            })
          })
          const found = yield* Effect.provideService(defaults(false, []), Repo, failing)
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
