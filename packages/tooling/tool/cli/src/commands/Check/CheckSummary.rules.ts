/** Reads turbo's record and logs after a run. A failed task always has something to read, even with an unfamiliar log. */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo, type Entry } from "../../Repo.service.ts"
import { err, out } from "../../Report.schema.ts"
import { CheckFinding, FixLine, TurboLogLine, TurboRun } from "./CheckSummary.schema.ts"

/** The newest turbo run names sort in creation order; only JSON run records count. */
export const checkRuns = Effect.gen(function* () {
  const repo = yield* Repo
  const entries = yield* repo.entries(repo.join(repo.root, ".turbo/runs"))
  return A.sort(
    A.filter(entries, (entry) => !entry.directory && Str.endsWith(".json")(entry.name)),
    (a: Entry, b: Entry) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0)
  )
})

// Logs may include both ANSI colour and turbo's package prefix. Retain the whole diagnostic sentence.
const clean = (text: string) =>
  Str.trim(Str.replace(/^[@\w/-]+:[a-z][\w:-]*: /i, "")(Str.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")(text)))
// The runner's echo of the command (`$ bun ...`) and its closing `error: script "x" exited` say nothing to fix.
const noise = (text: string) => /^\$ |^error: script "/.test(text)
const diagnostic = (text: string) =>
  !noise(text) &&
  (/error|FAIL|AssertionError|❯|\bholds\b|\bWrite:|\bPut\b|\bUse\b|\bexpected\b|\brefus|\bhelp:|\bhint:|\bConsider\b|\bFormat issues\b|\bRun without\b/i.test(
    text
  ) ||
    /\.(?:tsx?|jsx?|mjs|cjs|py|jsonc?|mdx?|css|s[ac]ss|ya?ml|toml|sql|sh|html|graphql|ttl)(?::\d+|\(\d+|\s|$)/.test(
      text
    ))

/** Reads the newest record, or an explicitly selected fresh record, and gathers failures without reading passing logs. */
export const checkSummary = Effect.fn("Check.summary")(function* (run?: string) {
  const repo = yield* Repo
  const runs = yield* checkRuns
  const selected = run === undefined ? O.map(A.head(runs), (entry) => entry.path) : O.some(run)
  if (O.isNone(selected)) return [CheckFinding.cases.NoRun.make({ runs: ".turbo/runs" })]
  const record = yield* repo.json(TurboRun)(selected.value)
  const companion = Str.replace(/\.json$/, ".log")(selected.value)
  const structured = yield* repo
    .exists(companion)
    .pipe(Effect.flatMap((exists) => (exists ? repo.json(S.Array(TurboLogLine))(companion) : Effect.succeed([]))))
  const failures = yield* Effect.forEach(
    record.tasks,
    Effect.fnUntraced(function* (task) {
      if (O.isNone(task.execution) || task.execution.value.exitCode === 0) return A.empty<CheckFinding>()
      // What this run printed for the task comes first. A task turbo never caches keeps a log file from an earlier
      // run, or none, so its file is read only when the run's own log holds nothing for it.
      const printed = A.map(
        A.filter(structured, (line) => line.source === task.taskId),
        (line) => line.text
      )
      const fromFile = A.isReadonlyArrayEmpty(printed) ? task.logFile : O.none()
      const log = O.match(fromFile, {
        onNone: () => repo.relative(companion, repo.root),
        onSome: (file) => file
      })
      const text = yield* O.match(fromFile, {
        onNone: () => Effect.succeed(A.join(printed, "\n")),
        onSome: () => repo.text(repo.join(repo.root, log)).pipe(Effect.orElseSucceed(() => "Log could not be read"))
      })
      const all = A.filter(A.map(Str.split(/\r?\n/)(text), clean), (line) => line !== "" && !noise(line))
      const matches = A.filter(all, diagnostic)
      const selectedLines = matches.length === 0 ? A.takeRight(all, 8) : A.take(matches, 10)
      const lines = A.map(selectedLines.length === 0 ? ["Log is empty"] : selectedLines, (text) => {
        const location =
          /(?:^|\s)([^\s():]+\.(?:tsx?|jsx?|mjs|cjs|py|jsonc?|mdx?|css|s[ac]ss|ya?ml|toml|sql|sh|html|graphql|ttl))(?:\((\d+),\d+\)|:(\d+)(?::\d+)?|(?=\s|$))/.exec(
            text
          )
        const file = O.flatMap(O.fromNullishOr(location), (match) => O.fromUndefinedOr(match[1]))
        const line = O.flatMap(O.fromNullishOr(location), (match) =>
          O.orElse(O.fromUndefinedOr(match[2]), () => O.fromUndefinedOr(match[3]))
        )
        return FixLine.make({
          file: O.map(file, (file) =>
            repo.normalize(
              Str.startsWith("/")(file)
                ? repo.relative(file, repo.root)
                : task.directory === "" ||
                    Str.startsWith(`${task.directory}/`)(file) ||
                    Str.startsWith("packages/")(file) ||
                    Str.startsWith("apps/")(file)
                  ? file
                  : repo.join(task.directory, file)
            )
          ),
          line: O.map(line, Number),
          text
        })
      })
      return [
        CheckFinding.cases.TaskFailed.make({
          task: task.taskId,
          exitCode: task.execution.value.exitCode,
          log,
          lines,
          shown: matches.length
        })
      ]
    }),
    { concurrency: 1 }
  )
  return A.append(
    A.flatten(failures),
    CheckFinding.cases.Counted.make({ attempted: record.execution.attempted, failed: record.execution.failed })
  )
})

/** Prints the final block with each task's diagnostic lines and the log holding the rest. */
export const checkSentence = CheckFinding.match({
  NoRun: ({ runs }) => err(`No turbo run summary in ${runs}; run turbo with --summarize`),
  TaskFailed: ({ task, exitCode, log, lines, shown }) =>
    err(
      A.join(
        [
          `${task} (exit ${exitCode})`,
          ...A.map(
            lines,
            (line) =>
              `  ${O.match(line.file, {
                onNone: () => "",
                onSome: (file) =>
                  Str.startsWith(file)(line.text)
                    ? ""
                    : `${file}${O.match(line.line, { onNone: () => "", onSome: (n) => `:${n}` })}  `
              })}${line.text}`
          ),
          ...(shown > lines.length ? [`  and ${shown - lines.length} more in ${log}`] : []),
          `  log: ${log}`
        ],
        "\n"
      )
    ),
  Counted: ({ attempted, failed }) => (failed > 0 ? err : out)(`${failed} of ${attempted} tasks failed`)
})
