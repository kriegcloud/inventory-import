/**
 * What a failing `bun run check` ends with: one summary, read from turbo's own record of the run, that names every
 * task that failed and the lines of its log that say what to fix, so nobody scrolls back through a hundred tasks.
 *
 * The summary reads turbo's run summary (`turbo run ... --summarize` writes `.turbo/runs/<id>.json`) and each failed
 * task's log, the file turbo names in that summary. It changes no law: every task, a law of this CLI or not (the
 * type-check, oxlint, Vitest, a Python check), is read the same way. Measured on 2026-11-26
 * (`goals/focus-and-friction/PLAN.md`, step 5): without `--continue` turbo stopped at the first failure and a second
 * broken law was never reported, so the check runs with it, and this summary is only as complete as that run.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $RepoCliId.create("commands/Check/CheckSummary.schema")

/**
 * One task's execution as turbo records it. A task turbo never started (its dependency failed) has none.
 *
 * @category schemas
 */
export class TurboExecution extends S.Class<TurboExecution, { readonly brand: unique symbol }>($I`TurboExecution`)(
  {
    exitCode: S.Int.pipe(S.annotateKey({ description: "The task's exit code; 0 when it passed or was replayed" }))
  },
  $I.annote("TurboExecution", { description: "How one task of a turbo run ended" })
) {}

/**
 * One task of a turbo run, with only the fields the summary reads. Turbo writes many more; they are ignored.
 *
 * @category schemas
 */
export class TurboTask extends S.Class<TurboTask, { readonly brand: unique symbol }>($I`TurboTask`)(
  {
    taskId: S.String.pipe(
      S.annotateKey({ description: "Turbo's id of the task: `<package>#<task>`, or `//#<task>` for a root task" })
    ),
    directory: S.String.pipe(
      S.annotateKey({ description: "The package's folder, relative to the repository's root; empty for the root" })
    ),
    logFile: S.String.pipe(
      S.annotateKey({ description: "The task's log, relative to its package's folder, as turbo names it" })
    ),
    execution: S.OptionFromOptionalKey(TurboExecution).pipe(
      S.annotateKey({ description: "How the task ended; none when turbo never started it" })
    )
  },
  $I.annote("TurboTask", { description: "One task of a turbo run: its id, its folder, its log and how it ended" })
) {}

/**
 * The run as a whole.
 *
 * @category schemas
 */
export class TurboRunExecution extends S.Class<TurboRunExecution, { readonly brand: unique symbol }>(
  $I`TurboRunExecution`
)(
  {
    exitCode: S.Int.pipe(S.annotateKey({ description: "turbo's own exit code for the run" })),
    attempted: S.Int.pipe(S.annotateKey({ description: "How many tasks turbo started or replayed" })),
    failed: S.Int.pipe(S.annotateKey({ description: "How many of them failed" }))
  },
  $I.annote("TurboRunExecution", { description: "How a turbo run ended, counted" })
) {}

/**
 * Turbo's run summary (`.turbo/runs/<id>.json`), decoded to what the summary needs.
 *
 * @category schemas
 */
export class TurboRun extends S.Class<TurboRun, { readonly brand: unique symbol }>($I`TurboRun`)(
  {
    execution: TurboRunExecution.pipe(S.annotateKey({ description: "How the run ended" })),
    tasks: S.Array(TurboTask).pipe(S.annotateKey({ description: "Every task of the run" }))
  },
  $I.annote("TurboRun", { description: "Turbo's record of one run, as `--summarize` writes it" })
) {}

/**
 * One line of a failed task's log that tells a person what to fix, with the file and line it names when it names
 * one. The file is relative to the repository's root, so a package's own path (`src/x.ts(17,14)`) is given its
 * folder.
 *
 * @category schemas
 */
export class FixLine extends S.Class<FixLine, { readonly brand: unique symbol }>($I`FixLine`)(
  {
    file: S.OptionFromOptionalKey(S.String).pipe(
      S.annotateKey({ description: "The file the line names, relative to the repository's root" })
    ),
    line: S.OptionFromOptionalKey(S.Int).pipe(S.annotateKey({ description: "The line in that file, when named" })),
    text: S.String.pipe(S.annotateKey({ description: "The log's line, without turbo's task prefix or colour codes" }))
  },
  $I.annote("FixLine", { description: "A line of a failed task's log that says what to fix" })
) {}

/**
 * What the summary finds.
 *
 * - `NoRun`: there is no run summary to read (turbo was not run with `--summarize`, or `.turbo/runs` is empty).
 * - `TaskFailed`: one failed task, its log, and the lines of that log that say what to fix. When no line of the log
 *   matches what a finding looks like, the log's last lines stand in, so a failed task is never shown empty.
 * - `Counted`: how many tasks ran and how many failed: the summary's last line.
 *
 * @category schemas
 */
export const CheckFinding = S.TaggedUnion({
  NoRun: {
    runs: S.String.pipe(S.annotateKey({ description: "The folder that held no run summary" }))
  },
  TaskFailed: {
    task: S.String.pipe(S.annotateKey({ description: "Turbo's id of the task" })),
    exitCode: S.Int.pipe(S.annotateKey({ description: "Its exit code" })),
    log: S.String.pipe(S.annotateKey({ description: "Its log, relative to the repository's root" })),
    lines: S.Array(FixLine).pipe(S.annotateKey({ description: "The lines of the log that say what to fix" })),
    shown: S.Int.pipe(S.annotateKey({ description: "How many lines of the log matched, before any cut" }))
  },
  Counted: {
    attempted: S.Int.pipe(S.annotateKey({ description: "How many tasks ran or were replayed" })),
    failed: S.Int.pipe(S.annotateKey({ description: "How many of them failed" }))
  }
}).pipe(
  $I.annoteSchema("CheckFinding", {
    description: "What the summary of a check finds: no run to read, a failed task with what to fix, or the count"
  })
)

/**
 * The decoded value of `CheckFinding`.
 *
 * @category models
 */
export type CheckFinding = typeof CheckFinding.Type
