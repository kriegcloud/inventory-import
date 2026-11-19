/**
 * What a rule hands back: the lines it would print, in order, each to standard output or standard error, and whether
 * it failed. A rule never prints; the command does, so a test reads the same lines the person would.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CheckFailed } from "./Cli.errors.ts"

const $I = $RepoCliId.create("Report.schema")

/**
 * Where a line goes: `out` is standard output, `err` standard error.
 *
 * @category schemas
 */
export const Stream = LiteralKit(["out", "err"]).pipe(
  $I.annoteSchema("Stream", { description: "Standard output or standard error" })
)

/**
 * One printed line (it may hold line breaks: it is one call to print).
 *
 * @category schemas
 */
export class Line extends S.Class<Line, { readonly brand: unique symbol }>($I`Line`)(
  {
    to: Stream.pipe(S.annotateKey({ description: "Standard output or standard error" })),
    text: S.String.pipe(S.annotateKey({ description: "The text of the line, without its final line break" }))
  },
  $I.annote("Line", { description: "One printed line and the stream it goes to" })
) {}

/**
 * A rule's whole answer.
 *
 * @category schemas
 */
export class Report extends S.Class<Report, { readonly brand: unique symbol }>($I`Report`)(
  {
    lines: S.Array(Line).pipe(S.annotateKey({ description: "The lines to print, in order" })),
    failed: S.Boolean.pipe(S.annotateKey({ description: "Whether the rule found a problem: the exit code is then 1" }))
  },
  $I.annote("Report", { description: "The lines a rule prints and whether it failed" })
) {}

/** A line for standard output. */
export const out = (text: string): Line => Line.make({ to: "out", text })

/** A line for standard error. */
export const err = (text: string): Line => Line.make({ to: "err", text })

/** The report of a rule that found nothing wrong. */
export const passed = (lines: ReadonlyArray<Line>): Report => Report.make({ lines, failed: false })

/** The report of a rule that found a problem. */
export const failed = (lines: ReadonlyArray<Line>): Report => Report.make({ lines, failed: true })

/**
 * Prints a report as the script it replaces did, and fails with `CheckFailed` when the rule failed.
 *
 * @category commands
 */
export const emit = Effect.fn("Report.emit")(function* (answer: Report) {
  yield* Effect.forEach(
    answer.lines,
    (line) => (line.to === "out" ? Console.log(line.text) : Console.error(line.text)),
    { concurrency: 1, discard: true }
  )
  if (answer.failed) return yield* CheckFailed.make({})
  return A.length(answer.lines)
})
