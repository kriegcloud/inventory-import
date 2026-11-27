// The module in `Import/` proved, and held to what the package's own Import aggregate proves: the same rules for the
// same commands, each with the same verdict. `packages/catalog/model/src/Import/Import.aggregate.ts` is the one file
// this module was cut from.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Order from "effect/Order"
import { Import as Packaged } from "../../../packages/catalog/model/src/Import/Import.aggregate.ts"
import { Import } from "./Import/Import.aggregate.ts"

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

const prove = (aggregate: Parameters<typeof Prove.report>[0], source: string) =>
  Prove.report(aggregate, { source: new URL(source, import.meta.url) }).pipe(Effect.map(standing))

layer(NodeServices.layer)("import-module", (it) => {
  it.effect(
    "the module proves what the package's one file proves",
    Effect.fnUntraced(function* () {
      const packaged = yield* prove(Packaged, "../../../packages/catalog/model/src/Import/Import.aggregate.ts")
      const module = yield* prove(Import, "./Import/Import.aggregate.ts")
      expect(
        A.filter(packaged, (line) => /^(Bounded|Violated|Unconfirmed|Misread|NotTranslated|Unknown)/.test(line))
      ).toEqual([])
      expect(packaged.length).toBe(210)
      expect(module).toEqual(packaged)
    }),
    900_000
  )
})
