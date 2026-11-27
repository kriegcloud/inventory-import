// The import with each command's file read as a namespace: every file exports `evolve` and `decide` under those
// names beside its event and its command, and the aggregate holds `StageImport.decide`, `StageImport.evolve`,
// `StageImport.StageImport` (`full-ns`). Proved against the baseline with the library as it is: no change to the prover.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Order from "effect/Order"
import * as Str from "effect/String"
import { Import as Baseline } from "./baseline/Import/Import.aggregate.ts"
import { Import as Full } from "./full/Import/Import.aggregate.ts"
import { Import as FullNs } from "./full-ns/Import/Import.aggregate.ts"

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

layer(NodeServices.layer)("command-file, each command's file as a namespace", (it) => {
  it.effect(
    "the import stands the same with evolve and decide read through a namespace import",
    Effect.fnUntraced(function* () {
      const baseline = yield* prove(Baseline, "baseline")
      const full = yield* prove(Full, "full")
      const namespaces = yield* prove(FullNs, "full-ns")
      expect({ full: verdicts(full), namespaces: verdicts(namespaces) }).toEqual({
        full: verdicts(baseline),
        namespaces: verdicts(baseline)
      })
      expect(full).toEqual(baseline)
      expect(namespaces).toEqual(baseline)
    }),
    900_000
  )
})
