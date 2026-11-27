/**
 * Vitest, as the mutants' runner starts it: in one copy of a package, on some of its test files, with its JSON
 * reporter, under a time limit. The runner reads what it wrote and nothing else, so a test can stand in for it with a
 * report of its own.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as Context from "effect/Context"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Str from "effect/String"
import type { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { VitestReport } from "./Mutants.schema.ts"

const $I = $RepoCliId.create("commands/Mutants/Vitest.service")

/** Where vitest is, from the root: the repository's own, which `bun install` puts there. */
export const vitestEntry = "node_modules/vitest/vitest.mjs"

/** One run of vitest in a copy. */
export interface VitestRun {
  /** The copy's folder, absolute: vitest's root, where its report and log are written. */
  readonly copy: string
  /** The test files, from the copy's folder. */
  readonly files: ReadonlyArray<string>
  /** The niceness the run is started with; 0 for none. */
  readonly nice: number
  /** Seconds before the run is stopped from outside. */
  readonly limit: number
}

/** What a run left: its report when it wrote one, whether it was stopped at its limit, and the end of its log. */
export interface VitestAnswer {
  readonly report: O.Option<VitestReport>
  readonly stopped: boolean
  /** The last characters vitest printed, to say why there is no report. */
  readonly tail: string
}

/**
 * Vitest, started in a copy.
 *
 * @category services
 */
export class Vitest extends Context.Service<
  Vitest,
  {
    /** Whether vitest is there to be started; its path from the root when it is not. */
    readonly missing: Effect.Effect<O.Option<string>>
    /** Runs vitest in a copy and reads its report. */
    readonly run: (request: VitestRun) => Effect.Effect<VitestAnswer, RepoError>
  }
>()($I`Vitest`) {
  /**
   * The repository's vitest, started with node in the copy as its root: its own module cache there, its JSON report in
   * `result.json` and what its default reporter and the tests printed in `vitest.log`, written as they print it, both
   * beside the copy's files. A run past its limit is stopped, with every process it started (it leads a process group
   * of its own), before anything is read, and what it printed until then is kept.
   */
  static readonly layer: Layer.Layer<Vitest, never, Repo> = Layer.effect(
    Vitest,
    Effect.gen(function* () {
      const repo = yield* Repo
      const entry = repo.join(repo.root, vitestEntry)

      const run = Effect.fn("Vitest.run")(function* (request: VitestRun) {
        const result = repo.join(request.copy, "result.json")
        const args = [
          entry,
          "run",
          "--root",
          request.copy,
          ...request.files,
          // The JSON report is what is read; the default reporter beside it prints each test file as it ends, into the
          // log, so a run stopped at its limit says which files finished and which test was still running.
          "--reporter=json",
          "--reporter=default",
          `--outputFile.json=${result}`,
          // Each copy keeps its own module cache: vitest clears a shared one when it sees a workspace other than the
          // one that wrote it, under the repository's own tests running beside the copies.
          `--fsModuleCachePath=${repo.join(request.copy, ".vitest-cache")}`
        ]
        const logFile = repo.join(request.copy, "vitest.log")
        const started = request.nice > 0 ? ["nice", "-n", `${request.nice}`, "node", ...args] : ["node", ...args]
        // What vitest prints goes to its log as it prints it, through the shell's redirection, and the shell becomes
        // vitest (`exec`): a run stopped at its limit keeps every line it printed, which is what says whether the
        // mutant was not held or ran out of time. Collected in memory, it would go with the stopped run.
        const answer = yield* repo
          .run("sh", ["-c", 'log="$1"; shift; exec "$@" > "$log" 2>&1', "sh", logFile, ...started], {
            cwd: request.copy
          })
          .pipe(Effect.timeoutOption(Duration.seconds(request.limit)))
        const log = (yield* repo.exists(logFile)) ? yield* repo.text(logFile) : ""
        const report = (yield* repo.exists(result))
          ? yield* Effect.option(repo.json(VitestReport)(result))
          : O.none<VitestReport>()
        return {
          report,
          stopped: O.isNone(answer),
          tail: Str.slice(-400)(log)
        } satisfies VitestAnswer
      })

      return {
        missing: Effect.map(repo.exists(entry), (there) => (there ? O.none<string>() : O.some(vitestEntry))),
        run
      }
    })
  )
}
