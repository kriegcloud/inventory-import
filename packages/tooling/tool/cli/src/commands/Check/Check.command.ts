/** The check runner leaves turbo's output live and appends diagnostics only when it fails. */
import * as A from "effect/Array"
import * as Console from "effect/Console"
import * as Str from "effect/String"
import * as O from "effect/Option"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Argument from "effect/cli/Argument"
import * as Command from "effect/cli/Command"
import * as ChildProcess from "effect/process/ChildProcess"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
import { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { emit } from "../../Report.schema.ts"
import { CheckFinding, CheckRunFailed, MergeBase } from "./CheckSummary.schema.ts"
import { checkRuns, checkSentence, checkSummary } from "./CheckSummary.rules.ts"

/** Runs turbo, retaining exactly its exit code even when the summary cannot be read. */
export const checkRun = Effect.fn("Check.run")(function* (args: ReadonlyArray<string>) {
  const repo = yield* Repo
  const command = A.head(args)
  if (O.isNone(command))
    return yield* RepoError.make({ path: "check run", message: "Supply a command, for example turbo run check" })
  const suppliedLog = A.findFirst(args, (arg) => Str.startsWith("--log-file=")(arg))
  const bareLog = A.findFirstIndex(args, (arg) => arg === "--log-file")
  const barePath = O.flatMap(bareLog, (index) =>
    A.get(args, index + 1).pipe(O.filter((arg) => !Str.startsWith("-")(arg)))
  )
  const ownsLog = O.isNone(suppliedLog) && O.isNone(bareLog)
  const structuredPath = O.getOrElse(
    O.orElse(O.map(suppliedLog, Str.slice(11)), () => barePath),
    () => ".turbo/check-output.json"
  )
  if (ownsLog) yield* repo.remove(repo.resolve(repo.root, structuredPath))
  const before = yield* checkRuns
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const handle = yield* spawner
    .spawn(
      ChildProcess.make(
        command.value,
        [
          ...A.filter(
            A.drop(args, 1),
            (arg) =>
              arg !== "--continue" &&
              !Str.startsWith("--continue=")(arg) &&
              arg !== "--summarize" &&
              !Str.startsWith("--summarize=")(arg)
          ),
          "--continue",
          "--summarize",
          ...(ownsLog ? [`--log-file=${structuredPath}`] : [])
        ],
        {
          cwd: repo.root,
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
          extendEnv: true
        }
      )
    )
    .pipe(
      Effect.mapError((cause) => RepoError.make({ path: "turbo", message: `turbo could not be run: ${String(cause)}` }))
    )
  const code = yield* handle.exitCode
  const after = yield* checkRuns.pipe(
    Effect.catchTag("RepoError", (error) =>
      Console.error(`Check summary unavailable: ${error.message}`).pipe(Effect.as([]))
    )
  )
  const fresh = A.findFirst(after, (entry) => !A.some(before, (old) => old.name === entry.name))
  if (O.isSome(fresh)) {
    let output = repo.resolve(repo.root, structuredPath)
    if (O.isSome(bareLog) && O.isNone(barePath)) {
      const logs = yield* repo.entries(repo.join(repo.root, ".turbo/logs")).pipe(Effect.orElseSucceed(() => []))
      const latest = A.head(
        A.sort(logs, (a: { readonly name: string }, b: { readonly name: string }) =>
          a.name < b.name ? 1 : a.name > b.name ? -1 : 0
        )
      )
      output = O.getOrElse(
        O.map(latest, (entry) => entry.path),
        () => output
      )
    }
    yield* repo.text(output).pipe(
      Effect.flatMap((text) => repo.write(Str.replace(/\.json$/, ".log")(fresh.value.path), text)),
      Effect.catchTag("RepoError", (error) => Console.error(`Task output could not be saved: ${error.message}`))
    )
  }
  if (code !== 0) {
    yield* Console.error("\nCheck failures")
    yield* (
      O.isSome(fresh)
        ? checkSummary(fresh.value.path)
        : Effect.succeed([CheckFinding.cases.NoRun.make({ runs: ".turbo/runs (no new record from this run)" })])
    ).pipe(
      Effect.flatMap((findings) =>
        Effect.forEach(findings, (finding) => Console.error(checkSentence(finding).text), {
          concurrency: 1,
          discard: true
        })
      ),
      Effect.catchTag("RepoError", (error) => Console.error(`Check summary unavailable: ${error.message}`))
    )
  }
  yield* Effect.forEach(
    A.drop(after, 10),
    (entry) =>
      Effect.all([repo.remove(entry.path), repo.remove(Str.replace(/\.json$/, ".log")(entry.path))], {
        concurrency: 1,
        discard: true
      }),
    { concurrency: 1, discard: true }
  ).pipe(Effect.catchTag("RepoError", (error) => Console.error(`Run records could not be pruned: ${error.message}`)))
  if (code !== 0) return yield* CheckRunFailed.make({ code })
}, Effect.scoped)

/**
 * Where this branch left `origin/main`, the base `check:changed` filters on. A branch with no merge base (no fetch
 * yet, or `origin/main` unknown) is told what to run, never checked against a guess.
 */
export const changedBase = Effect.fn("Check.changedBase")(function* () {
  const repo = yield* Repo
  const merged = yield* repo.run("git", ["merge-base", "HEAD", "origin/main"])
  const first = A.head(Str.split("\n")(merged.stdout))
  const base =
    merged.code === 0 && O.isSome(first)
      ? yield* S.decodeEffect(MergeBase)(first.value).pipe(Effect.option)
      : O.none<MergeBase>()
  if (O.isNone(base))
    return yield* RepoError.make({
      path: "git merge-base HEAD origin/main",
      message: "found no commit where this branch left origin/main: run git fetch origin, then check:changed again"
    })
  return base.value
})

/**
 * The check before a commit (Benjamin, 2026-11-26): the tasks given, for only the packages changed since this branch
 * left `origin/main` (committed or not; `--filter=[<base>]`, which leaves out the packages that depend on them), and
 * every root task named. The dependents' tests, and every other test, are `bun run check`'s, before a push.
 */
export const checkChanged = Effect.fn("Check.changed")(function* (args: ReadonlyArray<string>) {
  const base = yield* changedBase()
  yield* Console.error(
    `check:changed: the packages changed since ${Str.slice(0, 8)(base)}, where this branch left origin/main`
  )
  return yield* checkRun(A.append(args, `--filter=[${base}]`))
})

/** Shows the latest turbo record without starting another check. */
export const checkSummaryCommand = Command.make("summary", {}, () =>
  checkSummary().pipe(Effect.flatMap(emit(checkSentence)))
)
/** Accepts turbo's task names and flags after `--`. */
export const checkRunCommand = Command.make(
  "run",
  { args: Argument.String("args").pipe(Argument.variadic()) },
  ({ args }) => checkRun(args)
)
/** Accepts turbo's task names and flags after `--`, and checks only the packages changed since `origin/main`. */
export const checkChangedCommand = Command.make(
  "changed",
  { args: Argument.String("args").pipe(Argument.variadic()) },
  ({ args }) => checkChanged(args)
)
/** The commands for running a check, a check of what changed, or reading its last summary. */
export const checkCommand = Command.make("check").pipe(
  Command.withSubcommands([checkSummaryCommand, checkRunCommand, checkChangedCommand])
)
