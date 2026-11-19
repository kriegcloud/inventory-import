import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Order from "effect/Order"
import * as ChildProcess from "effect/process/ChildProcess"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"

// Decision T7: one entry that loads the whole CLI, and a budget. Every package's check starts the CLI, so a command
// that does nothing must start fast. Measured when the ten commands were in: 110 ms on an idle machine. The budget
// leaves room for a machine busy with the rest of the check, and the fastest of five runs is what is held to it, so
// one slow start under load does not fail the test. If this fails for real, give `src/bin.ts` a fast path that loads
// only the command asked for, as beep-effect's does.
const budgetMs = 400

const startOnce = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const started = yield* Clock.currentTimeMillis
  const code = yield* spawner.exitCode(ChildProcess.make("bun", ["src/bin.ts", "--version"]))
  const finished = yield* Clock.currentTimeMillis
  return { code, ms: finished - started }
})

// The real clock, not the test clock: this test measures time.
layer(NodeServices.layer, { excludeTestServices: true })("the CLI's start-up", (it) => {
  it.effect("a command that does nothing starts within the budget", () =>
    Effect.gen(function* () {
      const runs = yield* Effect.forEach(A.range(1, 5), () => startOnce, { concurrency: 1 })
      expect(A.map(runs, (run) => Number(run.code))).toEqual([0, 0, 0, 0, 0])
      const fastest = A.reduce(runs, Number.POSITIVE_INFINITY, (least, run) => Order.min(Order.Number)(least, run.ms))
      expect(fastest).toBeLessThan(budgetMs)
    })
  )
})
