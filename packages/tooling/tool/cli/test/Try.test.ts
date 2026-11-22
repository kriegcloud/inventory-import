import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { tryStatements, trySentence } from "../src/commands/Laws/Try.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

// git answers "every file git would commit", so the folder is made a repository first.
const inRepository = Effect.gen(function* () {
  const repo = yield* Repo
  yield* repo.run("git", ["init", "-q"])
  const found = yield* tryStatements()
  return render(trySentence)(found)
})

// The same, with `paths` tracked: added to git's index, as a committed file is.
const tracking = Effect.fn("tracking")(function* (paths: ReadonlyArray<string>) {
  const repo = yield* Repo
  yield* repo.run("git", ["init", "-q"])
  yield* repo.run("git", ["add", "--", ...paths])
  const found = yield* tryStatements()
  return render(trySentence)(found)
})

const notRead = ".agents/, scratchpad/ and apps/inventory/public/theme-init.js are not read"
const clean = `out: try:check OK  no try statement is written (${notRead})`
const refused = `err: try:check FAIL  a try statement is written. Write what each line says instead (${notRead}):`
const forCatch =
  "Effect.try or Effect.tryPromise with a catch that returns a typed error inside an Effect, Result.try or Option.liftThrowable outside one"
const forFinally = "Effect.ensuring or Effect.acquireUseRelease for the finally"
const caught = `a try statement with a catch: write ${forCatch}`
const finalised = `a try statement with a finally: write ${forFinally}`
const both = `a try statement with a catch and a finally: write ${forCatch}; ${forFinally}`
const inExample = `a try statement with a catch in a doc comment's example: show ${forCatch}`

/** A comment that turns rules off, put together here so this file holds none itself: the laws read it too. */
const off = (tool: "oxlint" | "eslint", scope: "" | "-next-line" | "-line", rules = "") =>
  Str.trim(`${tool}-disable${scope} ${rules}`)

// What replaces a try statement, and the word where it is no statement: a member's name, a key, a string, a
// comment, a function's name, and `Effect.try` in a doc comment's example, under a tag and in a fence.
const given = `import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Result from "effect/Result"

/**
 * Reads a number from the words.
 *
 * @example
 * const read = Effect.try({ try: () => JSON.parse("1"), catch: () => new Unreadable() })
 *
 * \`\`\`ts
 * const tried = Result.try({ try: () => JSON.parse("1"), catch: () => "unreadable" })
 * \`\`\`
 */
export const read = (words: string) =>
  Effect.try({ try: () => Number.parseFloat(words), catch: () => "unreadable" as const })
export const parsed = Result.try({ try: () => JSON.parse("1"), catch: () => "unreadable" as const })
export const lifted = O.liftThrowable(JSON.parse)
export const options = { try: 1, retry: "try { again }" }
// try { this } catch { never } is a comment
/* A block comment that is no doc comment is prose too:
 * @example
 * try { this() } catch {}
 */
export const tryThis = () => \`try { \${options.try} }\`
`

const forms = `export const caught = () => {
  try {
    return JSON.parse("1")
  } catch {
    return 0
  }
}
export const finalised = () => {
  try {
    return 1
  } finally {
    console.log("done")
  }
}
export const both = () => {
  try {
    return 1
  } catch (error) {
    return error
  } finally {
    console.log("done")
  }
}
export const nested = () => {
  try {
    try {
      return 1
    } catch {}
  } catch {}
}
export class Reader {
  read() {
    try { return 1 } catch { return 0 }
  }
}
export const arrow = () => { try { return 1 } catch { return 0 } }
`

const script = `const start = () => {
  try {
    run()
  } catch (error) {
    console.error(error)
  }
}
start()
`

// A doc comment's examples: under a tag, in a fenced block, and one that is no module (it is scanned); a fence in
// another language is prose.
const examples = `/**
 * Builds a reader.
 *
 * @example
 * try {
 *   build()
 * } catch (error) {
 *   console.log(error)
 * }
 *
 * \`\`\`ts
 * const tag = make("x")
 * try {
 *   tag\`a\${"b"}\`
 * } catch (error) {
 *   console.log(error)
 * }
 * \`\`\`
 *
 * \`\`\`ts
 * const a = ...
 * try { a() } catch { b() }
 * \`\`\`
 *
 * \`\`\`sh
 * try { not code here }
 * \`\`\`
 *
 * @since 0.0.0
 */
export const build = () => 1
export const last = () => { try { return 1 } catch { return 0 } }
`

// The forms an example takes that a reader still copies: fences of tildes and of four backticks, a fence with an
// attribute, a decorator inside an `@example`, code after a closing fence under the same `@example`, and a fragment
// (it is scanned) whose regular expressions hold a quote and the word.
const everyFence = `/**
 * Fences of every mark.
 *
 * ~~~ts
 * try { a() } catch {}
 * ~~~
 *
 * \`\`\`\`ts
 * try { b() } catch {}
 * \`\`\`\`
 *
 * \`\`\`ts:line-numbers
 * try { c() } catch {}
 * \`\`\`
 *
 * @example
 * @logged
 * class A {
 *   m() { try { d() } catch {} }
 * }
 *
 * @example
 * \`\`\`ts
 * const e = 1
 * \`\`\`
 * try { f() } catch {}
 *
 * \`\`\`ts
 * const a = ...
 * const r = /"/; try { g() } catch {}
 * const s = /try {/
 * \`\`\`
 * @since 1
 */
export const x = 1
`

// An example read as its own code: a fragment is scanned past its strings, comments, a member named `try` and a
// promise's `catch`, and each statement's form is told; an element's text is read as JSX, not scanned (a quote in it
// is no string, the word in it no statement); a fence closes only at a mark of its own character, as long as its own.
const ownCode = `/**
 * ~~~~ts
 * const x = 1
 * ~~~
 * try { z() } catch {}
 * ~~~~
 *
 * \`\`\`ts
 * const q = 1
 * ~~~
 * try { q() } catch {}
 * \`\`\`
 *
 * \`\`\`ts
 * const a = ...
 * const s = "try { no } catch {}"
 * const t = 'try { no }'
 * const u = \`try { no }\`
 * // try { no } catch {}
 * try { one() } finally { done() }
 * p.catch(f)
 * try { two() } catch { x() } finally { done() }
 * Effect.try { no }
 * f(x) /* try { no }
 * \`\`\`
 *
 * @example
 * const v = <p>Do try {name} again</p>
 *
 * @example
 * const w = <p>Don't {(() => { try { a() } catch {} })()}</p>
 */
export const y = 1
`

describe("laws try", () => {
  it.effect("passes Effect.try, Result.try, Option.liftThrowable and the word where it is no statement", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "packages/catalog/web/src/Read.ts": given }, inRepository)
      expect(printed(report)).toEqual([clean])
      expect(report.failed).toBe(false)
    })
  )

  it.effect(
    "refuses every try statement: a catch, a finally, both, nested, in a method and an arrow, each at its line",
    () =>
      Effect.gen(function* () {
        const file = "packages/catalog/model/src/Forms.ts"
        const report = yield* inTree({ [file]: forms }, inRepository)
        expect(report.failed).toBe(true)
        expect(printed(report)).toEqual([
          refused,
          `err: ${file}:2  ${caught}`,
          `err: ${file}:9  ${finalised}`,
          `err: ${file}:16  ${both}`,
          `err: ${file}:25  ${caught}`,
          `err: ${file}:26  ${caught}`,
          `err: ${file}:33  ${caught}`,
          `err: ${file}:36  ${caught}`
        ])
      })
  )

  it.effect("reads every code file: a .tsx, a .mts, a .cts, a script, a .mjs, a .cjs and a .jsx", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "apps/inventory/scripts/start.mjs": script,
          "apps/inventory/scripts/old.cjs": script,
          "packages/ui/src/components/old.jsx": script,
          "packages/ui/src/View.tsx": script,
          "packages/ui/src/tool.mts": script,
          "packages/ui/src/tool.cts": script,
          "tools/loose.js": script,
          "tools/notes.md": script
        },
        inRepository
      )
      expect(printed(report)).toEqual([
        refused,
        `err: apps/inventory/scripts/old.cjs:2  ${caught}`,
        `err: apps/inventory/scripts/start.mjs:2  ${caught}`,
        `err: packages/ui/src/View.tsx:2  ${caught}`,
        `err: packages/ui/src/components/old.jsx:2  ${caught}`,
        `err: packages/ui/src/tool.cts:2  ${caught}`,
        `err: packages/ui/src/tool.mts:2  ${caught}`,
        `err: tools/loose.js:2  ${caught}`
      ])
    })
  )

  it.effect(
    "refuses a try statement in a doc comment's example: under a tag, fenced, and in one that is no module",
    () =>
      Effect.gen(function* () {
        const file = "packages/foundation/modeling/identity/src/Id.ts"
        const report = yield* inTree({ [file]: examples }, inRepository)
        expect(printed(report)).toEqual([
          refused,
          `err: ${file}:5  ${inExample}`,
          `err: ${file}:13  ${inExample}`,
          `err: ${file}:22  ${inExample}`,
          `err: ${file}:32  ${caught}`
        ])
      })
  )

  it.effect(
    "refuses a try statement in every fence and every part of an example; a regular expression holds no statement",
    () =>
      Effect.gen(function* () {
        const file = "packages/a/src/Fences.ts"
        const report = yield* inTree({ [file]: everyFence }, inRepository)
        expect(printed(report)).toEqual([
          refused,
          ...A.map([5, 9, 13, 19, 26, 30], (line) => `err: ${file}:${line}  ${inExample}`)
        ])
      })
  )

  it.effect("reads an example as its own code: a fragment's strings and comments, JSX, a fence's own mark", () =>
    Effect.gen(function* () {
      const file = "packages/a/src/Own.ts"
      const report = yield* inTree({ [file]: ownCode }, inRepository)
      expect(printed(report)).toEqual([
        refused,
        `err: ${file}:5  ${inExample}`,
        `err: ${file}:11  ${inExample}`,
        `err: ${file}:20  a try statement with a finally in a doc comment's example: show ${forFinally}`,
        `err: ${file}:22  a try statement with a catch and a finally in a doc comment's example: show ${forCatch}; ${forFinally}`,
        `err: ${file}:31  ${inExample}`
      ])
    })
  )

  it.effect("does not read .agents/, the scratchpad or theme-init.js, and says so; a file beside them is read", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ".agents/skills/probe/scripts/probe.mjs": script,
          "scratchpad/src/idea.ts": script,
          "apps/inventory/public/theme-init.js": script
        },
        inRepository
      )
      expect(printed(report)).toEqual([clean])
      // Each is named from the root: a folder of the same name further down is read.
      const beside = yield* inTree(
        {
          "apps/inventory/public/theme-init.js": script,
          "apps/inventory/public/other.js": script,
          "packages/notes/scratchpad/Idea.ts": script,
          "docs/.agents/Note.ts": script
        },
        inRepository
      )
      expect(printed(beside)).toEqual([
        refused,
        `err: apps/inventory/public/other.js:2  ${caught}`,
        `err: docs/.agents/Note.ts:2  ${caught}`,
        `err: packages/notes/scratchpad/Idea.ts:2  ${caught}`
      ])
    })
  )

  it.effect("refuses a comment that turns a rule against try off, and is not turned off by it", () =>
    Effect.gen(function* () {
      const file = "packages/client/src/Tab.ts"
      const silenced = `// ${off("eslint", "-next-line", "no-restricted-syntax")}
try { go() } catch {}
/* ${off("oxlint", "")} */
// ${off("oxlint", "-line", "my/no-try-statement -- legacy")}
// ${off("eslint", "-next-line", "no-console")}
// try:check-ignore-next-line
try { go() } catch {}
`
      const report = yield* inTree({ [file]: silenced }, inRepository)
      expect(printed(report)).toEqual([
        refused,
        `err: ${file}:1  a comment that turns a rule against try off (eslint-disable-next-line): no comment does. Remove it`,
        `err: ${file}:3  a comment that turns a rule against try off (oxlint-disable): no comment does. Remove it`,
        `err: ${file}:4  a comment that turns a rule against try off (oxlint-disable-line): no comment does. Remove it`,
        `err: ${file}:2  ${caught}`,
        `err: ${file}:7  ${caught}`
      ])
    })
  )

  it.effect("excepts no file: a ledger, a linter's ignore list or a setting at the root changes nothing", () =>
    Effect.gen(function* () {
      const file = "packages/review/src/internal/keptStore.ts"
      const report = yield* inTree(
        {
          [file]: script,
          "try-ledger.json": json({ files: { [file]: 1 } }),
          ".oxlintrc.json": json({ ignorePatterns: [file], rules: { "no-restricted-syntax": "off" } }),
          "beep.json": json({ laws: { try: false } })
        },
        inRepository
      )
      expect(printed(report)).toEqual([refused, `err: ${file}:2  ${caught}`])
    })
  )

  it.effect(
    "refuses a file it cannot read, in words: one that does not parse, one nested too deep, an example too",
    () =>
      Effect.gen(function* () {
        const deep = `export const x = ${Str.repeat(1200)("(")}1${Str.repeat(1200)(")")}\n`
        const deepExample = `/**\n * @example\n * const x = ${Str.repeat(1200)("[")}1${Str.repeat(1200)("]")}\n */\nexport const y = 1\n`
        const report = yield* inTree(
          {
            "packages/a/src/Broken.ts": "export const x = {\n  try {\n",
            "packages/a/src/Deep.ts": deep,
            "packages/a/src/DeepExample.ts": deepExample
          },
          inRepository
        )
        const lines = printed(report)
        expect(report.failed).toBe(true)
        expect(lines[0]).toBe(refused)
        expect(A.length(lines)).toBe(4)
        expect(lines[1]).toMatch(/^err: packages\/a\/src\/Broken\.ts:\d+ {2}the file could not be parsed \(/)
        expect(lines[2]).toMatch(/^err: packages\/a\/src\/Deep\.ts:1 {2}the code here is nested too deep to read/)
        expect(lines[3]).toMatch(
          /^err: packages\/a\/src\/DeepExample\.ts:3 {2}the code here is nested too deep to read/
        )
      })
  )

  it.effect("reads what git would commit: tracked files, a name outside ASCII, a new file; not what git ignores", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ".gitignore": "built/\n",
          "packages/a/src/Tracked.ts": script,
          "packages/a/src/Ünï.ts": script,
          "packages/a/src/New.ts": script,
          "built/Bundle.ts": script
        },
        tracking([".gitignore", "packages/a/src/Tracked.ts", "packages/a/src/Ünï.ts"])
      )
      expect(printed(report)).toEqual([
        refused,
        `err: packages/a/src/New.ts:2  ${caught}`,
        `err: packages/a/src/Tracked.ts:2  ${caught}`,
        `err: packages/a/src/Ünï.ts:2  ${caught}`
      ])
    })
  )

  it.effect(
    "reads a file git holds three times in a merge once, and passes over a tracked file gone from the folder",
    () =>
      Effect.gen(function* () {
        const both = "packages/a/src/Both.ts"
        const gone = "packages/a/src/Gone.ts"
        const report = yield* inTree(
          { [both]: script, [gone]: script },
          Effect.gen(function* () {
            const repo = yield* Repo
            yield* repo.run("git", ["init", "-q"])
            yield* repo.run("git", ["add", "--", gone])
            yield* repo.run("rm", [gone])
            const blob = Str.trim((yield* repo.run("git", ["hash-object", "-w", "--", both])).stdout)
            const stages = A.join(
              A.map([1, 2, 3], (stage) => `100644 ${blob} ${stage}\t${both}\n`),
              ""
            )
            yield* repo.run("git", ["update-index", "--index-info"], { stdin: stages })
            const found = yield* tryStatements()
            return render(trySentence)(found)
          })
        )
        expect(printed(report)).toEqual([refused, `err: ${both}:2  ${caught}`])
      })
  )

  it.effect("fails when git cannot list the files: nothing checked is not nothing found", () =>
    Effect.gen(function* () {
      const found = yield* tryStatements()
      return render(trySentence)(found)
    }).pipe(
      (rule) => inTree({ "packages/catalog/web/src/Step.ts": script }, rule),
      Effect.map((report) => {
        expect(report.failed).toBe(true)
        expect(printed(report)[0]).toBe(refused)
        expect(printed(report)[1]).toContain("git could not list the files")
      })
    )
  )
})
