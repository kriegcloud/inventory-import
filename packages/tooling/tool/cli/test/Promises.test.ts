// The Promise ban: each use is refused where it stands, a module's own `.then` or `.catch` passes, an entry point
// may run an Effect as a Promise, and the lists only shrink.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import {
  promiseEntryPoints,
  promises,
  promisesHeld,
  promisesProfile,
  promiseSentence,
  promisesListed
} from "../src/commands/Laws/Promises.rules.ts"
import { heldAs } from "../src/commands/Laws/internal/held.ts"
import { readPromises } from "../src/commands/Laws/internal/promiseCode.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

/** This repository's root, from this file's folder: its typed profile and what it has installed are the law's. */
const real = (repo: Repo["Service"], path: string) => repo.resolve(import.meta.dirname, "../../../../..", path)

// A repository the typed half can read: the real profile, the installed tools, and one project over every file.
const inRepository = Effect.gen(function* () {
  const repo = yield* Repo
  const here = (path: string) => repo.join(repo.root, path)
  const profile = yield* repo.text(real(repo, promisesProfile))
  yield* repo.write(here(promisesProfile), profile)
  yield* repo.write(
    here("tsconfig.json"),
    json({
      compilerOptions: {
        noEmit: true,
        strict: true,
        module: "esnext",
        moduleResolution: "bundler",
        target: "ES2025",
        lib: ["ESNext", "DOM"],
        jsx: "react-jsx",
        skipLibCheck: true
      },
      include: ["**/*.ts", "**/*.tsx"]
    })
  )
  yield* repo.write(here(".gitignore"), "node_modules\n")
  yield* repo.run("ln", ["-s", real(repo, "node_modules"), here("node_modules")])
  yield* repo.run("git", ["init", "-q"])
  const found = yield* promises()
  return printed(render(promiseSentence)(found))
})

const uses = `import * as Effect from "effect/Effect"
import { Story } from "./story.ts"
export const a = async () => 1
export const b = async function () { await a() }
export const c = new Promise((resolve) => resolve(1))
export const d = Promise.all([a()])
export const e: Promise<number> = a()
export const f = a().then((n) => n + 1)
export const g = fetch("/").catch(() => undefined)
export const h = Effect.runPromise(Effect.succeed(1))
export class K { async m() { for await (const x of []) x } }
`

const passes = `import * as Effect from "effect/Effect"
import { Story } from "./story.ts"
export const a = Effect.succeed(1).pipe(Effect.catch(() => Effect.succeed(0)))
export const b = Story.then("a step")
export const c = Effect.tryPromise({ try: () => fetch("/"), catch: () => "unreachable" as const })
export const d = Effect.promise(() => fetch("/"))
export const words = "async () => await Promise.all(x).then(y)"
`

describe("laws promises", () => {
  it("reads each use of a Promise, and passes a module's own members", () => {
    expect(A.map(readPromises({ file: "a.ts", source: uses }).found, (found) => `${found.line} ${found.use}`)).toEqual([
      "3 async",
      "4 async",
      "4 await",
      "5 new",
      "6 static",
      "7 type",
      "8 chain",
      "9 chain",
      "10 run",
      "11 async",
      "11 await"
    ])
    expect(readPromises({ file: "b.ts", source: passes }).found).toEqual([])
  })

  it("catches Promise however it is reached: through the global object, in brackets, or under another name", () => {
    const uses = (source: string) => A.map(readPromises({ file: "c.ts", source }).found, (found) => found.use)
    expect(uses("const Q = Promise\nQ.all([])\nnew Q(() => {})\n")).toEqual(["value"])
    expect(uses("globalThis.Promise.resolve(1)\n")).toEqual(["static"])
    expect(
      uses("new globalThis.Promise(() => {})\nnew self.Promise(() => {})\nnew window.Promise(() => {})\n")
    ).toEqual(["new", "new", "new"])
    expect(uses('Promise["all"]([])\nexport const all = Promise.all\n')).toEqual(["static", "static"])
    expect(uses('promise["then"](() => 1)\n')).toEqual(["chain"])
    // A name in a type, a key, or a member of another object is no use of Promise.
    expect(uses("export const box = { Promise: 1 }\nexport const n = box.Promise\n")).toEqual([])
  })

  it.effect("refuses each use in a file no list names, and says what to write instead", () =>
    Effect.gen(function* () {
      const said = yield* inTree({ "packages/x/src/a.ts": uses }, inRepository)
      expect(said[0]).toContain("err: promises:check FAIL  a Promise is written")
      expect(said).toContain(
        "err: packages/x/src/a.ts:5  a new Promise: write Effect.async, Effect.callback or a Deferred"
      )
      expect(said).toContain(
        "err: packages/x/src/a.ts:10  an Effect run as a Promise: run it at an entry point (promiseEntryPoints), or yield* it"
      )
      expect(said).toContain(
        "err: packages/x/src/a.ts:9  a .then, .catch or .finally on a promise: write Effect.map, Effect.catch or Effect.ensuring"
      )
    })
  )

  it.effect("an entry point may run an Effect as a Promise and name its type, and nothing else", () =>
    Effect.gen(function* () {
      const entry = "apps/inventory/src/web/main.tsx"
      const ran = `import * as Effect from "effect/Effect"\nexport const p: Promise<number> = Effect.runPromise(Effect.succeed(1))\n`
      const said1 = yield* inTree({ [entry]: ran }, inRepository)

      expect(said1).toEqual([expect.stringContaining("out: promises:check OK")])
      const chained = yield* inTree({ [entry]: `${ran}export const q = p.then((n) => n)\n` }, inRepository)
      expect(chained).toContain(
        `err: ${entry}:3  a .then, .catch or .finally on a promise: write Effect.map, Effect.catch or Effect.ensuring`
      )
    })
  )

  it.effect(
    "a listed file is held at its number of uses: one more or one fewer is refused, and none takes it off",
    () =>
      Effect.gen(function* () {
        // A listed file that is no entry point and holds two uses or more, so one fewer is not none.
        const [listed, held] = O.getOrElse(
          A.findFirst(
            R.toEntries(promisesListed),
            ([file, count]) => Str.endsWith(".ts")(file) && !R.has(promiseEntryPoints, file) && count >= 2
          ),
          () => ["", 0] as const
        )
        const asyncs = (count: number) =>
          A.join(
            A.makeBy(count, (i) => `export const a${i} = async () => ${i}\n`),
            ""
          )
        const kept = yield* inTree({ [listed]: asyncs(held) }, inRepository)
        expect(kept).toEqual([expect.stringContaining("out: promises:check OK")])
        const more = yield* inTree({ [listed]: asyncs(held + 1) }, inRepository)
        expect(more).toContain(
          `err: ${listed}  breaks the rule in ${held + 1} places, more than the ${held} promisesListed holds it to: a listed file may only lose places. Fix the new ones`
        )
        const fewer = yield* inTree({ [listed]: asyncs(held - 1) }, inRepository)
        expect(fewer).toContain(
          `err: ${listed}  breaks the rule in ${held - 1} places, fewer than the ${held} promisesListed holds it to: lower its number to ${held - 1}`
        )
        const none = yield* inTree({ [listed]: passes }, inRepository)
        expect(none).toContain(
          `err: ${listed}  is listed in promisesListed but breaks the rule no more: take its line off`
        )
      })
  )

  it.effect(
    "reads types too: a Promise reached by no name the parser knows is refused, and keeps a listed file on",
    () =>
      Effect.gen(function* () {
        const routed = `const g = globalThis\ng.Promise.all([])\nexport const made = () => g.Promise.resolve(1)\n`
        const said = yield* inTree({ "packages/x/src/routed.ts": routed }, inRepository)
        expect(said).toContain(
          "err: packages/x/src/routed.ts:2  a value typed as a Promise: Promises must be awaited, add await operator. (typescript(no-floating-promises)). Write the Effect that does the work"
        )
        // The edge the law prescribes, and a component's ReactNode, are not refused by type.
        const edge = `import * as Effect from "effect/Effect"\nexport const got = Effect.promise(() => fetch("/"))\n`
        const fine = yield* inTree({ "packages/x/src/edge.ts": edge }, inRepository)
        expect(fine).toEqual([expect.stringContaining("out: promises:check OK")])
        const off = Str.trim(`oxlint-disable-next-line typescript/no-floating-promises`)
        const silenced = yield* inTree({ "packages/x/src/s.ts": `// ${off}\nexport const n = 1\n` }, inRepository)
        expect(silenced).toContain(
          "err: packages/x/src/s.ts:1  a comment that turns a typed Promise rule off (oxlint-disable-next-line): no comment does. Remove it"
        )
      })
  )

  it("the lists are held by their names too, a guard the review sees", () => {
    expect([heldAs(R.keys(promisesListed)), heldAs(R.keys(promiseEntryPoints))]).toEqual([
      promisesHeld.listed,
      promisesHeld.entryPoints
    ])
    expect(heldAs(A.append(A.drop(R.keys(promisesListed), 1), "packages/x/src/new.ts"))).not.toBe(promisesHeld.listed)
  })
})
