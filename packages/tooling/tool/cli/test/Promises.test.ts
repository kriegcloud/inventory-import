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
  promiseSentence,
  promisesListed,
  promisesVendored
} from "../src/commands/Laws/Promises.rules.ts"
import { readPromises } from "../src/commands/Laws/internal/promiseCode.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, printed } from "./support/tree.ts"

const inRepository = Effect.gen(function* () {
  const repo = yield* Repo
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
      expect(said.length).toBe(12)
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

  it.effect("a listed file passes while it uses a Promise, and is refused once it uses none", () =>
    Effect.gen(function* () {
      const listed = A.findFirst(promisesListed, Str.endsWith(".ts")).pipe(O.getOrElse(() => ""))
      const said2 = yield* inTree({ [listed]: uses }, inRepository)

      expect(said2).toEqual([expect.stringContaining("out: promises:check OK")])
      const said3 = yield* inTree({ [listed]: passes }, inRepository)

      expect(said3).toContain(
        `err: ${listed}  is listed in promisesListed but uses no Promise any more: take its line off the list`
      )
    })
  )

  it("the lists only shrink: their lengths are held here, and lowered with them", () => {
    expect([promisesListed.length, R.size(promisesVendored), R.size(promiseEntryPoints)]).toEqual([57, 7, 2])
    expect(A.dedupe(promisesListed).length).toBe(promisesListed.length)
  })
})
