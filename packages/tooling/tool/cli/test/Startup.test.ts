import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Num from "effect/Number"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as Str from "effect/String"
import * as ChildProcess from "effect/process/ChildProcess"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"

// Decision T7: one entry that loads the whole CLI, and a budget. Every package's check starts the CLI, so a command
// that does nothing must start fast. If this fails for real, give `src/bin.ts` a fast path that loads only the
// command asked for, as beep-effect's does.
//
// What is held to the budget is the processor time the start used (user and system, as bash's `time` reports them for
// the one process it started), not the time on the clock. The clock measures the machine as much as the CLI: on a
// four-core CI runner busy with the rest of the check, five starts took over five seconds, and on a pinned core here
// one start took 19 s on the clock for 0.13 s of work. Processor time does not grow while a process waits its turn.
//
// Measured: 110 ms on the clock and about 185 ms of processor time on an idle machine (bun starts several threads, so
// its processor time is above its clock time). The budget was 400 ms on the clock, 3.6 times the start; it is the same
// multiple in processor time, which also leaves room for a runner's slower cores. The fastest of up to five starts is
// what is held to it, and the test stops at the first start within it.
const budgetCpuMs = 700

/** One start, timed by bash: what it used of the processor, in milliseconds, and how it ended. */
// Each start is stopped after 20 s on the clock (`timeout`, exit 124): a start that hangs is a failed start, not a
// test that waits out its limit.
const script =
  'LC_ALL=C; TIMEFORMAT="cpu %3U %3S"; time timeout 20 bun src/bin.ts --version >/dev/null 2>&1; echo "exit $?"'

const milliseconds = (seconds: string) => Math.round(Number(seconds) * 1000)

const startOnce = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const said = yield* spawner.string(ChildProcess.make("bash", ["-c", script]), { includeStderr: true })
  const cpu = Str.match(/cpu (\d+\.\d+) (\d+\.\d+)/)(said)
  const exit = Str.match(/exit (\d+)/)(said)
  // A start whose time or end cannot be read is not a fast one: the test says what bash printed.
  if (O.isNone(cpu) || O.isNone(exit)) return yield* Effect.die(`bash did not time the start: ${said}`)
  return { code: Number(exit.value[1]), cpuMs: milliseconds(`${cpu.value[1]}`) + milliseconds(`${cpu.value[2]}`) }
})

/** Starts until one is within the budget, five times at most. */
const starts = (
  left: number,
  done: ReadonlyArray<{ readonly code: number; readonly cpuMs: number }>
): Effect.Effect<
  ReadonlyArray<{ readonly code: number; readonly cpuMs: number }>,
  never,
  ChildProcessSpawner.ChildProcessSpawner
> =>
  left === 0
    ? Effect.succeed(done)
    : Effect.flatMap(Effect.orDie(startOnce), (run) =>
        run.code === 0 && run.cpuMs < budgetCpuMs ? Effect.succeed([...done, run]) : starts(left - 1, [...done, run])
      )

layer(NodeServices.layer, { excludeTestServices: true })("the CLI's start-up", (it) => {
  // The limit is not the budget: five starts of at most 20 s each, so 120 s fails a hung CLI well inside the job.
  it.effect(
    "a command that does nothing starts within the budget, in processor time",
    () =>
      Effect.gen(function* () {
        const runs = yield* starts(5, [])
        expect(A.map(runs, (run) => run.code)).toEqual(A.map(runs, () => 0))
        const fastest = A.reduce(runs, Number.POSITIVE_INFINITY, (least, run) => Order.min(Num.Order)(least, run.cpuMs))
        expect(fastest).toBeLessThan(budgetCpuMs)
      }),
    120_000
  )
})
