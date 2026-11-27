// Whether the prover reads an event's `evolve` written beside the event, in the command's file. Two forms: a static
// of the event's class (`ColumnMatched: ColumnMatched.evolve`, in `split-evolve`), which it does not read, and an
// exported function (`ColumnMatched: evolveColumnMatched`, in `split-evolve-const`), which it does.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Order from "effect/Order"
import { Import as Baseline } from "./baseline/Import/Import.aggregate.ts"
import { Import as SplitEvolve } from "./split-evolve/Import/Import.aggregate.ts"
import { Import as SplitEvolveConst } from "./split-evolve-const/Import/Import.aggregate.ts"

const standing = (report: Prove.Report): ReadonlyArray<string> =>
  A.sort(
    [
      ...A.flatMap([...report.invariants, ...report.transitions], (rule) =>
        A.map(rule.commands, (proof) => `${proof.verdict._tag}  ${rule.name}  ${proof.command}`)
      ),
      ...A.map(report.agreement.differs, (path) => `differs  ${path}`),
      ...A.map(report.outside, (event) => `outside  ${event}`),
      ...A.map(report.unread, (check) => `unread  ${String(check)}`),
      ...A.map(report.unkept, (check) => `unkept  ${String(check)}`)
    ],
    Order.String
  )

const prove = (aggregate: Parameters<typeof Prove.report>[0], variant: string) =>
  Prove.report(aggregate, { source: new URL(`./${variant}/Import/Import.aggregate.ts`, import.meta.url) }).pipe(
    Effect.map(standing)
  )

layer(NodeServices.layer)("command-file, an event's evolve as its static", (it) => {
  it.effect(
    "an evolve beside its event is read as an exported function, and not as a static of the event's class",
    Effect.fnUntraced(function* () {
      const baseline = yield* prove(Baseline, "baseline")
      const splitEvolve = yield* prove(SplitEvolve, "split-evolve")
      const splitEvolveConst = yield* prove(SplitEvolveConst, "split-evolve-const")
      const notTranslated = (lines: ReadonlyArray<string>) => A.filter(lines, (line) => /^NotTranslated/.test(line)).length
      expect({ static: notTranslated(splitEvolve), exportedFunction: notTranslated(splitEvolveConst) }).toEqual({
        static: 27,
        exportedFunction: 0
      })
      expect(splitEvolveConst).toEqual(baseline)
    }),
    900_000
  )
})
