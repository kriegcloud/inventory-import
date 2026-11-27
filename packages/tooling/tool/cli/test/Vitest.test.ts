// The mutants' Vitest service on a real process: a stand-in `node_modules/vitest/vitest.mjs` in a temporary
// repository, started as the runner starts vitest, writes its report as vitest's JSON reporter does, or prints and
// never ends. What is held: the report is read; a run past its limit is stopped with its process, and what it printed
// before is kept in `vitest.log` and in the answer's tail, since that is what says why a slow mutant gave no result.
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Str from "effect/String"
import { Vitest } from "../src/commands/Mutants/Vitest.service.ts"
import { Repo } from "../src/Repo.service.ts"
import { inTree } from "./support/tree.ts"

// The stand-in: the files it is given are its tests, `--root` its folder; a file named `hang` never ends.
const standIn = `import { writeFileSync } from "node:fs"
const args = process.argv.slice(2)
const after = (flag) => args[args.indexOf(flag) + 1]
const root = after("--root")
const output = args.find((arg) => arg.startsWith("--outputFile.json=")).slice("--outputFile.json=".length)
const files = args.filter((arg) => arg.endsWith(".test.ts"))
console.log("ran " + files.join(" "))
if (files.some((file) => file.includes("hang"))) {
  writeFileSync(root + "/pid", String(process.pid))
  console.error("still proving the rule")
  setInterval(() => {}, 1000)
} else {
  const test = { title: "it holds", fullName: "it holds", status: "passed", failureMessages: [] }
  const results = files.map((file) => ({ name: root + "/" + file, status: "passed", message: "", assertionResults: [test] }))
  writeFileSync(output, JSON.stringify({ testResults: results }))
}
`

const tree = {
  "node_modules/vitest/vitest.mjs": standIn,
  "copy/test/a.test.ts": "",
  "copy/test/hang.test.ts": ""
}

/** Gives `effect` the real service, built on the repository it runs in and let go when it ends. */
const withVitest = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Layer.build(Vitest.layer).pipe(
    Effect.flatMap((context) => Effect.provideContext(effect, context)),
    Effect.scoped
  )

describe("the mutants' Vitest service", () => {
  it.live("reads the report vitest wrote, and keeps what it printed", () =>
    inTree(
      tree,
      Effect.gen(function* () {
        const repo = yield* Repo
        const vitest = yield* Vitest
        const copy = repo.join(repo.root, "copy")
        const answer = yield* vitest.run({ copy, files: ["test/a.test.ts"], nice: 0, limit: 20 })
        expect(answer.stopped).toBe(false)
        expect(O.map(answer.report, (report) => report.testResults.length)).toEqual(O.some(1))
        expect(Str.trim(answer.tail)).toBe("ran test/a.test.ts")
        const log = yield* repo.text(repo.join(copy, "vitest.log"))
        expect(Str.trim(log)).toBe("ran test/a.test.ts")
      }).pipe(withVitest)
    )
  )

  it.live("stops a run at its limit with its process, and keeps what it printed before", () =>
    inTree(
      tree,
      Effect.gen(function* () {
        const repo = yield* Repo
        const vitest = yield* Vitest
        const copy = repo.join(repo.root, "copy")
        const answer = yield* vitest.run({ copy, files: ["test/hang.test.ts"], nice: 0, limit: 2 })
        expect(answer.stopped).toBe(true)
        expect(O.isNone(answer.report)).toBe(true)
        expect(Str.includes("ran test/hang.test.ts")(answer.tail)).toBe(true)
        expect(Str.includes("still proving the rule")(answer.tail)).toBe(true)
        const log = yield* repo.text(repo.join(copy, "vitest.log"))
        expect(Str.includes("still proving the rule")(log)).toBe(true)
        const pid = yield* repo.text(repo.join(copy, "pid"))
        const alive = yield* repo.run("kill", ["-0", Str.trim(pid)])
        expect(alive.code).not.toBe(0)
      }).pipe(withVitest)
    )
  )
})
