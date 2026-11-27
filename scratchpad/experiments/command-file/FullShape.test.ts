// The import with nothing but a listing in its aggregate's file: each command's file holds its events, what each
// makes of an import, its own rejections and its decide; the state's file holds the invariants; a rules file above
// the commands holds the transitions. Proved against the baseline, rule by rule, with the listing written out
// (`Name: Name`, in `full`) and in shorthand (`Name`, in `full-shorthand`).
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Order from "effect/Order"
import * as Str from "effect/String"
import { Import as Baseline } from "./baseline/Import/Import.aggregate.ts"
import { Import as Full } from "./full/Import/Import.aggregate.ts"
import { Import as FullShorthand } from "./full-shorthand/Import/Import.aggregate.ts"

const standing = (report: Prove.Report): ReadonlyArray<string> =>
  A.sort(
    [
      ...A.flatMap([...report.invariants, ...report.transitions], (rule) =>
        A.map(rule.commands, (proof) => `${proof.verdict._tag}  ${rule.name}  ${proof.command}`)
      ),
      ...A.map(report.invariants, (rule) => `initial ${rule.initial}  ${rule.name}`),
      ...A.map(report.commands, (command) => `${command.schema._tag}  schema  ${command.command}`),
      ...A.map(report.commands, (command) => `accepted ${command.accepted}  ${command.command}`),
      ...A.map(report.agreement.differs, (path) => `differs  ${path}`),
      ...A.map(report.outside, (event) => `outside  ${event}`),
      ...A.map(report.unread, (check) => `unread  ${String(check)}`),
      ...A.map(report.unkept, (check) => `unkept  ${String(check)}`),
      `starting state allowed ${report.initial}`
    ],
    Order.String
  )

const prove = (aggregate: Parameters<typeof Prove.report>[0], variant: string) =>
  Prove.report(aggregate, { source: new URL(`./${variant}/Import/Import.aggregate.ts`, import.meta.url) }).pipe(
    Effect.map(standing)
  )

const verdicts = (lines: ReadonlyArray<string>): Readonly<Record<string, number>> =>
  A.reduce(lines, {} as Record<string, number>, (counts, line) => {
    const verdict = A.headNonEmpty(Str.split("  ")(line))
    return { ...counts, [verdict]: (counts[verdict] ?? 0) + 1 }
  })

layer(NodeServices.layer)("command-file, the aggregate only lists", (it) => {
  it.effect(
    "the import stands the same when its aggregate's file only lists",
    Effect.fnUntraced(function* () {
      const baseline = yield* prove(Baseline, "baseline")
      const full = yield* prove(Full, "full")
      const shorthand = yield* prove(FullShorthand, "full-shorthand")
      expect({ full: verdicts(full), shorthand: verdicts(shorthand) }).toEqual({
        full: verdicts(baseline),
        shorthand: verdicts(baseline)
      })
      expect(full).toEqual(baseline)
      expect(shorthand).toEqual(baseline)
    }),
    900_000
  )
})
