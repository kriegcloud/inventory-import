// The Import aggregate proved three ways: as the package has it (`baseline`), with one command, its event and the
// rejections it shares in files of their own (`split`), and with that command's decide and the state moved out too
// (`split-decide`). Each must stand exactly as the baseline stands, rule by rule and command by command.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Order from "effect/Order"
import { Import as Baseline } from "./baseline/Import/Import.aggregate.ts"
import { Import as Split } from "./split/Import/Import.aggregate.ts"
import { Import as SplitDecide } from "./split-decide/Import/Import.aggregate.ts"

/** Everything a report says, one line each, in an order that does not depend on the file it was read from. */
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

const prove = (aggregate: typeof Baseline, variant: string) =>
  Prove.report(aggregate, { source: new URL(`./${variant}/Import/Import.aggregate.ts`, import.meta.url) }).pipe(
    Effect.map(standing)
  )

layer(NodeServices.layer)("command-file", (it) => {
  it.effect(
    "the import stands the same with a command in its own file, and with its decide there too",
    Effect.fnUntraced(function* () {
      const baseline = yield* prove(Baseline, "baseline")
      const split = yield* prove(Split, "split")
      const splitDecide = yield* prove(SplitDecide, "split-decide")
      // The baseline itself: every rule proved for every command.
      expect(A.filter(baseline, (line) => /^(Bounded|Violated|Unconfirmed|Misread|NotTranslated|Unknown)/.test(line))).toEqual([])
      expect(split).toEqual(baseline)
      expect(splitDecide).toEqual(baseline)
    }),
    900_000
  )
})
